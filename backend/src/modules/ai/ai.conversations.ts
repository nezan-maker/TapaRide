import { db } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';

/**
 * AI conversation persistence.
 *
 * The frontend sends a `conversationId` in the chat request body. If present,
 * we load prior messages and append new ones. If absent (or anonymous), we
 * create a new conversation on first message.
 *
 * Anonymous conversations are not tied to a user and are cleaned up by a
 * retention job (not implemented here — add to cron later).
 */

export type AiMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: unknown[] | null;
  createdAt: Date;
};

export type AiConversationRow = {
  id: string;
  userId: string | null;
  messages: AiMessageRow[];
};

export async function getOrCreateConversation(opts: {
  conversationId?: string | null;
  userId?: string;
  anonymous?: boolean;
}): Promise<AiConversationRow> {
  if (opts.conversationId) {
    const existing = await db.aiConversation.findUnique({
      where: { id: opts.conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) {
      return {
        id: existing.id,
        userId: existing.userId,
        messages: existing.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolCalls: (m.toolCalls as unknown[]) ?? null,
          createdAt: m.createdAt,
        })),
      };
    }
  }

  const created = await db.aiConversation.create({
    data: {
      userId: opts.userId ?? null,
      anonymous: opts.anonymous ?? !opts.userId,
    },
    include: { messages: true },
  });

  logger.info({ conversationId: created.id, userId: opts.userId }, 'ai conversation created');

  return {
    id: created.id,
    userId: created.userId,
    messages: [],
  };
}

export async function appendMessage(conversationId: string, message: {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: unknown[];
}): Promise<AiMessageRow> {
  const created = await db.aiMessage.create({
    data: {
      conversationId,
      role: message.role,
      content: message.content,
      toolCalls: (message.toolCalls ?? undefined) as unknown as any,
    },
  });

  // Touch the conversation's updatedAt
  await db.aiConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    id: created.id,
    role: created.role as 'user' | 'assistant',
    content: created.content,
    toolCalls: (created.toolCalls as unknown[]) ?? null,
    createdAt: created.createdAt,
  };
}

export async function listUserConversations(userId: string, limit = 20): Promise<AiConversationRow[]> {
  const conversations = await db.aiConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1, // preview: last message only
      },
    },
  });

  return conversations.map((c) => ({
    id: c.id,
    userId: c.userId,
    messages: c.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      toolCalls: (m.toolCalls as unknown[]) ?? null,
      createdAt: m.createdAt,
    })),
  }));
}

export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
  const conversation = await db.aiConversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (!conversation || conversation.userId !== userId) {
    return false;
  }
  await db.aiConversation.delete({ where: { id: conversationId } });
  return true;
}
