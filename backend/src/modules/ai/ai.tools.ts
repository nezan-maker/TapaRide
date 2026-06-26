import { z } from 'zod';
import { db } from '../../lib/db.js';
import { getUserParcels, quoteParcel } from '../../modules/parcels/parcels.service.js';
import { getUserTickets } from '../../modules/tickets/tickets.service.js';
import { ValidationError } from '../../lib/errors.js';
import type { AiUserContext } from './ai.context.js';

/**
 * AI tool definitions for Phase 2.
 *
 * Design principle: tools wrap existing service code. They never duplicate
 * business logic (pricing, RBAC, wallet encryption). The model picks a tool,
 * your code executes it, the model explains the result in plain language.
 *
 * All tools are READ-ONLY. Destructive actions (booking, payment, parcel send)
 * are deliberately excluded — the assistant directs users to the app screens.
 */

/** Every tool shares this execute signature so they can be stored in a uniform array. */
type ToolExecute = (input: any, context: AiUserContext) => Promise<unknown>;

// ── Station name resolution ────────────────────────────────────────────────

async function resolveStationId(name: string): Promise<string | null> {
  const station = await db.station.findFirst({
    where: { name: { contains: name, mode: 'insensitive' } },
    select: { id: true },
  });
  return station?.id ?? null;
}

// ── Tool: searchJourneys ──────────────────────────────────────────────────

