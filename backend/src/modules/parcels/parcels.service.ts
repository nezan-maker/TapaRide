// src/modules/parcels/parcels.service.ts
//
// Parcel service — fee hold lifecycle + claim flow.
//
// Money model (Model 1 — wallet as source of truth):
//   1. Sender creates a parcel. We compute the fee from Journey.price
//      via lib/parcel-pricing and place a wallet hold (DEBIT, PARCEL_SEND).
//      The Parcel row is created in AWAITING_PAYMENT.
//   2. The hold is the promise of payment. No real money moves until the
//      hold is committed.
//   3. On commit (called by the webhook handler for Stripe topup OR by a
//      direct commit for wallet-funded parcels), we:
//        - commit the wallet hold (held -> available)
//        - mint a 12-char claimKey
//        - flip status to CONFIRMED
//        - set paidAt + expiresAt (14 days)
//        - Twilio SMS the claimKey to receiverPhone
//   4. Receiver opens /parcels/receive, types the claimKey. We verify
//      the key + receiverPhone match, flip status to CLAIMED, send SMS
//      to sender.
//   5. Cancellation (before commit) releases the hold back to the
//      sender's available balance.

import { randomBytes, createHash } from 'node:crypto';
import { db } from '../../lib/db.js';
import { rememberJson } from '../../lib/cache.js';
import { cacheKeys, cacheTags } from '../../lib/cache-keys.js';
import { cachePolicies } from '../../lib/cache-policies.js';
import { publishDomainEvent } from '../../lib/domain-events.js';
import { placeHold, commitHold, releaseHold } from '../../lib/wallet-journal.js';
import { computeParcelFee } from '../../lib/parcel-pricing.js';
import { deliverSms } from '../../lib/notifications/providers.js';
import { logger } from '../../lib/logger.js';
import type { PaginationInput } from '../../lib/pagination.js';
import { toPagination } from '../../lib/pagination.js';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../../lib/errors.js';
import type { CreateParcelDto, UpdateParcelStatusDto } from './parcels.schema.js';

const CLAIM_KEY_TTL_DAYS = 14;

function generateClaimKey(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  let raw = '';
  for (let i = 0; i < 12; i++) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return raw.slice(0, 3) + '-' + raw.slice(3, 7) + '-' + raw.slice(7, 10);
}

async function resolveWalletId(userId: string): Promise<string> {
  const wallet = await db.wallet.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!wallet) {
    throw new ValidationError('Sender has no wallet — set up your wallet first');
  }
  return wallet.id;
}

type JourneyQuoteSource = {
  journeyId?: string;
  fromStation?: string;
  toStation?: string;
};

async function resolveJourneyForQuote(input: JourneyQuoteSource) {
  let resolvedJourneyId = input.journeyId;
  if (!resolvedJourneyId && input.fromStation && input.toStation) {
    const journey = await db.journey.findFirst({
      where: {
        sourceStation: { name: { contains: input.fromStation, mode: 'insensitive' } },
        destinationStation: { name: { contains: input.toStation, mode: 'insensitive' } },
        departureTime: { gte: new Date() },
      },
      orderBy: { departureTime: 'asc' },
      select: { id: true },
    });
    if (journey) resolvedJourneyId = journey.id;
  }

  if (!resolvedJourneyId) {
    throw new ValidationError(
      'A valid journeyId or fromStation/toStation pair with an upcoming departure is required',
    );
  }

  const journey = await db.journey.findUnique({
    where: { id: resolvedJourneyId },
    select: {
      id: true,
      price: true,
      departureTime: true,
      sourceStation: { select: { name: true } },
      destinationStation: { select: { name: true } },
    },
  });
  if (!journey) {
    throw new ValidationError('Journey not found');
  }

  return journey;
}

export async function quoteParcel(input: JourneyQuoteSource & { weight?: number }) {
  const journey = await resolveJourneyForQuote(input);
  const weightKg = input.weight ?? 1;
  const pricing = computeParcelFee({ journeyPrice: journey.price, weightKg });

  return {
    journeyId: journey.id,
    from: journey.sourceStation.name,
    to: journey.destinationStation.name,
    departureTime: journey.departureTime,
    weightKg,
    ...pricing,
  };
}

