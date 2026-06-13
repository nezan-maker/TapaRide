import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { env } from '../../config/env.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import {
  AuthorizationError,
  ExternalProviderError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import type { CreateAgencyDto, AssignManagerDto, AssignDriverDto } from './agencies.schema.js';

/** Calls the (mock) RURA external API to verify an owner's agency. */
async function verifyWithRura(ruraCode: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.RURA_API_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.RURA_API_KEY },
      body: JSON.stringify({ ruraCode }),
    });
    if (!res.ok) {
      throw new ExternalProviderError('RURA verification provider rejected the request');
    }
    const data = (await res.json()) as { verified: boolean };
    return data.verified;
  } catch (error) {
    if (error instanceof ExternalProviderError) throw error;
    throw new ExternalProviderError('RURA verification provider is unavailable');
  }
}

export async function createAgency(ownerId: string, dto: CreateAgencyDto) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  if (owner.role !== 'OWNER') throw new AuthorizationError('Only OWNER users can register agencies');

  // Verify with RURA
  const verified = await verifyWithRura(dto.ruraCode);
  if (!verified) throw new ValidationError('RURA verification failed. Invalid or unrecognized RURA code.');

  const agency = await db.agency.create({
    data: { name: dto.name, ownerId, verified: true },
  });

  await publishDomainEvent("agency.created", {
    agencyId: agency.id,
    ownerId,
  });
  return agency;
}

export async function listAgencies(pagination: PaginationInput) {
  return rememberJson(
    cacheKeys.agenciesList(pagination),
    {
      ...cachePolicies.agenciesList,
      tags: ["agencies"],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const [agencies, total] = await Promise.all([
        db.agency.findMany({
          select: {
            id: true,
            name: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
            ownerId: true,
            _count: { select: { vehicles: true, stations: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        db.agency.count(),
      ]);

      return {
        items: agencies,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}

export async function getAgency(id: string) {
  return rememberJson(
    cacheKeys.agency(id),
    {
      ...cachePolicies.agencyDetail,
      tags: ["agencies", `agency:${id}`],
    },
    () =>
      db.agency.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
          ownerId: true,
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              model: true,
              capacity: true,
            },
          },
          stations: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          _count: { select: { managers: true, drivers: true } },
        },
      }),
  );
}

export async function assignManager(agencyId: string, ownerId: string, dto: AssignManagerDto) {
  const agency = await db.agency.findUniqueOrThrow({ where: { id: agencyId } });
  if (agency.ownerId !== ownerId) throw new AuthorizationError('Only the agency owner can assign managers');

  const station = await db.station.findUniqueOrThrow({
    where: { id: dto.stationId },
    select: { agencyId: true },
  });
  if (station.agencyId !== agencyId) {
    throw new AuthorizationError('Managers can only be assigned to stations in this agency');
  }

  const manager = await db.user.findUniqueOrThrow({ where: { id: dto.managerId } });
  if (manager.role !== 'MANAGER') throw new ValidationError('Target user must have MANAGER role');

  await db.user.update({
    where: { id: dto.managerId },
    data: { managedAgencyId: agencyId, managedStationId: dto.stationId },
  });

  await publishDomainEvent("agency.manager-assigned", {
    agencyId,
    managerId: dto.managerId,
    stationId: dto.stationId,
  });
  return { message: 'Manager assigned successfully' };
}

export async function assignDriver(agencyId: string, ownerId: string, dto: AssignDriverDto) {
  const agency = await db.agency.findUniqueOrThrow({ where: { id: agencyId } });
  if (agency.ownerId !== ownerId) throw new AuthorizationError('Only the agency owner can assign drivers');

  const driver = await db.user.findUniqueOrThrow({ where: { id: dto.driverId } });
  if (driver.role !== 'DRIVER') throw new ValidationError('Target user must have DRIVER role');
  if (driver.driverAgencyId && driver.driverAgencyId !== agencyId) {
    throw new AuthorizationError('Driver is already assigned to another agency');
  }

  await db.user.update({ where: { id: dto.driverId }, data: { driverAgencyId: agencyId } });
  await publishDomainEvent("agency.driver-assigned", {
    agencyId,
    driverId: dto.driverId,
  });
  return { message: 'Driver assigned to agency successfully' };
}

export async function assignManagerByEmail(agencyId: string, ownerId: string, email: string, stationId: string) {
  const manager = await db.user.findUnique({ where: { email } });
  if (!manager) throw new NotFoundError(`User with email ${email} not found`);
  if (manager.role !== 'MANAGER') throw new ValidationError('User must have MANAGER role');

  return assignManager(agencyId, ownerId, { managerId: manager.id, stationId });
}

export async function assignDriverByEmail(agencyId: string, ownerId: string, email: string) {
  const driver = await db.user.findUnique({ where: { email } });
  if (!driver) throw new NotFoundError(`User with email ${email} not found`);

  return assignDriver(agencyId, ownerId, { driverId: driver.id });
}