export const searchJourneysTool = {
  name: 'searchJourneys',
  description:
    'Search available intercity bus journeys between two stations. Returns journeys with route, departure time, price, and available seats. Use when the user asks about routes, bus schedules, or ticket prices.',
  inputSchema: z.object({
    from: z.string().describe('Departure station name or city, e.g. "Kigali" or "Nyabugogo"'),
    to: z.string().describe('Destination station name or city, e.g. "Huye" or "Musanze"'),
  }),
  execute: (async (input: any, _context: AiUserContext) => {
    const sourceId = await resolveStationId(input.from);
    const destId = await resolveStationId(input.to);

    if (!sourceId || !destId) {
      const missing = !sourceId ? `"${input.from}"` : `"${input.to}"`;
      return {
        error: true,
        message: `No station found matching ${missing}. Try the exact station name.`,
      };
    }

    const journeys = await db.journey.findMany({
      where: {
        sourceStationId: sourceId,
        destinationStationId: destId,
        departureTime: { gte: new Date() },
      },
      include: {
        sourceStation: { select: { name: true } },
        destinationStation: { select: { name: true } },
        vehicle: { select: { plateNumber: true, capacity: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { departureTime: 'asc' },
      take: 10,
    });

    if (journeys.length === 0) {
      return {
        error: false,
        message: `No upcoming journeys from ${input.from} to ${input.to}. The route may not be running or all departures have passed.`,
        journeys: [],
      };
    }

    return {
      error: false,
      message: `Found ${journeys.length} journey(s) from ${journeys[0].sourceStation.name} to ${journeys[0].destinationStation.name}.`,
      journeys: journeys.map((j) => ({
        id: j.id,
        from: j.sourceStation.name,
        to: j.destinationStation.name,
        departureTime: j.departureTime,
        price: j.price,
        priceFormatted: `${j.price.toLocaleString()} RWF`,
        vehicle: j.vehicle.plateNumber,
        capacity: j.vehicle.capacity,
        ticketsSold: j._count.tickets,
      })),
    };
  }) satisfies ToolExecute,
};

// ── Tool: quoteParcel ─────────────────────────────────────────────────────

export const quoteParcelTool = {
  name: 'quoteParcel',
  description:
    'Calculate the fee for sending a parcel between two stations. Use when the user asks how much parcel delivery costs.',
  inputSchema: z.object({
    from: z.string().describe('Origin station or city'),
    to: z.string().describe('Destination station or city'),
    weight: z.number().positive().optional().describe('Weight in kg (default 1)'),
  }),
  execute: (async (input: any, _context: AiUserContext) => {
    try {
      const result = await quoteParcel({
        fromStation: input.from,
        toStation: input.to,
        weight: input.weight ?? 1,
      });
      return {
        error: false,
        message: `Parcel from ${result.from} to ${result.to} (${result.weightKg}kg) costs ${result.fee.toLocaleString()} RWF.`,
        quote: {
          from: result.from,
          to: result.to,
          weightKg: result.weightKg,
          fee: result.fee,
          feeFormatted: `${result.fee.toLocaleString()} RWF`,
          band: result.band.label,
          basePrice: result.basePrice,
        },
      };
    } catch (err) {
      return {
        error: true,
        message: err instanceof ValidationError ? err.message : 'Could not compute parcel quote.',
      };
    }
  }) satisfies ToolExecute,
};

// ── Tool: trackParcel ─────────────────────────────────────────────────────

export const trackParcelTool = {
  name: 'trackParcel',
  description:
    'Look up the status of a parcel by its 12-character claim key. Use when the user asks about parcel delivery status or cannot find their parcel.',
  inputSchema: z.object({
    claimKey: z.string().min(8).max(20).describe('The parcel claim key, e.g. "AB3D-EFGH-JKM"'),
  }),
  execute: (async (input: any, _context: AiUserContext) => {
    try {
      const { startClaimParcel } = await import('../../modules/parcels/parcels.service.js');
      const preview = await startClaimParcel(input.claimKey.trim().toUpperCase());

      return {
        error: false,
        message: `Parcel for ${preview.receiverName} from ${preview.from} to ${preview.to} is ${preview.status}.`,
        parcel: {
          receiverName: preview.receiverName,
          status: preview.status,
          from: preview.from,
          to: preview.to,
          weight: preview.weight ? `${preview.weight}kg` : 'unknown',
          fee: preview.fee ? `${preview.fee.toLocaleString()} RWF` : 'pending',
          trackingCode: preview.trackingCode,
          expiresAt: preview.expiresAt,
        },
      };
    } catch (err) {
      return {
        error: true,
        message: err instanceof ValidationError ? err.message : 'Parcel not found. Check the claim key and try again.',
      };
    }
  }) satisfies ToolExecute,
};

// ── Tool: getWalletStatus ─────────────────────────────────────────────────

export const getWalletStatusTool = {
  name: 'getWalletStatus',
  description:
    'Get the current user wallet status (initialized, locked/unlocked). For balance, the user must unlock the wallet first. Use when the user asks about their wallet state or why a payment is blocked.',
  inputSchema: z.object({}),
  execute: (async (_input: any, context: AiUserContext) => {
    if (!context.isAuthenticated) {
      return {
        error: true,
        message: 'User must be logged in to check wallet status.',
      };
    }
    return {
      error: false,
      message: 'Ask the user to open Dashboard → Payments to see their current balance and unlock if needed.',
      guidance: 'Wallet balance is encrypted. The user must unlock with their wallet password to view it.',
    };
  }) satisfies ToolExecute,
};

// ── Tool: listMyTrips ─────────────────────────────────────────────────────

export const listMyTripsTool = {
  name: 'listMyTrips',
  description:
    'List the logged-in user most recent trip bookings. Use when the user asks "what trips do I have" or "show my bookings".',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(10).default(5).describe('Number of recent trips to return'),
  }),
  execute: (async (input: any, context: AiUserContext) => {
    if (!context.isAuthenticated || !context.userId) {
      return {
        error: true,
        message: 'User must be logged in to see their trips.',
      };
    }

    const result = await getUserTickets(context.userId, {
      page: 1,
      pageSize: input.limit ?? 5,
    });

    if (result.items.length === 0) {
      return {
        error: false,
        message: 'You have no trip bookings yet. Search for routes on the home page to book your first trip!',
        trips: [],
      };
    }

    return {
      error: false,
      message: `You have ${result.total} trip booking(s). Here are the most recent:`,
      trips: result.items.map((t) => ({
        id: t.id,
        from: t.journey.sourceStation.name,
        to: t.journey.destinationStation.name,
        departureTime: t.journey.departureTime,
        status: t.status,
        seatNumber: t.seatNumber,
        agency: t.journey.vehicle?.agency?.name ?? 'TapaRide',
      })),
    };
  }) satisfies ToolExecute,
};

// ── Tool: listMyParcels ───────────────────────────────────────────────────

export const listMyParcelsTool = {
  name: 'listMyParcels',
  description:
    'List the logged-in user sent parcels. Use when the user asks "what parcels did I send" or "show my parcels".',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(10).default(5).describe('Number of recent parcels to return'),
  }),
  execute: (async (input: any, context: AiUserContext) => {
    if (!context.isAuthenticated || !context.userId) {
      return {
        error: true,
        message: 'User must be logged in to see their parcels.',
      };
    }

    const result = await getUserParcels(context.userId, {
      page: 1,
      pageSize: input.limit ?? 5,
    });

    if (result.items.length === 0) {
      return {
        error: false,
        message: 'You have not sent any parcels yet. Go to /send-parcel to send your first one!',
        parcels: [],
      };
    }

    return {
      error: false,
      message: `You have sent ${result.total} parcel(s). Here are the most recent:`,
      parcels: result.items.map((p) => ({
        id: p.id,
        receiverName: p.receiverName,
        from: p.journey.sourceStation.name,
        to: p.journey.destinationStation.name,
        status: p.status,
        trackingCode: p.trackingCode,
        claimKey: p.claimKey ?? 'pending',
        fee: p.fee ? `${p.fee.toLocaleString()} RWF` : 'pending',
      })),
    };
  }) satisfies ToolExecute,
};

// ── Tool registry ─────────────────────────────────────────────────────────

export const AI_TOOLS = [
  searchJourneysTool,
  quoteParcelTool,
  trackParcelTool,
  getWalletStatusTool,
  listMyTripsTool,
  listMyParcelsTool,
] as const;

export type AiToolName = (typeof AI_TOOLS)[number]['name'];

/** Union of all tool input schemas, indexed by name. */
export const AI_TOOL_SCHEMAS: Record<string, z.ZodObject<z.ZodRawShape>> = Object.fromEntries(
  AI_TOOLS.map((t) => [t.name, t.inputSchema]),
);
