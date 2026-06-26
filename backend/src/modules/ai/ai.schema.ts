import { z } from 'zod';

const uiMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
}).passthrough();

export const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(uiMessagePartSchema).min(1),
}).passthrough();

export const chatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(uiMessageSchema).min(1).max(30),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  messageId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
});

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
