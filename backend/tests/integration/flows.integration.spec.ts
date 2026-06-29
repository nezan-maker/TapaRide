import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import test, { after, before } from 'node:test';
import { createServer, type Server } from 'node:http';

import jwt from 'jsonwebtoken';

import { buildApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { db } from '../../src/lib/db.js';
import { hashPassword, shutdownCryptoPool } from '../../src/lib/crypto-pool.js';
import { getNotificationsQueue } from '../../src/lib/notifications/queue.js';
import { redis } from '../../src/lib/redis.js';
import { stopRealtimeEventSubscriber } from '../../src/lib/socket-bus.js';
import { getWaitlistQueue } from '../../src/modules/waitlist/waitlist.queue.js';
import { startWaitlistWorker } from '../../src/modules/waitlist/waitlist.worker.js';

const integrationEnabled = process.env['RUN_INTEGRATION_TESTS'] === 'true';
const integrationTest = integrationEnabled ? test : test.skip;
let waitlistWorker: ReturnType<typeof startWaitlistWorker> | null = null;

type TestContext = {
  userIds: string[];
  agencyIds: string[];
  vehicleIds: string[];
  stationIds: string[];
  journeyIds: string[];
  redisKeys: string[];
};

let server: Server | null = null;
let baseUrl = '';

function withIdempotency(headers: Record<string, string> = {}) {
  return {
    ...headers,
    'idempotency-key': randomUUID(),
  };
}

function createContext(): TestContext {
  return {
    userIds: [],
    agencyIds: [],
    vehicleIds: [],
    stationIds: [],
    journeyIds: [],
    redisKeys: [],
  };
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    body: text.length > 0 ? JSON.parse(text) : null,
  };
}

async function waitFor(assertion: () => Promise<void>, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  await assertion();
}

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = 5000,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseTcpUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'redis:' ? 6379 : 5432)),
  };
}

async function assertTcpReachable(rawUrl: string, label: string, timeoutMs = 3000) {
  const { host, port } = parseTcpUrl(rawUrl);

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${label} ${host}:${port} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`${label} ${host}:${port} is not reachable: ${error.message}`));
    });
  });
}

async function cleanupContext(ctx: TestContext) {
  if (ctx.redisKeys.length > 0) {
    await redis.del(...ctx.redisKeys);
  }

  // Only delete entities created by this test context. If the arrays are empty,
  // we do NOT run broad deleteMany calls (which would affect seeded/dev data).
  if (ctx.userIds.length > 0 || ctx.journeyIds.length > 0) {
    await db.waitlistEntry.deleteMany({
      where: {
        OR: [
          ctx.userIds.length > 0 ? { userId: { in: ctx.userIds } } : undefined,
          ctx.journeyIds.length > 0 ? { journeyId: { in: ctx.journeyIds } } : undefined,
        ].filter(Boolean) as { userId?: { in: string[] }; journeyId?: { in: string[] } }[],
      },
    });
    await db.ticket.deleteMany({
      where: {
        OR: [
          ctx.userIds.length > 0 ? { userId: { in: ctx.userIds } } : undefined,
          ctx.journeyIds.length > 0 ? { journeyId: { in: ctx.journeyIds } } : undefined,
        ].filter(Boolean) as { userId?: { in: string[] }; journeyId?: { in: string[] } }[],
      },
    });
  }

  if (ctx.journeyIds.length > 0) {
    await db.tripPositionLog.deleteMany({
      where: { journeyId: { in: ctx.journeyIds } },
    });
    await db.journeyStop.deleteMany({
      where: { journeyId: { in: ctx.journeyIds } },
    });
  }

  if (ctx.userIds.length > 0) {
    await db.walletTransaction.deleteMany({
      where: {
        wallet: { userId: { in: ctx.userIds } },
      },
    });
  }

  if (ctx.userIds.length > 0) {
    await db.user.updateMany({
      where: { id: { in: ctx.userIds } },
      data: {
        managedAgencyId: null,
        managedStationId: null,
        driverAgencyId: null,
      },
    });
  }

  if (ctx.journeyIds.length > 0) {
    await db.journey.deleteMany({
      where: { id: { in: ctx.journeyIds } },
    });
  }
  if (ctx.vehicleIds.length > 0) {
    await db.vehicle.deleteMany({
      where: { id: { in: ctx.vehicleIds } },
    });
  }
  if (ctx.stationIds.length > 0) {
    await db.station.deleteMany({
      where: { id: { in: ctx.stationIds } },
    });
  }
  if (ctx.agencyIds.length > 0) {
    await db.agency.deleteMany({
      where: { id: { in: ctx.agencyIds } },
    });
  }
  if (ctx.userIds.length > 0) {
    await db.wallet.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await db.passkey.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await db.user.deleteMany({
      where: { id: { in: ctx.userIds } },
    });
  }
}

