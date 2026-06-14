import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { api, ApiError } from '../../lib/api'
import Fa from '../../components/Fa';

interface NotificationItem {
  id: string
  type: 'TRIP' | 'PARCEL' | 'PROMO' | 'SYSTEM' | string
  title: string
  message: string
  read: boolean
  createdAt: string
  href?: string
}

const iconMap: Record<string, string> = {
  TRIP: 'ticket',
  PARCEL: 'package',
  PROMO: 'megaphone',
  SYSTEM: 'bell',
}

const typeLabel: Record<string, string> = {
  TRIP: 'Trip',
  PARCEL: 'Parcel',
  PROMO: 'Promo',
  SYSTEM: 'System',
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

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/notifications')
      // The backend returns { items: Notification[], unreadCount: number }.
      const list: NotificationItem[] = data?.items ?? data?.notifications ?? []
      setNotifications(Array.isArray(list) ? list : [])
      setUnread(typeof data?.unreadCount === 'number' ? data.unreadCount : list.filter((n) => !n.read).length)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Sign in to view your notifications.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load notifications')
      }
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markRead = async (id: string) => {
    // Optimistic update.
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      setUnread(next.filter((n) => !n.read).length)
      return next
    })
    try {
      await api.post(`/api/notifications/${id}/read`)
    } catch {
      // Roll back on failure.
      fetchNotifications()
    }
  }

  const markAll = async () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      setUnread(0)
      return next
    })
    try {
      await api.post('/api/notifications/read-all')
    } catch {
      fetchNotifications()
    }
  }

  const renderItem = (n: NotificationItem) => {
    const iconName = iconMap[n.type] || 'bell'
    const type = typeLabel[n.type] || n.type
    const body = (
      <div
        className={cn(
          'card flex gap-4 p-5 transition',
          !n.read && 'border-flame-200 bg-flame-50/20',
        )}
      >
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            !n.read ? 'bg-flame-100 text-flame-600' : 'bg-ink-50 text-ink-400',
          )}
        >
          <Fa name={iconName} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {type}
              </span>
              <div className="font-semibold text-ink-900 text-sm">{n.title}</div>
            </div>
            <span className="shrink-0 text-xs text-ink-400">{timeAgo(n.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-500">{n.message}</p>
        </div>
        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-flame-600" />}
      </div>
    )

    if (n.href) {
      return (
        <Link
          key={n.id}
          to={n.href}
          onClick={() => { if (!n.read) markRead(n.id) }}
        >
          {body}
        </Link>
      )
    }
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => { if (!n.read) markRead(n.id) }}
        className="block w-full text-left"
      >
        {body}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Notifications</h1>
          <p className="text-ink-500">
            {unread > 0
              ? `You have ${unread} unread notification${unread > 1 ? 's' : ''}.`
              : 'You\u2019re all caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn-outline text-xs py-2 px-4">
            <Fa name="check" className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">{notifications.map(renderItem)}</div>
      ) : (
        <div className="card p-10 text-center text-ink-400">
          <Fa name="bell" className="mx-auto h-10 w-10 text-ink-200 mb-3" />
          <p>No notifications yet.</p>
          <p className="text-sm mt-1">You\u2019ll see updates about your trips and parcels here.</p>
        </div>
      )}
    </div>
  )
}
