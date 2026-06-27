import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  type UIMessage,
} from "ai";
import { webSearch } from "@exalabs/ai-sdk";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "../../config/env.js";
import { ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { buildSupportSystemPrompt, type AiUserContext } from "./ai.context.js";
import { AI_TOOLS } from "./ai.tools.js";
import {
  getOrCreateConversation,
  appendMessage,
  type AiConversationRow,
} from "./ai.conversations.js";

let nimProvider: ReturnType<typeof createOpenAICompatible> | null = null;

function getNimProvider() {
  if (!env.NVIDIA_NIM_API_KEY) {
    throw new ValidationError(
      "AI support is not configured. Set NVIDIA_NIM_API_KEY on the server.",
    );
  }
  if (!nimProvider) {
    nimProvider = createOpenAICompatible({
      name: "nvidia-nim",
      baseURL: env.NVIDIA_NIM_BASE_URL,
      apiKey: env.NVIDIA_NIM_API_KEY,
    });
  }
  return nimProvider;
}

export function getAiStatus() {
  return {
    enabled: Boolean(env.NVIDIA_NIM_API_KEY),
    model: env.NVIDIA_NIM_MODEL,
    provider: "nvidia-nim",
    tools: AI_TOOLS.map((t) => t.name),
    webSearch: Boolean(env.EXA_API_KEY),
  };
}

export interface StreamChatOptions {
  messages: UIMessage[];
  user: AiUserContext;
  conversationId?: string | null;
}

export interface StreamChatResult {
  stream: ReturnType<typeof createUIMessageStream>;
  conversation: AiConversationRow;
}

export async function streamSupportChat(
  opts: StreamChatOptions,
): Promise<StreamChatResult> {
  const provider = getNimProvider();
  const { messages, user } = opts;

  // Load or create conversation for persistence
  const conversation = await getOrCreateConversation({
    conversationId: opts.conversationId,
    userId: user.userId,
    anonymous: !user.isAuthenticated,
  });

  // Save the latest user message (the last one in the array)
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === "user") {
    const text = extractText(lastMessage);
    if (text) {
      await appendMessage(conversation.id, { role: "user", content: text });
    }
  }

  // Build internal TapaRide tools (journeys, parcels, wallet, etc.)
  const internalTools = Object.fromEntries(
    AI_TOOLS.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: (input: any) => tool.execute(input, user),
      },
    ]),
  );

  // Add Exa web search tool if API key is configured
  const tools: Record<string, any> = {
    ...internalTools,
  };

  if (env.EXA_API_KEY) {
    tools["webSearch"] = webSearch({
      apiKey: env.EXA_API_KEY,
      type: "neural",
      numResults: 5,
      contents: {
        text: { maxCharacters: 300 },
        highlights: { numSentences: 2, query: "" },
      },
      startPublishedDate: "2024-01-01",
    });
    logger.debug("Exa web search enabled for AI chat");
  }

  const result = streamText({
    model: provider(env.NVIDIA_NIM_MODEL) as any,
    system: buildSupportSystemPrompt(user),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    temperature: 0.3,
    tools,
    onFinish: async ({ text, toolCalls, toolResults }) => {
      // Persist the assistant reply after streaming completes
      try {
        await appendMessage(conversation.id, {
          role: "assistant",
          content: text,
          toolCalls:
            toolCalls?.map((tc, i) => ({
              tool: tc.toolName,
              input: tc.input,
              output: (toolResults?.[i] as any)?.output ?? null,
            })) ?? [],
        });
      } catch (err) {
        logger.error(
          { err, conversationId: conversation.id },
          "failed to persist ai reply",
        );
      }
    },
  });

  return {
    stream: result.toUIMessageStream(),
    conversation,
  };
}

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
}
