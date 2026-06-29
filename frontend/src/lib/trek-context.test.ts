import { describe, expect, it } from 'vitest'

import { buildTrekSystemPrompt } from '../lib/trek-context'
import type { TrekContext } from '../lib/trek-context'

describe('trek-context', () => {
  const mockContext: TrekContext = {
    user: {
      name: 'Neza',
      email: 'neza@example.com',
      role: 'CLIENT',
      phone: '+250712345678',
      phoneVerified: true,
      memberSince: '2025-01-15T00:00:00Z',
    },
    activeTrips: [
      { id: '1', route: 'Kigali → Musanze', date: '2026-06-30', status: 'CONFIRMED', seatNumber: 'A2', vehicle: 'RAB 123A' },
    ],
    recentBookings: [
      { id: '1', route: 'Kigali → Huye', date: '2026-06-20', amount: 300000, status: 'PAID' },
    ],
    wallet: { balance: 500000, status: 'ACTIVE' },
    parcels: [
      { id: '1', trackingCode: 'TR-9K2L-88X', route: 'Kigali → Huye', status: 'IN_TRANSIT' },
    ],
  }

  it('builds system prompt with user context', () => {
    const prompt = buildTrekSystemPrompt(mockContext)
    expect(prompt).toContain('Neza')
    expect(prompt).toContain('CLIENT')
    expect(prompt).toContain('+250712345678')
    expect(prompt).toContain('5,000 RWF')
    expect(prompt).toContain('Kigali → Musanze')
    expect(prompt).toContain('TR-9K2L-88X')
  })

  it('builds generic prompt when no context', () => {
    const prompt = buildTrekSystemPrompt(null)
    expect(prompt).toContain('Trek')
    expect(prompt).toContain('TapaRide')
    expect(prompt).not.toContain('Neza')
  })
})
