import { useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { cn } from '../lib/utils'
import { MarkdownContent } from './MarkdownContent'
import { friendlyError } from '../lib/errors'
import { TypingIndicator } from './ChatMessage'

import { API_BASE } from '../lib/config'

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
}

function hasToolCalls(message: UIMessage): boolean {
  return message.parts.some(
    (part) => part.type === 'tool-call' || part.type === 'tool-input' || part.type === 'tool-result',
  )
}

function getToolName(message: UIMessage): string | null {
  const toolPart = message.parts.find((p) => p.type === 'tool-call')
  if (toolPart && 'toolName' in toolPart) return String(toolPart.toolName)
  return null
}

const SUGGESTIONS = [
  'How do I track my parcel?',
  'How does wallet top-up work?',
  'How do I cancel a booking?',
  'How does the claim code work?',
] as const

export default function SupportChat() {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/ai/chat`,
        headers: () => {
          const token = localStorage.getItem('accessToken')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    [],
  )

  const { messages, sendMessage, status, error } = useChat({
    transport,
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    await sendMessage({ text })
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  const askSuggestion = (text: string) => {
    if (isBusy) return
    void sendMessage({ text })
  }

  return (
    <section className="mx-auto mt-12 max-w-3xl">
      {/* Header with identity */}
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-ink-900">
          <svg className="h-6 w-6" viewBox="0 0 100 50" fill="none">
            <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
            <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
            <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
            <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-ink-900">Tapa Assist</h2>
        <p className="mt-1 text-sm text-ink-400">
          AI-powered help for bookings, parcels, and wallet questions
        </p>
      </div>

      <div className="card flex h-[500px] flex-col overflow-hidden">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-ink-50">
                <svg className="h-7 w-7" viewBox="0 0 100 50" fill="none">
                  <rect x="8" y="10" width="72" height="24" rx="6" fill="#10075C" opacity="0.15" />
                  <rect x="8" y="32" width="72" height="3" fill="#EA580C" opacity="0.2" />
                  <circle cx="20" cy="38" r="4" fill="#10075C" opacity="0.1" />
                  <circle cx="68" cy="38" r="4" fill="#10075C" opacity="0.1" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-ink-900">Hi, I'm Tapa Assist</h3>
              <p className="mt-1 max-w-xs text-sm text-ink-400">
                Ask about trips, parcels, wallet top-ups, or claim codes. I can help you navigate TapaRide.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => askSuggestion(s)}
                    disabled={isBusy}
                    className="rounded-full border border-ink-100 bg-white px-3.5 py-2 text-xs font-medium text-ink-600 transition hover:border-ink-200 hover:bg-ink-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Welcome message */}
              <div className="flex gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                  T
                </div>
                <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-ink-50 px-4 py-2.5 text-sm leading-relaxed text-ink-700">
                  Hi — I'm Tapa Assist. Ask about trips, parcels, wallet top-ups, or claim codes.
                </div>
              </div>

              {messages.map((message) => {
                const text = messageText(message)
                const showToolIndicator = hasToolCalls(message)
                const toolName = getToolName(message)
                if (!text && !showToolIndicator) return null
                const isUser = message.role === 'user'
                return (
                  <div
                    key={message.id}
                    className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}
                  >
                    {!isUser && (
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                        T
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        isUser
                          ? 'rounded-br-md bg-ink-900 text-white'
                          : 'rounded-bl-md bg-ink-50 text-ink-900',
                      )}
                    >
                      {showToolIndicator && !text && (
                        <div className="flex items-center gap-2 text-ink-500">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" />
                          <span className="italic">
                            {toolName ? `Looking up ${toolName.replace(/([A-Z])/g, ' $1').trim()}…` : 'Calling tool…'}
                          </span>
                        </div>
                      )}
                      {text && <MarkdownContent content={text} />}
                    </div>
                  </div>
                )
              })}

              {isBusy && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="border-t border-flame-100 bg-flame-50 px-4 py-3 text-sm text-flame-700">
            {friendlyError(error.message)}
          </div>
        )}

        {/* Input area */}
        <form onSubmit={handleSubmit} className="border-t border-ink-100 p-4">
          <div className="flex items-end gap-2">
            <textarea
              className="flex-1 resize-none rounded-xl border border-ink-100 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition focus:border-ink-300 focus:bg-white"
              placeholder="Ask about your trips, bookings, parcels..."
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ;(e.target as HTMLTextAreaElement).form?.requestSubmit()
                }
              }}
              disabled={isBusy}
              style={{ maxHeight: '100px' }}
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
                input.trim() && !isBusy
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-ink-100 text-ink-300',
              )}
              aria-label="Send message"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-ink-300">Powered by AI · Responses are generated, not human</p>
        </form>
      </div>
    </section>
  )
}
