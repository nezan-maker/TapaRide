import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys, cacheTags } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import { publishRealtimeEvent } from '../../lib/socket-bus.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import { processWaitlist } from '../waitlist/waitlist.service.js';
import type { CreateJourneyDto } from './journeys.schema.js';
import {
  AuthorizationError,
  ValidationError,
} from '../../lib/errors.js';

export async function createJourney(managerId: string, dto: CreateJourneyDto) {
  const manager = await db.user.findUniqueOrThrow({ where: { id: managerId } });
  if (manager.role !== 'MANAGER') throw new AuthorizationError('Only MANAGERs can create journeys');
  if (!manager.managedAgencyId) {
    throw new AuthorizationError('Manager is not assigned to an agency');
  }
  if (dto.sourceStationId === dto.destinationStationId) {
    throw new ValidationError('Source and destination stations must be different');
  }
  const departureTime = new Date(dto.departureTime);
  if (departureTime.getTime() <= Date.now()) {
    throw new ValidationError('Departure time must be in the future');
  }

  const [sourceStation, destinationStation, vehicle] = await Promise.all([
    db.station.findUniqueOrThrow({
      where: { id: dto.sourceStationId },
      select: { agencyId: true },
    }),
    db.station.findUniqueOrThrow({
      where: { id: dto.destinationStationId },
      select: { agencyId: true },
    }),
    db.vehicle.findUniqueOrThrow({
      where: { id: dto.vehicleId },
      select: { agencyId: true },
    }),
  ]);

  const agencyIds = [
    sourceStation.agencyId,
    destinationStation.agencyId,
    vehicle.agencyId,
  ];
  if (agencyIds.some((agencyId) => agencyId !== manager.managedAgencyId)) {
    throw new AuthorizationError(
      'Managers can only create journeys using stations and vehicles from their managed agency',
    );
  }

  const journey = await db.journey.create({
    data: {
      sourceStationId: dto.sourceStationId,
      destinationStationId: dto.destinationStationId,
      vehicleId: dto.vehicleId,
      departureTime,
      price: dto.price,
    },
    include: {
      sourceStation: { select: { name: true } },
      destinationStation: { select: { name: true } },
      vehicle: { select: { plateNumber: true, capacity: true } },
    },
  });

  await publishDomainEvent("journey.created", { journeyId: journey.id });
  return journey;
}

