import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys, cacheTags } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import type { CreateParcelDto, UpdateParcelStatusDto } from './parcels.schema.js';

export async function createParcel(senderId: string, dto: CreateParcelDto) {
  // Resolve journeyId from station names if not provided directly
  let resolvedJourneyId = dto.journeyId;
  if (!resolvedJourneyId && dto.fromStation && dto.toStation) {
    const journey = await db.journey.findFirst({
      where: {
        sourceStation: { name: { contains: dto.fromStation, mode: 'insensitive' } },
        destinationStation: { name: { contains: dto.toStation, mode: 'insensitive' } },
        departureTime: { gte: new Date() },
      },
      orderBy: { departureTime: 'asc' },
      select: { id: true },
    });
    if (journey) resolvedJourneyId = journey.id;
  }

  if (!resolvedJourneyId) {
    throw new ValidationError('A valid journeyId or fromStation/toStation pair is required');
  }

  const parcel = await db.parcel.create({
    data: {
      senderId,
      journeyId: resolvedJourneyId,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      weight: dto.weight || null,
      fee: dto.weight ? Math.round(dto.weight * 2000) : null,
      notes: dto.notes,
    },
    include: { journey: { include: { sourceStation: { select: { name: true } }, destinationStation: { select: { name: true } } } } },
  });
  await publishDomainEvent("parcel.created", {
    parcelId: parcel.id,
    senderId,
  });
  return parcel;
}

export async function trackParcel(trackingCode: string) {
  return rememberJson(
    cacheKeys.parcelTracking(trackingCode),
    {
      ...cachePolicies.parcelTracking,
      tags: [cacheTags.parcels, cacheTags.parcelTracking(trackingCode)],
    },
    async () => {
      const parcel = await db.parcel.findUnique({
        where: { trackingCode },
        include: { journey: { include: { sourceStation: { select: { name: true } }, destinationStation: { select: { name: true } } } } },
      });
      if (!parcel) throw new NotFoundError('Parcel not found with this tracking code');
      return parcel;
    },
  );
}

export async function updateParcelStatus(parcelId: string, dto: UpdateParcelStatusDto, updaterId: string) {
  const updater = await db.user.findUniqueOrThrow({ where: { id: updaterId } });
  if (!['DRIVER', 'MANAGER', 'OWNER'].includes(updater.role)) {
    throw new AuthorizationError('Only DRIVER, MANAGER or OWNER can update parcel status');
  }

  // Fetch the parcel and its journey to check agency-level authorization
  const parcel = await db.parcel.findUniqueOrThrow({
    where: { id: parcelId },
    include: { journey: { include: { vehicle: { select: { agencyId: true, driverId: true } } } } },
  });

  // DRIVER can only update parcels on journeys they are assigned to
  if (updater.role === 'DRIVER' && parcel.journey.vehicle.driverId !== updaterId) {
    throw new AuthorizationError('You can only update parcels on journeys you are assigned to');
  }

  // MANAGER can only update parcels on journeys belonging to their managed agency
  if (updater.role === 'MANAGER') {
    const manager = await db.user.findUniqueOrThrow({ where: { id: updaterId } });
    if (manager?.managedAgencyId !== parcel.journey.vehicle.agencyId) {
      throw new AuthorizationError('You can only update parcels on journeys belonging to your agency');
    }
  }

  // OWNER can only update parcels on journeys belonging to their owned agencies
  if (updater.role === 'OWNER') {
    const isOwner = await db.agency.findFirst({
      where: {
        id: parcel.journey.vehicle.agencyId,
        ownerId: updaterId,
      },
    });
    if (!isOwner) {
      throw new AuthorizationError('You can only update parcels on journeys belonging to your owned agencies');
    }
  }

  const updatedParcel = await db.parcel.update({ where: { id: parcelId }, data: { status: dto.status } });
  await publishDomainEvent("parcel.updated", {
    trackingCode: updatedParcel.trackingCode,
    senderId: updatedParcel.senderId,
  });
  return updatedParcel;
}

export async function getUserParcels(
  userId: string,
  pagination: PaginationInput,
) {
  return rememberJson(
    cacheKeys.userParcels(userId, pagination),
    {
      ...cachePolicies.userParcels,
      tags: [cacheTags.userParcels(userId)],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const [parcels, total] = await Promise.all([
        db.parcel.findMany({
          where: { senderId: userId },
          include: { journey: { include: { sourceStation: { select: { name: true } }, destinationStation: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        db.parcel.count({ where: { senderId: userId } }),
      ]);

      return {
        items: parcels,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}
