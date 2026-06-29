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
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-ink-50 px-3 py-1 text-[11px] text-ink-400">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
          T
        </div>
      )}

      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-br-md bg-ink-900 text-white'
              : 'rounded-bl-md bg-ink-50 text-ink-900',
          )}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>

        {/* Timestamp + status */}
        <div className={cn('flex items-center gap-1.5 px-1 text-[10px] text-ink-300', isUser && 'flex-row-reverse')}>
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isUser && message.status === 'sending' && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-300" />
          )}
          {isUser && message.status === 'sent' && (
            <span className="text-emerald-500">✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
        T
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-ink-50 px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:300ms]" />
      </div>
    </div>
  )
}
