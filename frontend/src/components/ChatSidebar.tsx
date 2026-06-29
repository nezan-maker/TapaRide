import { cn } from '../lib/utils'

export interface Conversation {
  id: string
  title: string
  lastMessage: string
  updatedAt: Date
  unread: boolean
}

interface ChatSidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export default function ChatSidebar({ conversations, activeId, onSelect, onNew }: ChatSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-ink-100 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-[10px] font-bold text-white">
            T
          </div>
          <span className="text-sm font-semibold text-ink-900">Trek</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="grid h-7 w-7 place-items-center rounded-lg border border-ink-100 text-ink-400 transition hover:bg-ink-50 hover:text-ink-900"
          aria-label="New conversation"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-ink-50 text-ink-300">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-ink-400">No conversations yet</p>
            <p className="mt-1 text-[11px] text-ink-300">Ask Trek anything about your trips</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  'w-full rounded-xl px-3 py-2.5 text-left transition',
                  activeId === c.id
                    ? 'bg-ink-900 text-white'
                    : 'hover:bg-ink-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('truncate text-sm font-medium', activeId !== c.id && 'text-ink-900')}>
                    {c.title}
                  </span>
                  {c.unread && activeId !== c.id && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-flame-500" />
                  )}
                </div>
                <p className={cn('mt-0.5 truncate text-xs', activeId === c.id ? 'text-white/60' : 'text-ink-400')}>
                  {c.lastMessage}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-ink-100 px-4 py-2.5">
        <p className="text-[10px] text-ink-300">Trek knows your trips, bookings & parcels</p>
      </div>
    </div>
  )
}
