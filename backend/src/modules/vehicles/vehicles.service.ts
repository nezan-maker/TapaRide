import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys, cacheTags } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import type { CreateVehicleDto, AssignVehicleDriverDto } from './vehicles.schema.js';
import { AuthorizationError, ValidationError } from '../../lib/errors.js';

export async function createVehicle(ownerId: string, dto: CreateVehicleDto) {
  const agency = await db.agency.findUniqueOrThrow({ where: { id: dto.agencyId } });
  if (agency.ownerId !== ownerId) throw new AuthorizationError('Only the agency owner can add vehicles');

  const vehicle = await db.vehicle.create({ data: dto });
  await publishDomainEvent("vehicle.created", {
    agencyId: dto.agencyId,
    vehicleId: vehicle.id,
  });
  return vehicle;
}

export async function listVehicles(
  userId: string,
  pagination: PaginationInput,
  agencyId?: string,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      driverAgencyId: true,
      managedAgencyId: true,
    },
  });

  let scopedAgencyIds: string[];
  if (user.role === 'OWNER') {
    const ownedAgencies = await db.agency.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    scopedAgencyIds = ownedAgencies.map((agency) => agency.id);
  } else if (user.role === 'MANAGER' && user.managedAgencyId) {
    scopedAgencyIds = [user.managedAgencyId];
  } else if (user.role === 'DRIVER' && user.driverAgencyId) {
    scopedAgencyIds = [user.driverAgencyId];
  } else {
    throw new AuthorizationError('User is not assigned to an agency');
  }

  if (agencyId && !scopedAgencyIds.includes(agencyId)) {
    throw new AuthorizationError('You can only list vehicles in your agency');
  }

  const effectiveAgencyIds = agencyId ? [agencyId] : scopedAgencyIds;

  return rememberJson(
    cacheKeys.vehiclesList(effectiveAgencyIds.sort().join(','), pagination),
    {
      ...cachePolicies.vehiclesList,
      tags: [
        cacheTags.vehicles,
        ...effectiveAgencyIds.map((id) => cacheTags.agencyVehicles(id)),
      ],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const where = { agencyId: { in: effectiveAgencyIds } };

      const [vehicles, total] = await Promise.all([
        db.vehicle.findMany({
          where,
          include: {
            driver: { select: { id: true, email: true } },
            agency: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        db.vehicle.count({ where }),
      ]);

      return {
        items: vehicles,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}

export async function assignDriver(vehicleId: string, ownerId: string, dto: AssignVehicleDriverDto) {
  const vehicle = await db.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    include: { agency: true },
  });
  if (vehicle.agency.ownerId !== ownerId) throw new AuthorizationError('Only the agency owner can assign drivers');

  const driver = await db.user.findUniqueOrThrow({ where: { id: dto.driverId } });
  if (driver.role !== 'DRIVER') throw new ValidationError('Target user must have DRIVER role');
  if (driver.driverAgencyId !== vehicle.agencyId) {
    throw new AuthorizationError('Driver must be assigned to the vehicle agency before vehicle assignment');
  }

  await db.vehicle.update({ where: { id: vehicleId }, data: { driverId: dto.driverId } });
  await publishDomainEvent("vehicle.driver-assigned", {
    agencyId: vehicle.agencyId,
    vehicleId,
    driverId: dto.driverId,
  });
  return { message: 'Driver assigned to vehicle' };
}