export async function createParcel(senderId: string, dto: CreateParcelDto) {
  const journey = await resolveJourneyForQuote(dto);
  const weightKg = dto.weight ?? 1;
  const pricing = computeParcelFee({ journeyPrice: journey.price, weightKg });
  const walletId = await resolveWalletId(senderId);

  const hold = await placeHold({
    walletId,
    amount: pricing.fee,
    direction: 'DEBIT',
    type: 'PARCEL_SEND',
    note:
      'Parcel hold — ' +
      journey.sourceStation.name +
      ' → ' +
      journey.destinationStation.name +
      ' (' +
      pricing.band.label +
      ')',
    metadata: {
      journeyId: journey.id,
      weightKg,
      pricingStrategy: pricing.strategy,
    },
    ...(dto.walletPassword ? { walletPassword: dto.walletPassword } : {}),
  });

  let parcel;
  try {
    parcel = await db.$transaction(async (tx) => {
      const created = await tx.parcel.create({
        data: {
          senderId,
          journeyId: journey.id,
          receiverName: dto.receiverName,
          receiverPhone: dto.receiverPhone,
          weight: dto.weight ?? null,
          fee: pricing.fee,
          pricingStrategy: pricing.strategy,
          basePrice: pricing.basePrice,
          weightBand: pricing.band.label,
          weightMultiplier: pricing.weightMultiplier,
          notes: dto.notes,
          status: 'AWAITING_PAYMENT',
        },
        include: {
          journey: {
            include: {
              sourceStation: { select: { name: true } },
              destinationStation: { select: { name: true } },
            },
          },
        },
      });

      await tx.walletTransaction.update({
        where: { id: hold.id },
        data: { referenceId: created.id },
      });

      return created;
    });
  } catch (err) {
    await releaseHold({
      transactionId: hold.id,
      reason: 'Parcel creation failed',
    });
    throw err;
  }

  await publishDomainEvent('parcel.created', {
    parcelId: parcel.id,
    senderId,
    fee: pricing.fee,
  });

  logger.info(
    { parcelId: parcel.id, senderId, fee: pricing.fee },
    'parcel created (awaiting payment)',
  );

  return confirmParcelPayment(parcel.id);
}

export async function confirmParcelPayment(parcelId: string) {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    include: { journey: true },
  });
  if (!parcel) throw new NotFoundError('Parcel not found');

  if (parcel.status === 'CONFIRMED' || parcel.status === 'CLAIMED') {
    return parcel;
  }

  if (parcel.status !== 'AWAITING_PAYMENT') {
    throw new ConflictError('Cannot confirm payment for parcel in status ' + parcel.status);
  }

  const hold = await db.walletTransaction.findFirst({
    where: { referenceId: parcelId, status: 'PENDING' },
  });
  if (!hold) {
    throw new ConflictError('No pending payment hold found for this parcel');
  }

  await commitHold({ transactionId: hold.id });

  const claimKey = generateClaimKey();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_KEY_TTL_DAYS * 24 * 60 * 60 * 1000);

  const updated = await db.parcel.update({
    where: { id: parcelId },
    data: {
      status: 'CONFIRMED',
      claimKey,
      paidAt: now,
      expiresAt,
    },
    include: {
      journey: {
        include: {
          sourceStation: { select: { name: true } },
          destinationStation: { select: { name: true } },
        },
      },
    },
  });

  try {
    await deliverSms({
      phone: parcel.receiverPhone,
      message: 'You have a parcel from ' + parcel.receiverName + ' via Tapa. Claim key: ' + claimKey + '. Tap https://taparide.onrender.com/receive?key=' + claimKey + ' or enter the code at taparide.onrender.com/receive. Expires in ' + CLAIM_KEY_TTL_DAYS + ' days.',
    });
  } catch (err) {
    logger.error({ parcelId, err }, 'Failed to send claimKey SMS');
  }

  await publishDomainEvent('parcel.updated', {
    trackingCode: parcel.trackingCode,
    senderId: parcel.senderId,
    status: 'CONFIRMED',
  });

  logger.info({ parcelId, claimKey }, 'parcel payment confirmed');
  return updated;
}

