import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '../lib/utils'
import ChatMessageBubble, { TypingIndicator, type ChatMessage } from './ChatMessage'
import { useTrekContext } from '../lib/trek-context'

interface TrekChatProps {
  isOpen: boolean
  onClose: () => void
}

const SUGGESTED_PROMPTS = [
  'Show my active trips',
  'How do I top up my wallet?',
  'Track my parcel',
  'Find buses from Kigali tomorrow',
]

export default function TrekChat({ isOpen, onClose }: TrekChatProps) {
  const context = useTrekContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isTyping) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      status: 'sent',
    }

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsTyping(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: text }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            user: context?.user,
            activeTrips: context?.activeTrips,
            wallet: context?.wallet,
            parcels: context?.parcels,
          },
        }),
      })

      if (!response.ok) throw new Error('Request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m,
          ),
        )
      }

      // Stream complete — ensure final content is set
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: accumulated || "Sorry, I couldn't process that." } : m,
        ),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Unable to connect. Please check your connection and try again.' }
            : m,
        ),
      )
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-ink-950/20 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="flex h-[600px] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-900 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
              <svg className="h-5 w-5" viewBox="0 0 100 50" fill="none">
                <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
                <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
                <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
                <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Trek</div>
              <div className="text-[10px] text-white/50">Your transport assistant</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close chat"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-ink-900">
                <svg className="h-7 w-7" viewBox="0 0 100 50" fill="none">
                  <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
                  <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
                  <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
                  <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-ink-900">Hi, I'm Trek</h3>
              <p className="mt-1 max-w-xs text-sm text-ink-400">
                I can help you with bookings, tracking, wallet top-ups, and finding the best routes.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:border-ink-200 hover:bg-ink-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isTyping && !messages[messages.length - 1]?.content && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-ink-100 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your trips, bookings, routes..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-ink-100 bg-ink-50 px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition focus:border-ink-300 focus:bg-white"
              style={{ maxHeight: '100px' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
                input.trim() && !isTyping
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
          <p className="mt-1.5 text-[10px] text-ink-300">Trek uses your trip & account context to help you</p>
        </div>
      </div>
    </div>
  )
}