async function registerVerifiedClient(ctx: TestContext, suffix: string) {
  const email = `itest.${suffix}@example.com`;
  const phone = `+25079${suffix.padStart(7, '0').slice(-7)}`;
  const password = 'Password123!';
  ctx.redisKeys.push(`otp:phone:${phone}`);

  const registerResponse = await requestJson('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      phone,
      role: 'CLIENT',
    }),
  });
  assert.equal(registerResponse.status, 201);

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  ctx.userIds.push(user.id);

  const emailToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: '24h',
  });
  const verifyEmailResponse = await requestJson(
    `/api/auth/verify-email?token=${encodeURIComponent(emailToken)}`,
  );
  assert.equal(verifyEmailResponse.status, 200);

  // Phone OTP is NOT issued at signup — it is triggered by the authenticated
  // send-phone-otp endpoint (used before money-related actions).
  const tokenRes = await db.user.findUniqueOrThrow({ where: { email } });
  const loginToken = jwt.sign({ userId: tokenRes.id }, env.JWT_SECRET, {
    expiresIn: '1h',
  });
  const sendOtpResponse = await requestJson('/api/auth/send-phone-otp', {
    method: 'POST',
    headers: { authorization: `Bearer ${loginToken}` },
  });
  assert.equal(sendOtpResponse.status, 200);

  const otp = await redis.get(`otp:phone:${phone}`);
  assert.ok(otp);
  const verifyOtpResponse = await requestJson('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code: otp }),
  });
  assert.equal(verifyOtpResponse.status, 200);

  const loginResponse = await requestJson('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginResponse.status, 200);

  return {
    userId: user.id,
    email,
    phone,
    password,
    accessToken: loginResponse.body.accessToken as string,
    refreshToken: loginResponse.body.refreshToken as string,
  };
}