export async function startClaimParcel(claimKey: string) {
  const parcel = await db.parcel.findUnique({
    where: { claimKey },
    include: {
      journey: {
        include: {
          sourceStation: { select: { name: true } },
          destinationStation: { select: { name: true } },
        },
      },
    },
  });
  if (!parcel) {
    throw new NotFoundError('Invalid claim key');
  }

  if (parcel.expiresAt && parcel.expiresAt < new Date()) {
    await expireParcel(parcel.id);
    throw new ValidationError('Claim key has expired');
  }

  if (parcel.status === 'CLAIMED') {
    throw new ConflictError('This parcel has already been claimed');
  }

  if (parcel.status !== 'CONFIRMED') {
    throw new ValidationError('Parcel cannot be claimed (status: ' + parcel.status + ')');
  }

  return {
    id: parcel.id,
    receiverName: parcel.receiverName,
    status: parcel.status,
    fee: parcel.fee,
    weight: parcel.weight,
    from: parcel.journey.sourceStation.name,
    to: parcel.journey.destinationStation.name,
    expiresAt: parcel.expiresAt,
    trackingCode: parcel.trackingCode,
  };
}

export async function claimParcel(claimKey: string, receiverPhone: string) {
  const normalizedPhone = receiverPhone.startsWith('+') ? receiverPhone : '+' + receiverPhone;

  const parcel = await db.parcel.findUnique({
    where: { claimKey },
  });
  if (!parcel) {
    throw new NotFoundError('Invalid claim key');
  }

  if (parcel.expiresAt && parcel.expiresAt < new Date()) {
    await expireParcel(parcel.id);
    throw new ValidationError('Claim key has expired');
  }

  if (parcel.status === 'CLAIMED') {
    throw new ConflictError('This parcel has already been claimed');
  }

  if (parcel.status !== 'CONFIRMED') {
    throw new ValidationError('Parcel cannot be claimed (status: ' + parcel.status + ')');
  }

  const storedPhone = parcel.receiverPhone.startsWith('+') ? parcel.receiverPhone : '+' + parcel.receiverPhone;
  if (storedPhone !== normalizedPhone) {
    throw new ValidationError('Phone number does not match this parcel');
  }

  const now = new Date();
  const updated = await db.parcel.update({
    where: { id: parcel.id },
    data: {
      status: 'CLAIMED',
      claimedAt: now,
      claimedByPhoneHash: createHash('sha256').update(normalizedPhone).digest('hex').slice(0, 16),
    },
    include: {
      journey: {
        include: {
          sourceStation: { select: { name: true } },
          destinationStation: { select: { name: true } },
        },
      },
    },
  });

  try {
    const sender = await db.user.findUnique({
      where: { id: parcel.senderId },
      select: { phone: true },
    });
    if (sender?.phone) {
      await deliverSms({
        phone: sender.phone,
        message: 'Your parcel to ' + parcel.receiverName + ' has been claimed. Tracking: ' + parcel.trackingCode + '. Thank you for using Tapa.',
      });
    }
  } catch (err) {
    logger.error({ parcelId: parcel.id, err }, 'Failed to send claim confirmation SMS');
  }

  await publishDomainEvent('parcel.updated', {
    trackingCode: parcel.trackingCode,
    senderId: parcel.senderId,
    status: 'CLAIMED',
  });

  logger.info({ parcelId: parcel.id }, 'parcel claimed by receiver');
  return updated;
}

export async function cancelParcel(parcelId: string, userId: string) {
  const parcel = await db.parcel.findUnique({ where: { id: parcelId } });
  if (!parcel) throw new NotFoundError('Parcel not found');

  if (parcel.senderId !== userId) {
    throw new AuthorizationError('Only the sender can cancel this parcel');
  }

  if (parcel.status !== 'AWAITING_PAYMENT') {
    throw new ConflictError('Cannot cancel parcel in status ' + parcel.status);
  }

  const hold = await db.walletTransaction.findFirst({
    where: { referenceId: parcelId, status: 'PENDING' },
  });
  if (hold) {
    await releaseHold({
      transactionId: hold.id,
      reason: 'Cancelled by sender',
    });
  }

  const updated = await db.parcel.update({
    where: { id: parcelId },
    data: { status: 'CANCELLED' },
  });

  await publishDomainEvent('parcel.updated', {
    trackingCode: parcel.trackingCode,
    senderId: parcel.senderId,
    status: 'CANCELLED',
  });

  logger.info({ parcelId }, 'parcel cancelled by sender');
  return updated;
}

