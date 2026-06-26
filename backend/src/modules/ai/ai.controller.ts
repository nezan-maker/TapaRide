import { Request, Response, NextFunction } from 'express';
import { pipeUIMessageStreamToResponse } from 'ai';
import { chatRequestSchema } from './ai.schema.js';
import { streamSupportChat, getAiStatus } from './ai.service.js';
import { listUserConversations, deleteConversation as deleteConversationSvc } from './ai.conversations.js';
import type { AiUserContext } from './ai.context.js';

function resolveUserContext(req: Request): AiUserContext {
  const user = req.user as { id?: string; role?: string; email?: string } | undefined;
  if (!user) {
    return { isAuthenticated: false };
  }
  return {
    isAuthenticated: true,
    role: user.role,
    email: user.email,
    userId: user.id,
  };
}

export async function getStatus(_req: Request, res: Response) {
  res.json(getAiStatus());
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const conversations = await listUserConversations(user.id);
    res.json({ items: conversations });
  } catch (error) {
    next(error);
  }
}

export async function deleteConversationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const ok = await deleteConversationSvc(req.params.id as string, user.id);
    if (!ok) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = chatRequestSchema.parse(req.body);
    const result = await streamSupportChat({
      messages: dto.messages as any,
      user: resolveUserContext(req),
      conversationId: dto.conversationId,
    });

    // Let the client know which conversation this is so it can send the ID
    // back on the next request (enables conversation continuity).
    res.setHeader('x-conversation-id', result.conversation.id);

    pipeUIMessageStreamToResponse({
      response: res,
      stream: result.stream,
    });
  } catch (error) {
    next(error);
  }
}