async function seedJourney(ctx: TestContext, suffix: string) {
  const passwordHash = await hashPassword('DriverPass123!');
  const owner = await db.user.create({
    data: {
      email: `owner.${suffix}@example.com`,
      phone: `+25078${suffix.padStart(7, '1').slice(-7)}`,
      password: passwordHash,
      role: 'OWNER',
      isVerified: true,
      phoneVerifiedAt: new Date(),
      passwordHistory: [passwordHash],
    },
  });
  const driver = await db.user.create({
    data: {
      email: `driver.${suffix}@example.com`,
      phone: `+25073${suffix.padStart(7, '2').slice(-7)}`,
      password: passwordHash,
      role: 'DRIVER',
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: `DRV-${suffix}`,
      passwordHistory: [passwordHash],
    },
  });
  ctx.userIds.push(owner.id, driver.id);

  const agency = await db.agency.create({
    data: {
      name: `Integration Agency ${suffix}`,
      ownerId: owner.id,
      verified: true,
    },
  });
  ctx.agencyIds.push(agency.id);

  await db.user.update({
    where: { id: driver.id },
    data: { driverAgencyId: agency.id },
  });

  const sourceStation = await db.station.create({
    data: {
      name: `Source ${suffix}`,
      location: '-1.95,30.06',
      agencyId: agency.id,
    },
  });
  const destinationStation = await db.station.create({
    data: {
      name: `Destination ${suffix}`,
      location: '-1.94,30.08',
      agencyId: agency.id,
    },
  });
  ctx.stationIds.push(sourceStation.id, destinationStation.id);

  const vehicle = await db.vehicle.create({
    data: {
      plateNumber: `RAD${suffix.slice(-4).padStart(4, '0')}`,
      model: 'Coaster',
      capacity: 1,
      agencyId: agency.id,
      driverId: driver.id,
    },
  });
  ctx.vehicleIds.push(vehicle.id);

  const journey = await db.journey.create({
    data: {
      sourceStationId: sourceStation.id,
      destinationStationId: destinationStation.id,
      vehicleId: vehicle.id,
      departureTime: new Date(Date.now() + 60 * 60 * 1000),
      price: 25,
    },
  });
  ctx.journeyIds.push(journey.id);

  await db.journeyStop.createMany({
    data: [
      { journeyId: journey.id, stationId: sourceStation.id, order: 1 },
      { journeyId: journey.id, stationId: destinationStation.id, order: 2 },
    ],
  });

  const driverToken = jwt.sign(
    { id: driver.id, role: 'DRIVER' },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );

  return {
    journeyId: journey.id,
    boardingStopId: sourceStation.id,
    driverToken,
  };
}

before(async () => {
  if (!integrationEnabled) {
    return;
  }

  await assertTcpReachable(env.DATABASE_URL, 'Postgres');
  await assertTcpReachable(env.REDIS_URL, 'Redis');
  await withTimeout(db.$connect(), 'Postgres connect');
  await withTimeout(db.$queryRaw`SELECT 1`, 'Postgres ping');
  await withTimeout(redis.ping(), 'Redis ping');
  waitlistWorker = startWaitlistWorker();

  const app = await buildApp();
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine integration test server address');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!integrationEnabled) {
    return;
  }

  await getNotificationsQueue().close();
  await getWaitlistQueue().close();
  if (waitlistWorker) {
    await waitlistWorker.close();
  }
  await stopRealtimeEventSubscriber();
  await shutdownCryptoPool();
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  await db.$disconnect();
  redis.disconnect();
});

integrationTest('auth flow: email gates login, phone gates money actions', async () => {
  const ctx = createContext();
  const email = 'auth.flow@example.com';
  const phone = '+250****0001';
  const password = 'Password123!';
  ctx.redisKeys.push(`otp:phone:${phone}`);

  try {
    const registerResponse = await requestJson('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, phone, role: 'CLIENT' }),
    });
    assert.equal(registerResponse.status, 201);

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    ctx.userIds.push(user.id);

    // Cannot login before email verification.
    const loginBeforeVerify = await requestJson('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(loginBeforeVerify.status, 401);
    assert.match(loginBeforeVerify.body.error, /Email verification/);

    // Verify email.
    const emailToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: '24h',
    });
    const verifyEmailResponse = await requestJson(
      `/api/auth/verify-email?token=${encodeURIComponent(emailToken)}`,
    );
    assert.equal(verifyEmailResponse.status, 200);

    // Login succeeds after email verification (phone NOT required for login).
    const loginResponse = await requestJson('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(loginResponse.status, 200);
    assert.ok(loginResponse.body.accessToken);
    assert.ok(loginResponse.body.refreshToken);

    // Money-related action blocked by phone verification (authenticate middleware).
    const paymentBlocked = await requestJson('/api/payments/topup', {
      method: 'POST',
      headers: { authorization: `Bearer ${loginResponse.body.accessToken}` },
      body: JSON.stringify({ amount: 1000 }),
    });
    assert.equal(paymentBlocked.status, 403);
    assert.match(paymentBlocked.body.error, /fully verified/);

    // Trigger phone OTP via authenticated endpoint.
    const sendOtpResponse = await requestJson('/api/auth/send-phone-otp', {
      method: 'POST',
      headers: { authorization: `Bearer ${loginResponse.body.accessToken}` },
    });
    assert.equal(sendOtpResponse.status, 200);

    const otp = await redis.get(`otp:phone:${phone}`);
    assert.ok(otp);
    const verifyOtpResponse = await requestJson('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, code: otp }),
    });
    assert.equal(verifyOtpResponse.status, 200);

    // Refresh token works.
    const refreshResponse = await requestJson('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginResponse.body.refreshToken }),
    });
    assert.equal(refreshResponse.status, 200);

    // Logout works.
    const logoutResponse = await requestJson('/api/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${loginResponse.body.accessToken}` },
    });
    assert.equal(logoutResponse.status, 200);
  } finally {
    await cleanupContext(ctx);
  }
});

