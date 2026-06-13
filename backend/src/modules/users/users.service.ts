import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys, cacheTags } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import { AuthorizationError } from '../../lib/errors.js';

export async function getUserProfile(userId: string) {
  return rememberJson(
    cacheKeys.userProfile(userId),
    {
      ...cachePolicies.userProfile,
      tags: [cacheTags.user(userId)],
    },
    () =>
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          agencyIssuedId: true,
          managedAgencyId: true,
          managedStationId: true,
          driverAgencyId: true,
          createdAt: true,
        },
      }),
  );
}

export async function listUsers(requesterId: string, pagination: PaginationInput) {
  const requester = await db.user.findUniqueOrThrow({
    where: { id: requesterId },
    select: { role: true, managedAgencyId: true },
  });

  let agencyIds: string[];
  if (requester.role === 'OWNER') {
    const agencies = await db.agency.findMany({
      where: { ownerId: requesterId },
      select: { id: true },
    });
    agencyIds = agencies.map((agency) => agency.id);
  } else if (requester.role === 'MANAGER' && requester.managedAgencyId) {
    agencyIds = [requester.managedAgencyId];
  } else {
    throw new AuthorizationError('User listing requires an assigned agency');
  }

  const { page, pageSize, skip, take } = toPagination(pagination);
  const where = {
    OR: [
      { managedAgencyId: { in: agencyIds } },
      { driverAgencyId: { in: agencyIds } },
      { ownedAgencies: { some: { id: { in: agencyIds } } } },
    ],
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    db.user.count({ where }),
  ]);

  return {
    items: users,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
