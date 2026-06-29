import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import ChatMessageBubble, { TypingIndicator, type ChatMessage } from '../../components/ChatMessage'
import { useTrekContext } from '../../lib/trek-context'

interface Conversation {
  id: string
  title: string
  lastMessage: string
  updatedAt: Date
}

const SUGGESTED_PROMPTS = [
  'Show my active trips',
  'How do I top up my wallet?',
  'Track my parcel',
  'Find buses from Kigali tomorrow',
  'What routes do you have?',
]

export default function TrekDashboard() {
  const { user } = useAuth()
  const context = useTrekContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(true)
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
    inputRef.current?.focus()
  }, [])

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

    const currentConvId = activeConversationId || `conv-${Date.now()}`
    if (!activeConversationId) {
      setActiveConversationId(currentConvId)
      setConversations((prev) => [
        {
          id: currentConvId,
          title: text.slice(0, 40),
          lastMessage: text,
          updatedAt: new Date(),
        },
        ...prev,
      ])
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

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulated || "Sorry, I couldn't process that." }
            : m,
        ),
      )

      // Update conversation last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId ? { ...c, lastMessage: accumulated.slice(0, 60) || text, updatedAt: new Date() } : c,
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

  const startNewConversation = () => {
    setMessages([])
    setActiveConversationId(null)
  }

  const loadConversation = (conv: Conversation) => {
    setActiveConversationId(conv.id)
    // In a real app, you'd load messages from the backend
    // For now, we just switch context
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900">
              <svg className="h-5 w-5" viewBox="0 0 100 50" fill="none">
                <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
                <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
                <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
                <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-900">Trek</div>
              <div className="text-[10px] text-ink-400">AI Transport Assistant</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg border transition',
              showHistory
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-100 text-ink-400 hover:bg-ink-50',
            )}
            aria-label="Toggle conversation history"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ink-900">
                <svg className="h-8 w-8" viewBox="0 0 100 50" fill="none">
                  <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
                  <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
                  <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
                  <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink-900">
                Hi{user?.email ? `, ${user.email.split('@')[0]}` : ""} — I'm Trek
              </h3>
              <p className="mt-1 max-w-sm text-sm text-ink-400">
                I know your trips, bookings, and parcels. Ask me anything about getting around Rwanda.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-ink-100 bg-white px-4 py-2 text-xs font-medium text-ink-600 transition hover:border-ink-200 hover:bg-ink-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isTyping && !messages[messages.length - 1]?.content && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-ink-100 px-6 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your trips, bookings, routes..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition focus:border-ink-300 focus:bg-white"
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
                aria-label="Send"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-ink-300">
              Powered by AI · Responses are generated, not human
            </p>
          </div>
        </div>
      </div>

      {/* Right sidebar — conversation history */}
      {showHistory && (
        <div className="w-64 shrink-0 border-l border-ink-100 bg-ink-50/50">
          <div className="flex h-full flex-col">
            <div className="border-b border-ink-100 px-4 py-3">
              <button
                type="button"
                onClick={startNewConversation}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New conversation
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <p className="px-2 py-4 text-center text-[11px] text-ink-400">
                  Your conversations will appear here
                </p>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => loadConversation(conv)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left transition',
                        activeConversationId === conv.id
                          ? 'bg-ink-900 text-white'
                          : 'hover:bg-white',
                      )}
                    >
                      <div className={cn('truncate text-xs font-medium', activeConversationId !== conv.id && 'text-ink-900')}>
                        {conv.title}
                      </div>
                      <p className={cn('mt-0.5 truncate text-[10px]', activeConversationId === conv.id ? 'text-white/50' : 'text-ink-400')}>
                        {conv.lastMessage}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-ink-100 px-4 py-2">
              <p className="text-[10px] text-ink-300">Conversations are saved</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