integrationTest('wallet flow persists balance and transactions in Postgres', async () => {
  const ctx = createContext();

  try {
    const user = await registerVerifiedClient(ctx, '2000001');
    const walletSetupKey = randomUUID();
    const depositKey = randomUUID();
    const withdrawKey = randomUUID();

    const setupResponse = await requestJson('/api/wallet/setup', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': walletSetupKey,
      },
      body: JSON.stringify({ walletPassword: '4321' }),
    });
    assert.equal(setupResponse.status, 201);

    const depositResponse = await requestJson('/api/wallet/deposit', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': depositKey,
      },
      body: JSON.stringify({ amount: 100, walletPassword: '4321' }),
    });
    assert.equal(depositResponse.status, 200);
    assert.equal(depositResponse.body.newBalance, 100);

    const replayDepositResponse = await requestJson('/api/wallet/deposit', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': depositKey,
      },
      body: JSON.stringify({ amount: 100, walletPassword: '4321' }),
    });
    assert.equal(replayDepositResponse.status, 200);
    assert.equal(replayDepositResponse.body.newBalance, 100);

    const withdrawResponse = await requestJson('/api/wallet/withdraw', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': withdrawKey,
      },
      body: JSON.stringify({ amount: 35, walletPassword: '4321' }),
    });
    assert.equal(withdrawResponse.status, 200);
    assert.equal(withdrawResponse.body.newBalance, 65);

    const balanceResponse = await requestJson('/api/wallet/balance', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ walletPassword: '4321' }),
    });
    assert.equal(balanceResponse.status, 200);
    assert.equal(balanceResponse.body.balance, 65);

    const transactionsResponse = await requestJson('/api/wallet/transactions?page=1&pageSize=10', {
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    assert.equal(transactionsResponse.status, 200);
    assert.equal(transactionsResponse.body.items.length, 2);
  } finally {
    await cleanupContext(ctx);
  }
});

