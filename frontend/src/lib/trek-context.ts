import { useEffect, useState } from 'react'

export interface TrekContext {
  user: {
    name: string
    email: string
    role: string
    phone: string | null
    phoneVerified: boolean
    memberSince: string
  }
  activeTrips: Array<{
    id: string
    route: string
    date: string
    status: string
    seatNumber: string | null
    vehicle: string | null
  }>
  recentBookings: Array<{
    id: string
    route: string
    date: string
    amount: number
    status: string
  }>
  wallet: {
    balance: number
    status: string
  } | null
  parcels: Array<{
    id: string
    trackingCode: string
    route: string
    status: string
  }>
}

export function useTrekContext(): TrekContext | null {
  const [context, setContext] = useState<TrekContext | null>(null)

  useEffect(() => {
    async function loadContext() {
      try {
        const [userRes, tripsRes, bookingsRes, walletRes, parcelsRes] = await Promise.allSettled([
          fetch('/api/users/me'),
          fetch('/api/trips/active?limit=3'),
          fetch('/api/bookings/recent?limit=3'),
          fetch('/api/wallet'),
          fetch('/api/parcels?limit=3'),
        ])

        const user = userRes.status === 'fulfilled' ? await userRes.value.json() : null
        const trips = tripsRes.status === 'fulfilled' ? await tripsRes.value.json() : { items: [] }
        const bookings = bookingsRes.status === 'fulfilled' ? await bookingsRes.value.json() : { items: [] }
        const wallet = walletRes.status === 'fulfilled' ? await walletRes.value.json() : null
        const parcels = parcelsRes.status === 'fulfilled' ? await parcelsRes.value.json() : { items: [] }

        if (!user) return

        setContext({
          user: {
            name: user.name || user.email.split('@')[0],
            email: user.email,
            role: user.role,
            phone: user.phone || null,
            phoneVerified: !!user.phoneVerifiedAt,
            memberSince: user.createdAt,
          },
          activeTrips: (trips.items || []).map((t: any) => ({
            id: t.id,
            route: `${t.journey?.sourceStation?.name || 'Unknown'} → ${t.journey?.destinationStation?.name || 'Unknown'}`,
            date: t.journey?.departureTime || t.createdAt,
            status: t.status,
            seatNumber: t.seatNumber || null,
            vehicle: t.journey?.vehicle?.plateNumber || null,
          })),
          recentBookings: (bookings.items || []).map((b: any) => ({
            id: b.id,
            route: b.route || 'Unknown route',
            date: b.date || b.createdAt,
            amount: b.amount || 0,
            status: b.status,
          })),
          wallet: wallet ? {
            balance: wallet.balance ?? 0,
            status: wallet.status ?? 'UNINITIALIZED',
          } : null,
          parcels: (parcels.items || []).map((p: any) => ({
            id: p.id,
            trackingCode: p.trackingCode || p.id,
            route: `${p.journey?.sourceStation?.name || '?'} → ${p.journey?.destinationStation?.name || '?'}`,
            status: p.status,
          })),
        })
      } catch {
        // Context loading is non-critical; bot works without it
      }
    }

    loadContext()
  }, [])

  return context
}

export function buildTrekSystemPrompt(context: TrekContext | null): string {
  if (!context) {
    return `You are Trek, the TapaRide transport assistant. You help users with:
- Booking bus tickets and finding routes
- Tracking trips and parcels
- Managing their account and wallet
- Understanding fares, schedules, and policies

Be concise, direct, and helpful. Never write code or summarize text. Only help with transport-related tasks.`
  }

  const { user, activeTrips, recentBookings, wallet, parcels } = context

  const parts = [
    `You are Trek, the TapaRide transport assistant for ${user.name}.`,
    `User role: ${user.role}. Member since: ${new Date(user.memberSince).toLocaleDateString()}.`,
  ]

  if (user.phone) {
    parts.push(`Phone: ${user.phone} (${user.phoneVerified ? 'verified' : 'not verified'}).`)
  }

  if (wallet) {
    parts.push(`Wallet: ${(wallet.balance / 100).toLocaleString()} RWF (${wallet.status}).`)
  }

  if (activeTrips.length > 0) {
    parts.push(`Active trips:\n${activeTrips.map(t => `- ${t.route} on ${new Date(t.date).toLocaleDateString()} [${t.status}]${t.seatNumber ? ` Seat ${t.seatNumber}` : ''}`).join('\n')}`)
  }

  if (recentBookings.length > 0) {
    parts.push(`Recent bookings:\n${recentBookings.map(b => `- ${b.route} on ${new Date(b.date).toLocaleDateString()} [${b.status}] ${(b.amount / 100).toLocaleString()} RWF`).join('\n')}`)
  }

  if (parcels.length > 0) {
    parts.push(`Parcels:\n${parcels.map(p => `- ${p.trackingCode}: ${p.route} [${p.status}]`).join('\n')}`)
  }

  parts.push(`\nYou help with: booking tickets, finding routes, tracking trips/parcels, wallet top-up, understanding fares and schedules, trip changes. Be concise and direct. Never write code or summarize text. Only help with transport-related tasks.`)

  return parts.join('\n\n')
}