export async function listJourneys(
  pagination: PaginationInput,
  sourceId?: string,
  destId?: string,
) {
  return rememberJson(
    cacheKeys.journeysList(sourceId, destId, pagination),
    {
      ...cachePolicies.journeysList,
      tags: [cacheTags.journeys],
    },
    async () => {
      // When sourceId or destId are empty strings, treat as missing
      const effectiveSourceId = sourceId || undefined
      const effectiveDestId = destId || undefined

      const { page, pageSize, skip, take } = toPagination(pagination);
      const where = {
        ...(effectiveSourceId ? { sourceStationId: effectiveSourceId } : {}),
        ...(effectiveDestId ? { destinationStationId: effectiveDestId } : {}),
        departureTime: { gte: new Date() },
      };

      const [journeys, total] = await Promise.all([
        db.journey.findMany({
          where,
          include: {
            sourceStation: { select: { id: true, name: true, location: true } },
            destinationStation: { select: { id: true, name: true, location: true } },
            vehicle: { select: { plateNumber: true, capacity: true, amenities: true, seatLayout: true, agency: { select: { name: true } } } },
            _count: { select: { tickets: true } },
          },
          orderBy: { departureTime: 'asc' },
          skip,
          take,
        }),
        db.journey.count({ where }),
      ]);

      return {
        items: journeys,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}

export async function getJourneyAvailability(journeyId: string) {
  return rememberJson(
    cacheKeys.journeyAvailability(journeyId),
    {
      ...cachePolicies.journeyAvailability,
      tags: [cacheTags.journeys, cacheTags.journey(journeyId)],
    },
    async () => {
      const journey = await db.journey.findUniqueOrThrow({
        where: { id: journeyId },
        include: {
          sourceStation: { select: { id: true, name: true, location: true } },
          destinationStation: { select: { id: true, name: true, location: true } },
          vehicle: { select: { id: true, plateNumber: true, model: true, capacity: true } },
          tickets: { select: { seatNumber: true, status: true } },
          bulkBookings: {
            select: {
              passengers: { select: { seatNumber: true } },
            },
          },
        },
      });

      const soldSeats = journey.tickets
        .filter((t: any) => t.status === 'PAID')
        .map((t: any) => t.seatNumber);
      const bulkBookedSeats = journey.bulkBookings.flatMap((booking) =>
        booking.passengers.map((passenger) => passenger.seatNumber),
      );
      const occupiedSeats = Array.from(new Set([...soldSeats, ...bulkBookedSeats]));

      const availableSeats = Array.from(
        { length: journey.vehicle.capacity },
        (_, i) => i + 1,
      ).filter((seat) => !occupiedSeats.includes(seat));

      return {
        journeyId,
        journey: {
          id: journey.id,
          sourceStationId: journey.sourceStationId,
          sourceStation: journey.sourceStation,
          destinationStationId: journey.destinationStationId,
          destinationStation: journey.destinationStation,
          vehicleId: journey.vehicleId,
          vehicle: journey.vehicle,
          departureTime: journey.departureTime,
          price: journey.price,
          createdAt: journey.createdAt,
        },
        vehicle: journey.vehicle,
        totalCapacity: journey.vehicle.capacity,
        bookedSeats: occupiedSeats,
        soldSeats,
        bulkBookedSeats,
        availableSeats,
      };
    },
  );
}

export async function getJourneyDetail(journeyId: string) {
  return rememberJson(
    cacheKeys.journeyAvailability(journeyId),
    {
      ...cachePolicies.journeyAvailability,
      tags: [cacheTags.journeys, cacheTags.journey(journeyId)],
    },
    async () => {
      const journey = await db.journey.findUniqueOrThrow({
        where: { id: journeyId },
        include: {
          sourceStation: { select: { id: true, name: true, location: true } },
          destinationStation: { select: { id: true, name: true, location: true } },
          vehicle: {
            select: {
              id: true,
              plateNumber: true,
              model: true,
              capacity: true,
              amenities: true,
              seatLayout: true,
              agency: { select: { id: true, name: true, verified: true } },
            },
          },
          _count: { select: { tickets: true } },
        },
      });

      return {
        ...journey,
        estimatedArrival: new Date(new Date(journey.departureTime).getTime() + 4 * 60 * 60 * 1000),
      };
    },
  );
}

/**
 * Marks a stop as reached and notifies the driver of alighting passengers.
 */
export async function markStopAsReached(userId: string, journeyId: string, stationId: string) {
  const timestamp = new Date();

  // SECURITY: Verify the user is authorized for this specific trip
  const journey = await db.journey.findUniqueOrThrow({
    where: { id: journeyId },
    include: { vehicle: { select: { agencyId: true, driverId: true } } }
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const isAuthorized = 
    journey.vehicle.driverId === userId || 
    (user.role === 'MANAGER' && user.managedAgencyId === journey.vehicle.agencyId) ||
    user.role === 'OWNER';

  if (!isAuthorized) throw new AuthorizationError('Unauthorized: This trip does not belong to your agency');

  // 1. Update DB stop status
  await db.journeyStop.updateMany({
    where: { journeyId, stationId },
    data: { reachedAt: timestamp },
  });

  // 2. Fetch passengers who chose this as their alighting stop
  const passengersAlighting = await db.ticket.findMany({
    where: { journeyId, alightingStopId: stationId, status: 'PAID' },
    select: { id: true, userId: true, seatNumber: true },
  });

  // 3. Emit real-time event to the trip's room
  await publishRealtimeEvent({
    room: `trip:${journeyId}`,
    event: 'stop:reached',
    payload: {
      tripId: journeyId,
      stopId: stationId,
      timestamp,
      alightingPassengers: passengersAlighting,
    },
  });

  return { 
    message: 'Stop marked as reached', 
    alightingCount: passengersAlighting.length 
  };
}

/**
 * Confirms a passenger has alighted, freeing their seat and triggering the waitlist.
 */
export async function confirmAlighting(userId: string, ticketId: string, journeyId: string, stationId: string, seatNumber: number) {
  // SECURITY: Verify authorization
  const journey = await db.journey.findUniqueOrThrow({
    where: { id: journeyId },
    include: { vehicle: { select: { agencyId: true, driverId: true } } }
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const isAuthorized = 
    journey.vehicle.driverId === userId || 
    (user.role === 'MANAGER' && user.managedAgencyId === journey.vehicle.agencyId);

  if (!isAuthorized) throw new AuthorizationError('Unauthorized access to this trip data');
  
  // Notify participants of safe alighting
  await publishRealtimeEvent({
    room: `trip:${journeyId}`,
    event: 'passenger:safe',
    payload: { ticketId, timestamp: new Date() },
  });

  // Free the seat and notify waitlist for this stop
  await processWaitlist(journeyId, stationId, seatNumber);
  await publishDomainEvent("journey.updated", { journeyId });

  return { success: true, message: 'Alighting confirmed and seat freed' };
}