integrationTest('ticket flow can buy, cancel, and rebook the same seat', async () => {
  const ctx = createContext();

  try {
    const user = await registerVerifiedClient(ctx, '2000002');
    const journey = await seedJourney(ctx, '2000002');
    const purchaseKey = randomUUID();
    const cancelKey = randomUUID();

    await requestJson('/api/wallet/setup', {
      method: 'POST',
      headers: withIdempotency({
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
      }),
      body: JSON.stringify({ walletPassword: '4321' }),
    });
    await requestJson('/api/wallet/deposit', {
      method: 'POST',
      headers: withIdempotency({
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
      }),
      body: JSON.stringify({ amount: 100, walletPassword: '4321' }),
    });

    const purchaseResponse = await requestJson('/api/tickets', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': purchaseKey,
      },
      body: JSON.stringify({
        journeyId: journey.journeyId,
        seatNumber: 1,
        walletPassword: '4321',
      }),
    });
    assert.equal(purchaseResponse.status, 201);

    const replayPurchaseResponse = await requestJson('/api/tickets', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': purchaseKey,
      },
      body: JSON.stringify({
        journeyId: journey.journeyId,
        seatNumber: 1,
        walletPassword: '4321',
      }),
    });
    assert.equal(replayPurchaseResponse.status, 201);
    assert.equal(replayPurchaseResponse.body.ticket.id, purchaseResponse.body.ticket.id);

    const cancelResponse = await requestJson(
      `/api/tickets/${purchaseResponse.body.ticket.id}/cancel`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${user.accessToken}`,
          'content-type': 'application/json',
          'idempotency-key': cancelKey,
        },
        body: JSON.stringify({ walletPassword: '4321' }),
      },
    );
    assert.equal(cancelResponse.status, 200);

    const repurchaseResponse = await requestJson('/api/tickets', {
      method: 'POST',
      headers: withIdempotency({
        authorization: `Bearer ${user.accessToken}`,
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        journeyId: journey.journeyId,
        seatNumber: 1,
        walletPassword: '4321',
      }),
    });
    assert.equal(repurchaseResponse.status, 201);
  } finally {
    await cleanupContext(ctx);
  }
});

integrationTest('waitlist flow writes Redis queue state and notifies the next rider', async () => {
  const ctx = createContext();

  try {
    const buyer = await registerVerifiedClient(ctx, '2000003');
    const waiter = await registerVerifiedClient(ctx, '2000004');
    const journey = await seedJourney(ctx, '2000003');
    ctx.redisKeys.push(
      `waitlist:journey:${journey.journeyId}:stop:${journey.boardingStopId}`,
      `reserve:journey:${journey.journeyId}:seat:1`,
    );

    for (const user of [buyer, waiter]) {
      await requestJson('/api/wallet/setup', {
        method: 'POST',
        headers: withIdempotency({
          authorization: `Bearer ${user.accessToken}`,
          'content-type': 'application/json',
        }),
        body: JSON.stringify({ walletPassword: '4321' }),
      });
      await requestJson('/api/wallet/deposit', {
        method: 'POST',
        headers: withIdempotency({
          authorization: `Bearer ${user.accessToken}`,
          'content-type': 'application/json',
        }),
        body: JSON.stringify({ amount: 100, walletPassword: '4321' }),
      });
    }

    const purchaseResponse = await requestJson('/api/tickets', {
      method: 'POST',
      headers: withIdempotency({
        authorization: `Bearer ${buyer.accessToken}`,
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        journeyId: journey.journeyId,
        seatNumber: 1,
        walletPassword: '4321',
      }),
    });
    assert.equal(purchaseResponse.status, 201);

    const waitlistResponse = await requestJson('/api/waitlist', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${waiter.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        journeyId: journey.journeyId,
        boardingStopId: journey.boardingStopId,
      }),
    });
    assert.equal(waitlistResponse.status, 201);
    assert.equal(waitlistResponse.body.position, 1);

    const statusResponse = await requestJson(
      `/api/waitlist/status?journeyId=${journey.journeyId}&stopId=${journey.boardingStopId}`,
      {
        headers: { authorization: `Bearer ${waiter.accessToken}` },
      },
    );
    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.body.position, 1);

    const alightResponse = await requestJson(`/api/journeys/${journey.journeyId}/alight`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${journey.driverToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ticketId: purchaseResponse.body.ticket.id,
        stationId: journey.boardingStopId,
        seatNumber: 1,
      }),
    });
    assert.equal(alightResponse.status, 200);

    await waitFor(async () => {
      const entry = await db.waitlistEntry.findFirst({
        where: {
          userId: waiter.userId,
          journeyId: journey.journeyId,
          boardingStopId: journey.boardingStopId,
        },
      });
      assert.equal(entry?.status, 'NOTIFIED');

      const reservedFor = await redis.get(
        `reserve:journey:${journey.journeyId}:seat:1`,
      );
      assert.equal(reservedFor, waiter.userId);
    });
  } finally {
    await cleanupContext(ctx);
  }
});
