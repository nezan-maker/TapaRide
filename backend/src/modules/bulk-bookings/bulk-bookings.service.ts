import { Prisma } from '@prisma/client';

import { db, runSerializable } from '../../lib/db.js';
import { env } from '../../config/env.js';
import {
  generateHash,
  generateSignature,
  verifySignature,
  encryptAtRest,
} from '../../lib/crypto.js';
import { generateQRCode } from '../../lib/qr.js';
import {
  sendBoardingNotification,
  sendAlightingNotification,
} from '../../lib/mailer.js';
import {
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from '../../lib/errors.js';
import { assertUuid } from '../../lib/uuid-validate.js';
import type { 
  CreateBulkBookingDto, 
  ValidateBoardingDto 
} from './bulk-bookings.schema.js';

async function acquireJourneySeatLock(
  tx: Prisma.TransactionClient,
  journeyId: string,
  seatNumber: number,
) {
  assertUuid(journeyId, 'journeyId');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`journey:${journeyId}:seat:${seatNumber}`}))`;
}

/**
 * Creates a bulk booking for an organization.
 * Generates a master QR code and individual passenger tokens.
 */
export async function createBulkBooking(userId: string, dto: CreateBulkBookingDto) {
  // 1. Verify organization ownership/management
  const org = await db.organization.findUnique({
    where: { id: dto.organizationId },
    select: { ownerId: true },
  });

  if (!org) throw new NotFoundError('Organization not found');
  if (org.ownerId !== userId) {
    throw new AuthorizationError('Unauthorized to create bookings for this organization');
  }

  const requestedSeats = dto.passengers
    .map((passenger) => passenger.seatNumber)
    .sort((a, b) => a - b);

  // 2. Cryptographic Generation
  const manifestHash = generateHash(dto.passengers);
  const signatureData = {
    organizationId: dto.organizationId,
    journeyId: dto.journeyId,
    manifestHash,
  };
  const signature = generateSignature(signatureData, env.HMAC_SECRET);

  // 3. Database Persistence
  const bulkBooking = await runSerializable(async (tx) => {
    for (const seatNumber of requestedSeats) {
      await acquireJourneySeatLock(tx, dto.journeyId, seatNumber);
    }

    const journey = await tx.journey.findUniqueOrThrow({
      where: { id: dto.journeyId },
      include: { vehicle: { select: { capacity: true } } },
    });

    const outOfRangeSeat = requestedSeats.find(
      (seatNumber) => seatNumber > journey.vehicle.capacity,
    );
    if (outOfRangeSeat) {
      throw new ValidationError(
        `Seat ${outOfRangeSeat} does not exist. Vehicle capacity: ${journey.vehicle.capacity}`,
      );
    }

    const [paidTicket, bulkPassenger] = await Promise.all([
      tx.ticket.findFirst({
        where: {
          journeyId: dto.journeyId,
          seatNumber: { in: requestedSeats },
          status: 'PAID',
        },
        select: { seatNumber: true },
      }),
      tx.bulkPassenger.findFirst({
        where: {
          seatNumber: { in: requestedSeats },
          bulkBooking: { journeyId: dto.journeyId },
        },
        select: { seatNumber: true },
      }),
    ]);
    if (paidTicket) {
      throw new ConflictError(`Seat ${paidTicket.seatNumber} is already sold`);
    }
    if (bulkPassenger) {
      throw new ConflictError(`Seat ${bulkPassenger.seatNumber} is already bulk booked`);
    }

    const booking = await tx.bulkBooking.create({
      data: {
        organizationId: dto.organizationId,
        journeyId: dto.journeyId,
        destination: dto.destination,
        departureTime: new Date(dto.departureTime),
        manifestHash,
        signature,
      },
    });

    const passengers = await Promise.all(dto.passengers.map(async (p) => {
      // Individual boarding token (passengerId + bookingId + seat + nationalId)
      const boardingHash = generateHash(`${p.nationalId}${booking.id}${p.seatNumber}`);
      
      return tx.bulkPassenger.create({
        data: {
          bulkBookingId: booking.id,
          name: p.name,
          nationalId: encryptAtRest(p.nationalId),
          seatNumber: p.seatNumber,
          boardingHash,
          parentPhone: p.parentPhone,
          parentEmail: p.parentEmail,
        },
      });
    }));

    return { ...booking, passengers };
  });

  // 4. Generate Master QR Code (Extended format Version 40)
  const masterQRData = {
    bookingId: bulkBooking.id,
    destination: bulkBooking.destination,
    totalPassengers: bulkBooking.passengers.length,
    organizationId: bulkBooking.organizationId,
    manifestHash: bulkBooking.manifestHash,
    signature: bulkBooking.signature,
    timestamp: bulkBooking.createdAt,
  };

  const masterQR = await generateQRCode(masterQRData);

  // 5. Generate individual QR codes for each passenger
  const passengerQRs = await Promise.all(bulkBooking.passengers.map(async (p) => {
    const passengerQRData = {
      type: 'PASSENGER',
      passengerId: p.id,
      boardingHash: p.boardingHash,
      journeyId: bulkBooking.journeyId,
      seatNumber: p.seatNumber,
    };
    const passengerQR = await generateQRCode(passengerQRData);
    return {
      id: p.id,
      name: p.name,
      seatNumber: p.seatNumber,
      boardingHash: p.boardingHash,
      qrCode: passengerQR,
    };
  }));

  return {
    bookingId: bulkBooking.id,
    masterQR,
    passengers: passengerQRs,
  };
}

/**
 * Validates a boarding attempt (Master scan or individual scan).
 */
export async function validateBoarding(user: { id: string; role: string }, dto: ValidateBoardingDto) {
  let targetJourneyId: string;

  if (dto.type === 'MASTER') {
    if (!dto.bookingId || !dto.signature) {
      throw new ValidationError('Master scan requires bookingId and signature');
    }

    const booking = await db.bulkBooking.findUnique({
      where: { id: dto.bookingId },
      select: { manifestHash: true, organizationId: true, journeyId: true },
    });

    if (!booking) throw new NotFoundError('Booking not found');

    // Verify HMAC signature
    const signatureData = {
      organizationId: booking.organizationId,
      journeyId: booking.journeyId,
      manifestHash: booking.manifestHash,
    };

    const isValid = verifySignature(signatureData, dto.signature, env.HMAC_SECRET);
    if (!isValid) throw new AuthenticationError('Invalid master signature');

    targetJourneyId = booking.journeyId;

    // Security Check: Verify the driver scanning the code is assigned to this journey
    if (user.role === 'DRIVER') {
      const journey = await db.journey.findUnique({
        where: { id: targetJourneyId },
        select: { vehicle: { select: { driverId: true } } },
      });

      if (journey?.vehicle?.driverId !== user.id) {
        throw new AuthorizationError('WRONG BUS! You are not the assigned driver for this journey.');
      }
    }

    // Record master scan event
    await db.boardingEvent.create({
      data: {
        bulkBookingId: dto.bookingId,
        type: 'MASTER_SCAN',
        location: dto.location,
      },
    });

    return { success: true, message: 'Master QR verified' };
  } else {
    // Passenger individual scan - supports both boardingHash and passengerId
    let passenger;
    
    if (dto.passengerId) {
      // Direct passenger ID lookup (from individual QR code)
      passenger = await db.bulkPassenger.findUnique({
        where: { id: dto.passengerId },
        include: { bulkBooking: true },
      });
    } else if (dto.boardingHash) {
      // Legacy boardingHash lookup
      passenger = await db.bulkPassenger.findUnique({
        where: { boardingHash: dto.boardingHash },
        include: { bulkBooking: true },
      });
    } else {
      throw new ValidationError('Passenger scan requires either passengerId or boardingHash');
    }

    if (!passenger) throw new NotFoundError('Passenger boarding token not found');

    if (passenger.status === 'BOARDED') {
      return { success: true, message: `Passenger ${passenger.name} already boarded` };
    }

    if (passenger.status === 'ALIGHTED') {
      throw new ValidationError(`Passenger ${passenger.name} has already alighted`);
    }

    targetJourneyId = passenger.bulkBooking.journeyId;

    // Security Check: Verify the driver scanning the code is assigned to this journey
    if (user.role === 'DRIVER') {
      const journey = await db.journey.findUnique({
        where: { id: targetJourneyId },
        select: { vehicle: { select: { driverId: true } } },
      });

      if (journey?.vehicle?.driverId !== user.id) {
        throw new AuthorizationError('WRONG BUS! You are not the assigned driver for this journey.');
      }
    }

    // Update status to BOARDED
    await db.bulkPassenger.update({
      where: { id: passenger.id },
      data: { status: 'BOARDED' },
    });

    // Record passenger scan event
    await db.boardingEvent.create({
      data: {
        passengerId: passenger.id,
        bulkBookingId: passenger.bulkBookingId,
        type: 'PASSENGER_SCAN',
        location: dto.location,
      },
    });

    // Trigger Safe Arrival Notification
    if (passenger.parentPhone || passenger.parentEmail) {
      await sendBoardingNotification(
        { phone: passenger.parentPhone ?? undefined, email: passenger.parentEmail ?? undefined },
        passenger.name
      );
    }

    return { success: true, message: `Passenger ${passenger.name} boarded` };
  }
}

/**
 * Marks a passenger as alighted (safely arrived).
 */
export async function markAsAlighted(passengerId: string, userId: string) {
  const passenger = await db.bulkPassenger.findUniqueOrThrow({
    where: { id: passengerId },
  });

  // SECURITY: Verify the user is authorized for this trip
  const bulkBooking = await db.bulkBooking.findUniqueOrThrow({
    where: { id: passenger.bulkBookingId },
    select: { journeyId: true },
  });

  const journey = await db.journey.findUniqueOrThrow({
    where: { id: bulkBooking.journeyId },
    select: { vehicle: { select: { driverId: true, agencyId: true } } },
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const isAuthorized =
    journey.vehicle.driverId === userId ||
    (user.role === 'MANAGER' && user.managedAgencyId === journey.vehicle.agencyId) ||
    user.role === 'OWNER';

  if (!isAuthorized) throw new AuthorizationError('Unauthorized: You are not assigned to this journey');

  await db.bulkPassenger.update({
    where: { id: passengerId },
    data: { status: 'ALIGHTED' },
  });

  // Trigger Safe Arrival Notification
  if (passenger.parentPhone || passenger.parentEmail) {
    await sendAlightingNotification(
      { phone: passenger.parentPhone ?? undefined, email: passenger.parentEmail ?? undefined },
      passenger.name
    );
  }

  return { success: true, message: `${passenger.name} safely arrived` };
}

export async function createOrganization(userId: string, name: string) {
  if (!name || name.trim().length < 2) {
    throw new ValidationError('Organization name must be at least 2 characters');
  }

  const existing = await db.organization.findFirst({
    where: { name, ownerId: userId },
  });
  if (existing) {
    throw new ConflictError('You have already registered an organization with this name');
  }

  const organization = await db.organization.create({
    data: {
      name,
      ownerId: userId,
    },
  });

  return { success: true, organization };
}

export async function getMyOrganizations(userId: string) {
  const organizations = await db.organization.findMany({
    where: { ownerId: userId },
  });
  return { organizations };
}

export async function listBulkBookings(userId: string, organizationId?: string) {
  const where: any = {};
  if (organizationId) {
    where.organizationId = organizationId;
    // Verify user owns this org
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (!org) throw new NotFoundError('Organization not found');
    if (org.ownerId !== userId) throw new AuthorizationError('Unauthorized');
  } else {
    // List bookings across all user's orgs
    const orgs = await db.organization.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    where.organizationId = { in: orgs.map(o => o.id) };
  }

  const bookings = await db.bulkBooking.findMany({
    where,
    include: {
      passengers: {
        select: { id: true, name: true, seatNumber: true, status: true, parentPhone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { bookings };
}

