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
  { icon: '🎫', label: 'Show my active trips' },
  { icon: '💰', label: 'How do I top up my wallet?' },
  { icon: '📦', label: 'Track my parcel' },
  { icon: '🚌', label: 'Find buses from Kigali tomorrow' },
  { icon: '🗺️', label: 'What routes are available?' },
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

  return (
    <div className="flex h-[calc(100vh-4rem)]" style={{ background: 'var(--bg)' }}>
      {/* Main chat area — Meta AI style centered layout */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--accent)' }}>
              <svg className="h-5 w-5" viewBox="0 0 100 50" fill="none">
                <rect x="8" y="10" width="72" height="24" rx="6" fill="white" opacity="0.9" />
                <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
                <circle cx="20" cy="38" r="4" fill="white" opacity="0.8" />
                <circle cx="68" cy="38" r="4" fill="white" opacity="0.8" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Trek</div>
              <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>AI Transport Assistant</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'grid h-9 w-9 place-items-center rounded-xl border transition',
            )}
            style={{
              borderColor: showHistory ? 'var(--accent)' : 'var(--border)',
              background: showHistory ? 'var(--accent)' : 'transparent',
              color: showHistory ? 'white' : 'var(--text-secondary)',
            }}
            aria-label="Toggle conversation history"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
          </button>
        </div>

        {/* Messages — centered like Meta AI */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              {/* Logo */}
              <div className="mb-5">
                <svg className="h-12 w-24" viewBox="0 0 100 50" fill="none">
                  <rect x="8" y="10" width="72" height="24" rx="6" fill="#10075C" />
                  <rect x="8" y="32" width="72" height="3" fill="#EA580C" />
                  <circle cx="20" cy="38" r="4" fill="#10075C" opacity="0.7" />
                  <circle cx="68" cy="38" r="4" fill="#10075C" opacity="0.7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Hi{user?.email ? `, ${user.email.split('@')[0]}` : ''}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                I can help with bookings, tracking, routes, and wallet questions
              </p>
              {/* Suggestion pills — Meta AI style */}
              <div className="mt-8 flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => {
                      setInput(prompt.label)
                      inputRef.current?.focus()
                    }}
                    className="flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-medium transition hover:bg-opacity-80"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                      background: 'var(--surface)',
                    }}
                  >
                    <span>{prompt.icon}</span>
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {isTyping && !messages[messages.length - 1]?.content && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Input — Meta AI style centered composer */}
        <div className="border-t px-4 py-4" style={{ borderColor: 'var(--border)' }}>
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-3 rounded-2xl border px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What can I help you with?"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-ink-400"
                style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full transition',
                )}
                style={{
                  background: input.trim() && !isTyping ? 'var(--accent)' : 'var(--border)',
                  color: input.trim() && !isTyping ? 'white' : 'var(--text-tertiary)',
                }}
                aria-label="Send"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              Powered by AI · Responses are generated, not human
            </p>
          </div>
        </div>
      </div>

      {/* Right sidebar — conversation history */}
      {showHistory && (
        <div className="w-64 shrink-0 border-l" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={startNewConversation}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--surface)' }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New conversation
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  Your conversations will appear here
                </p>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setActiveConversationId(conv.id)}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-left transition',
                      )}
                      style={{
                        background: activeConversationId === conv.id ? 'var(--accent)' : 'transparent',
                        color: activeConversationId === conv.id ? 'white' : 'var(--text-primary)',
                      }}
                    >
                      <div className="truncate text-xs font-medium">
                        {conv.title}
                      </div>
                      <p className="mt-0.5 truncate text-[10px]" style={{ color: activeConversationId === conv.id ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)' }}>
                        {conv.lastMessage}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Conversations are saved</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
