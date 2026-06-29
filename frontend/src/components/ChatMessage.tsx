import { cn } from '../lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'error'
}

interface ChatMessageProps {
  message: ChatMessage
}

export default function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full px-3 py-1 text-[11px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: 'var(--accent)' }}>
          <svg className="h-4 w-4" viewBox="0 0 100 50" fill="none">
            <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
            <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
            <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
            <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
          </svg>
        </div>
      )}

      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser ? 'rounded-br-md' : 'rounded-bl-md',
          )}
          style={{
            background: isUser ? 'var(--accent)' : 'var(--bg-secondary)',
            color: isUser ? 'white' : 'var(--text-primary)',
          }}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>

        {/* Timestamp + status */}
        <div className={cn('flex items-center gap-1.5 px-1 text-[10px]', isUser ? 'flex-row-reverse' : 'flex-row')} style={{ color: 'var(--text-tertiary)' }}>
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isUser && message.status === 'sending' && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--text-tertiary)' }} />
          )}
          {isUser && message.status === 'sent' && (
            <span style={{ color: '#22c55e' }}>✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: 'var(--accent)' }}>
        <svg className="h-4 w-4" viewBox="0 0 100 50" fill="none">
          <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
          <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
          <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
          <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
        <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-tertiary)', animationDelay: '0ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-tertiary)', animationDelay: '150ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-tertiary)', animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
