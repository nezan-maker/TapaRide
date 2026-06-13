import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys, cacheTags } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import type { CreateStationDto } from './stations.schema.js';
import { AuthorizationError } from '../../lib/errors.js';

export async function createStation(ownerId: string, dto: CreateStationDto) {
  const agency = await db.agency.findUniqueOrThrow({ where: { id: dto.agencyId } });
  if (agency.ownerId !== ownerId) throw new AuthorizationError('Only the agency owner can create stations');
  const station = await db.station.create({ data: dto });
  await publishDomainEvent("station.created", {
    agencyId: dto.agencyId,
    stationId: station.id,
  });
  return station;
}

export async function listStations(
  pagination: PaginationInput,
  agencyId?: string,
) {
  return rememberJson(
    cacheKeys.stationsList(agencyId, pagination),
    {
      ...cachePolicies.stationsList,
      tags: [
        cacheTags.stations,
        ...(agencyId ? [cacheTags.agencyStations(agencyId)] : []),
      ],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const where = agencyId ? { agencyId } : undefined;

      const [stations, total] = await Promise.all([
        db.station.findMany({
          where,
          include: { agency: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        db.station.count({ where }),
      ]);

      return {
        items: stations,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );
}

export async function getStation(id: string) {
  return rememberJson(
    cacheKeys.station(id),
    {
      ...cachePolicies.stationDetail,
      tags: [cacheTags.stations, cacheTags.station(id)],
    },
    () =>
      db.station.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          location: true,
          agencyId: true,
          createdAt: true,
          agency: { select: { id: true, name: true } },
          _count: { select: { managers: true } },
        },
      }),
  );
}
