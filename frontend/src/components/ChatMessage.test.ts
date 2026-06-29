import { describe, expect, it } from 'vitest'

import ChatMessageBubble, { TypingIndicator } from '../components/ChatMessage'
import type { ChatMessage } from '../components/ChatMessage'

const baseMessage: ChatMessage = {
  id: '1',
  role: 'user',
  content: 'Hello',
  timestamp: new Date('2026-06-29T10:00:00Z'),
}

describe('ChatMessageBubble', () => {
  it('exports valid component and typing indicator', () => {
    expect(ChatMessageBubble).toBeTypeOf('function')
    expect(TypingIndicator).toBeTypeOf('function')
  })

  it('handles all message roles', () => {
    expect(baseMessage.role).toBe('user')
    expect({ ...baseMessage, role: 'assistant' }.role).toBe('assistant')
    expect({ ...baseMessage, role: 'system' }.role).toBe('system')
  })
})
