import { useState, useEffect } from 'react'
import { Bell, Ticket, Package, Megaphone, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { api, ApiError } from '../../lib/api'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

const iconMap: Record<string, typeof Bell> = {
  TRIP: Ticket,
  PARCEL: Package,
  PROMO: Megaphone,
  SYSTEM: Bell,
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      // If the backend doesn't have a dedicated notifications endpoint,
      // we fetch user data and construct from there, or use empty state.
      const data = await api.get('/api/notifications').catch(() => null)
      if (data) {
        const list = data.notifications || data.items || data
        setNotifications(Array.isArray(list) ? list : [])
      } else {
        // No notifications endpoint - show empty state
        setNotifications([])
      }
    } catch (err) {
      // If 404, the endpoint doesn't exist yet — show empty state gracefully
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        setNotifications([])
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load notifications')
      }
    } finally {
      setLoading(false)
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Notifications</h1>
          <p className="text-ink-500">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'Stay updated on your trips and parcels.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => {/* mark all as read */}}
            className="btn-outline text-xs py-2 px-4"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = iconMap[n.type] || Bell
            return (
              <div
                key={n.id}
                className={cn(
                  'card flex gap-4 p-5 transition',
                  !n.read && 'border-flame-200 bg-flame-50/20'
                )}
              >
                <span className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                  !n.read ? 'bg-flame-100 text-flame-600' : 'bg-ink-50 text-ink-400'
                )}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-ink-900 text-sm">{n.title}</div>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">{n.message}</p>
                </div>
                {!n.read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-flame-600" />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-10 text-center text-ink-400">
          <Bell className="mx-auto h-10 w-10 text-ink-200 mb-3" />
          <p>No notifications yet.</p>
          <p className="text-sm mt-1">You'll see updates about your trips and parcels here.</p>
        </div>
      )}
    </div>
  )
}