export async function expireParcel(parcelId: string) {
  const parcel = await db.parcel.findUnique({ where: { id: parcelId } });
  if (!parcel) return;

  if (parcel.status !== 'CONFIRMED') return;

  const hold = await db.walletTransaction.findFirst({
    where: { referenceId: parcelId, status: 'PENDING' },
  });
  if (hold) {
    await releaseHold({
      transactionId: hold.id,
      reason: 'Claim window expired',
    });
  }

  await db.parcel.update({
    where: { id: parcelId },
    data: { status: 'EXPIRED' },
  });

  logger.info({ parcelId }, 'parcel expired');
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
        include: {
          journey: {
            include: {
              sourceStation: { select: { name: true } },
              destinationStation: { select: { name: true } },
            },
          },
        },
      });
      if (!parcel) throw new NotFoundError('Parcel not found with this tracking code');
      return parcel;
    },
  );
}

export async function updateParcelStatus(
  parcelId: string,
  dto: UpdateParcelStatusDto,
  updaterId: string,
) {
  const updater = await db.user.findUniqueOrThrow({ where: { id: updaterId } });
  if (!['DRIVER', 'MANAGER', 'OWNER'].includes(updater.role)) {
    throw new AuthorizationError('Only DRIVER, MANAGER or OWNER can update parcel status');
  }

  const parcel = await db.parcel.findUniqueOrThrow({
    where: { id: parcelId },
    include: { journey: { include: { vehicle: { select: { agencyId: true, driverId: true } } } } },
  });

  if (updater.role === 'DRIVER' && parcel.journey.vehicle?.driverId !== updaterId) {
    throw new AuthorizationError('You can only update parcels on journeys you are assigned to');
  }

  if (updater.role === 'MANAGER') {
    const manager = await db.user.findUniqueOrThrow({ where: { id: updaterId } });
    if (manager?.managedAgencyId !== parcel.journey.vehicle?.agencyId) {
      throw new AuthorizationError('You can only update parcels on journeys belonging to your agency');
    }
  }

  if (updater.role === 'OWNER') {
    const isOwner = await db.agency.findFirst({
      where: {
        id: parcel.journey.vehicle?.agencyId,
        ownerId: updaterId,
      },
    });
    if (!isOwner) {
      throw new AuthorizationError('You can only update parcels on journeys belonging to your owned agencies');
    }
  }

  const updatedParcel = await db.parcel.update({
    where: { id: parcelId },
    data: { status: dto.status },
  });
  await publishDomainEvent('parcel.updated', {
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
          include: {
            journey: {
              include: {
                sourceStation: { select: { name: true } },
                destinationStation: { select: { name: true } },
              },
            },
          },
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

export async function getReceiverParcels(
  phone: string,
  pagination: PaginationInput,
) {
  const normalizedPhone = phone.startsWith('+') ? phone : '+' + phone;
  return rememberJson(
    cacheKeys.userParcels('receiver:' + normalizedPhone, pagination),
    {
      ...cachePolicies.userParcels,
      tags: [cacheTags.parcels],
    },
    async () => {
      const { page, pageSize, skip, take } = toPagination(pagination);
      const [parcels, total] = await Promise.all([
        db.parcel.findMany({
          where: {
            receiverPhone: normalizedPhone,
            status: 'CONFIRMED',
          },
          include: {
            journey: {
              include: {
                sourceStation: { select: { name: true } },
                destinationStation: { select: { name: true } },
              },
            },
          },
          orderBy: { paidAt: 'desc' },
          skip,
          take,
        }),
        db.parcel.count({
          where: {
            receiverPhone: normalizedPhone,
            status: 'CONFIRMED',
          },
        }),
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
