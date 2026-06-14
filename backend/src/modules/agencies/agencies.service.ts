import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { env } from '../../config/env.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import {
  AuthorizationError,
  ValidationError,
  ExternalProviderError,
} from '../../lib/errors.js';
import { sendMail } from '../../lib/mailer.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import type { CreateAgencyDto, AssignManagerDto, AssignDriverDto } from './agencies.schema.js';
import crypto from 'node:crypto';

/**
 * Queries the official RURA Licensing Portal to verify a transport operator's
 * license document number.
 *
 * The portal at https://licensing.rura.rw offers a public validity check.
 * We send a GET with the document number and inspect the HTML response.
 * If the document exists the portal returns license details; otherwise it
 * returns a "Document number not found" message.
 *
 * This replaces the previous format-only check (RURA- prefix) with a real
 * verification against the regulator's database.
 */
async function verifyWithRura(documentNumber: string): Promise<void> {
  const url = `${env.RURA_API_URL}/check-service/validity-search`;

  const res = await fetch(
    `${url}?check_type=document_number&document_number=${encodeURIComponent(documentNumber)}&web=true&vehicle_type=vehicle`,
    {
      method: 'GET',
      headers: { 'user-agent': 'TapaRide/1.0' },
      // Timeout after 10 seconds — the RURA portal can be slow.
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    throw new ExternalProviderError(
      'RURA Licensing Portal is temporarily unavailable. Please try again later.',
      { status: res.status },
    );
  }

  const html = await res.text();

  // The RURA portal returns a success page with a results table when the
  // document is found, or a "not found" alert div when it isn't.
  if (
    html.includes('Document number not found') ||
    html.includes('not found') ||
    html.includes('not_found')
  ) {
    throw new ValidationError(
      `The document number "${documentNumber}" was not recognised by the RURA ` +
      'Licensing Portal. Please verify the number on your RURA-issued Transport ' +
      'Operating License and try again.',
    );
  }

  // If the response contains a result table the document is valid — pass.
}

export async function createAgency(ownerId: string, dto: CreateAgencyDto) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  if (owner.role !== 'OWNER') throw new AuthorizationError('Only OWNER users can register agencies');

  // Verify the RURA document number against the official Licensing Portal.
  await verifyWithRura(dto.ruraCode);

  // Store the RURA code on the user record for future reference / audit.
  await db.user.update({
    where: { id: ownerId },
    data: { ruraCode: dto.ruraCode.trim() },
  });

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

export async function assignDriver(agencyId: string, userId: string, dto: AssignDriverDto) {
  const agency = await db.agency.findUniqueOrThrow({ where: { id: agencyId } });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const isOwner = agency.ownerId === userId;
  const isManager = user.managedAgencyId === agencyId && user.role === 'MANAGER';
  if (!isOwner && !isManager) {
    throw new AuthorizationError('Only the agency owner or a manager can assign drivers');
  }

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
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'MANAGER') throw new ValidationError('User must have MANAGER role');
    return assignManager(agencyId, ownerId, { managerId: existing.id, stationId });
  }

  // User doesn't exist — send an invite
  const token = crypto.randomBytes(16).toString('hex');
  const inviteKey = `invite:${email.toLowerCase()}`;
  await redis.set(inviteKey, JSON.stringify({ token, role: 'MANAGER', agencyId, stationId }), 'EX', 172800);

  const inviteLink = `${env.EMAIL_VERIFICATION_ORIGIN || env.WEBAUTHN_ORIGIN}/accept-invite?email=${encodeURIComponent(email)}&token=${token}`;
  await sendMail({ to: email, subject: 'You\'ve been invited to manage a Tapa agency', html: `
    <h2>You're invited to join Tapa as a Manager</h2>
    <p>An agency owner has assigned you to manage their transport operations.</p>
    <p><a href="${inviteLink}" style="background:#10075C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Accept Invitation</a></p>
    <p>Or enter this code on the invitation page: <strong>${token}</strong></p>
    <p>This link expires in 48 hours.</p>
  `});

  return { message: `Invitation sent to ${email}. They'll receive a link to set up their account.` };
}

export async function assignDriverByEmail(agencyId: string, userId: string, email: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'DRIVER') throw new ValidationError('User must have DRIVER role');
    return assignDriver(agencyId, userId, { driverId: existing.id });
  }

  // User doesn't exist — send an invite
  const token = crypto.randomBytes(16).toString('hex');
  const inviteKey = `invite:${email.toLowerCase()}`;
  await redis.set(inviteKey, JSON.stringify({ token, role: 'DRIVER', agencyId }), 'EX', 172800);

  const inviteLink = `${env.EMAIL_VERIFICATION_ORIGIN || env.WEBAUTHN_ORIGIN}/accept-invite?email=${encodeURIComponent(email)}&token=${token}`;
  await sendMail({ to: email, subject: 'You\'ve been invited to drive for a Tapa agency', html: `
    <h2>You're invited to join Tapa as a Driver</h2>
    <p>You've been assigned as a driver for a Tapa transport agency.</p>
    <p><a href="${inviteLink}" style="background:#10075C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Accept Invitation</a></p>
    <p>Or enter this code on the invitation page: <strong>${token}</strong></p>
    <p>This link expires in 48 hours.</p>
  `});

  return { message: `Invitation sent to ${email}. They'll receive a link to set up their account.` };
}
