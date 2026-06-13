import { db } from '../../lib/db.js';
import { withRedisLock } from '../../lib/lock.js';
import { redis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import { getCandidateStopIds } from './waitlist.utils.js';
import { getWaitlistQueue } from './waitlist.queue.js';
import { publishRealtimeEvent } from '../../lib/socket-bus.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';

/**
 * Adds a user to the waitlist for a specific journey and boarding stop.
 */
export async function addToWaitlist(userId: string, journeyId: string, boardingStopId: string) {
  const journey = await db.journey.findUnique({
    where: { id: journeyId },
    include: {
      tickets: {
        where: { userId, status: 'PAID' },
        select: { id: true },
      },
      stops: {
        where: { stationId: boardingStopId },
        select: { id: true },
      },
    },
  });
  if (!journey) throw new NotFoundError('Journey not found');
  if (journey.tickets.length > 0) {
    throw new ConflictError('You already hold a paid ticket for this journey');
  }
  if (journey.stops.length === 0) {
    throw new ValidationError('Boarding stop does not belong to this journey');
  }

  const existingEntry = await db.waitlistEntry.findFirst({
    where: {
      userId,
      journeyId,
      boardingStopId,
      status: { in: ['PENDING', 'NOTIFIED'] },
    },
  });
  if (existingEntry) {
    throw new ConflictError('You are already on the waitlist for this stop');
  }

  // 2. Create DB entry
  const entry = await db.waitlistEntry.create({
    data: {
      userId,
      journeyId,
      boardingStopId,
      status: 'PENDING',
    },
  });

  // 3. Add to Redis Sorted Set for FIFO ordering per stop
  const queueKey = `waitlist:journey:${journeyId}:stop:${boardingStopId}`;
  await redis.zadd(queueKey, Date.now(), userId);

  // 4. Cache total count for O(1) status checks
  const position = await redis.zrank(queueKey, userId);

  return { 
    message: 'Added to waitlist', 
    waitlistId: entry.id, 
    position: (position ?? 0) + 1 
  };
}

function calculateDistanceInternal(lat1: number | null, lon1: number | null, lat2: number, lon2: number): number | null {
  if (lat1 === null || lon1 === null) return null;

  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Triggered when a seat becomes available (passenger alights).
 * Checks the waitlist for the current and upcoming stops.
 */
export async function processWaitlist(journeyId: string, stopId: string, seatNumber: number) {
  await withRedisLock(
    `waitlist:process:${journeyId}:seat:${seatNumber}`,
    5,
    async () => {
      const stops = await db.journeyStop.findMany({
        where: { journeyId },
        select: { stationId: true, order: true },
      });

      const candidateStopIds = getCandidateStopIds(stops, stopId);

      for (const candidateStopId of candidateStopIds) {
        const queueKey = `waitlist:journey:${journeyId}:stop:${candidateStopId}`;
        const nextUser = await redis.zpopmin(queueKey);
        if (nextUser.length === 0) {
          continue;
        }

        const userId = nextUser[0];
        if (!userId) {
          continue;
        }

        try {
          await getWaitlistQueue().add(`notify:${journeyId}:${seatNumber}:${userId}`, {
            kind: 'notify-seat',
            userId,
            journeyId,
            seatNumber,
            boardingStopId: candidateStopId,
          });
        } catch (err) {
          logger.error(
            { err, userId, journeyId, seatNumber, candidateStopId },
            'Failed to add waitlist notification job to queue',
          );
          throw err;
        }

        await db.waitlistEntry.updateMany({
          where: {
            userId,
            journeyId,
            boardingStopId: candidateStopId,
            status: 'PENDING',
          },
          data: { status: 'NOTIFIED' },
        });

        return;
      }
    },
  );
}

/**
 * Returns the current waitlist position for a user.
 */
export async function getWaitlistStatus(userId: string, journeyId: string, stopId: string) {
  const queueKey = `waitlist:journey:${journeyId}:stop:${stopId}`;
  const rank = await redis.zrank(queueKey, userId);
  
  if (rank === null) return { inQueue: false };
  return { inQueue: true, position: rank + 1 };
}

export async function getUserWaitlist(userId: string) {
  const entries = await db.waitlistEntry.findMany({
    where: { userId },
    include: {
      journey: {
        include: {
          sourceStation: { select: { id: true, name: true, location: true } },
          destinationStation: { select: { id: true, name: true, location: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    items: await Promise.all(
      entries.map(async (entry) => {
        const rank = await redis.zrank(
          `waitlist:journey:${entry.journeyId}:stop:${entry.boardingStopId}`,
          userId,
        );
        return {
          ...entry,
          position: rank === null ? null : rank + 1,
        };
      }),
    ),
  };
}

export async function cancelWaitlistEntry(userId: string, id: string) {
  const entry = await db.waitlistEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) {
    throw new NotFoundError('Waitlist entry not found');
  }
  if (!['PENDING', 'NOTIFIED'].includes(entry.status)) {
    return { message: 'Waitlist entry is no longer active' };
  }

  await Promise.all([
    db.waitlistEntry.update({
      where: { id },
      data: { status: 'CANCELLED' },
    }),
    redis.zrem(`waitlist:journey:${entry.journeyId}:stop:${entry.boardingStopId}`, userId),
  ]);

  return { message: 'Waitlist entry cancelled' };
}

/**
 * Checks if there are more stops after the current one for waitlist processing.
 */
export async function getUpcomingCandidateStops(journeyId: string, currentStopId: string): Promise<string[]> {
  const stops = await db.journeyStop.findMany({
    where: { journeyId },
    select: { stationId: true, order: true },
  });

  const currentStop = stops.find((stop) => stop.stationId === currentStopId);
  if (!currentStop) return [];

  return stops
    .filter((stop) => stop.order > currentStop.order)
    .sort((left, right) => left.order - right.order)
    .map((stop) => stop.stationId);
}

/**
 * Passenger confirms alighting at destination, freeing their seat and triggering waitlist.
 */
export async function approveAlighting(
  userId: string,
  ticketId: string,
) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      journey: {
        include: {
          vehicle: { select: { driverId: true, agencyId: true } },
          destinationStation: { select: { id: true, location: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.userId !== userId) {
    throw new ValidationError('This ticket does not belong to you');
  }

  if (ticket.status === 'CANCELLED') {
    throw new ValidationError('Cannot approve alighting for a cancelled ticket');
  }

  const journey = ticket.journey;
  const destinationStation = journey.destinationStation;

  const recentLogs = await db.tripPositionLog.findMany({
    where: { journeyId: journey.id },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });

if (recentLogs.length === 0) {
    throw new ValidationError('Bus location not available. Please ask driver to confirm alighting.');
  }

  const latestPosition = recentLogs[0]!; // Safe after length check
  const locationParts = destinationStation.location.split(',');
  const [destLat, destLng] = [parseFloat(locationParts[0] || '0'), parseFloat(locationParts[1] || '0')];

  if (isNaN(destLat) || isNaN(destLng)) {
    throw new ValidationError('Invalid destination location data');
  }

  const distance = calculateDistanceInternal(latestPosition.lat ?? null, latestPosition.lng ?? null, destLat, destLng);
  if (distance === null) {
    throw new ValidationError('Bus position data not available');
  }

  const proximityThreshold = 200;
  if (distance > proximityThreshold) {
    throw new ValidationError(
      `You must be near the destination station to confirm alighting. Current distance: ${Math.round(distance)}m`,
    );
  }

  const entry = await db.waitlistEntry.findFirst({
    where: {
      userId,
      journeyId: journey.id,
      status: { in: ['NOTIFIED', 'PENDING'] },
    },
  });

  if (entry && entry.status === 'NOTIFIED') {
    const reservationKey = `reserve:journey:${journey.id}:seat:${ticket.seatNumber}`;
    const reservedForUser = await redis.get(reservationKey);
    if (reservedForUser === userId) {
      await redis.del(reservationKey);
    }
    await db.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'CANCELLED' },
    });
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { status: 'CANCELLED' },
  });

  await publishRealtimeEvent({
    room: `user:${userId}`,
    event: 'ticket:alighted',
    payload: { ticketId, journeyId: journey.id, timestamp: new Date() },
  });

  await processWaitlist(journey.id, destinationStation.id, ticket.seatNumber);

  return { success: true, message: 'Alighting confirmed, seat freed for waitlist' };
}

/**
 * Gets the first journey stop ID for a given journey.
 */
export async function getFirstJourneyStop(journeyId: string): Promise<string | null> {
  const firstStop = await db.journeyStop.findFirst({
    where: { journeyId },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  return firstStop?.id || null;
}
