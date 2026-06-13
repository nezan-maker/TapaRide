import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as argon2 from 'argon2';
import { encryptBalance } from '../src/lib/crypto';
import 'dotenv/config';

const connectionString = `${process.env['DATABASE_URL']}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Clear existing data ───────────────────────────────────────────────────
  await db.walletTransaction.deleteMany();
  await db.ticket.deleteMany();
  await db.parcel.deleteMany();
  await db.journey.deleteMany();
  await db.vehicle.deleteMany();
  await db.station.deleteMany();
  await db.passkey.deleteMany();
  await db.wallet.deleteMany();
  // Agency must be deleted before User due to RESTRICT on ownerId FK
  await db.agency.deleteMany();
  await db.user.deleteMany();

  // ─── Users ────────────────────────────────────────────────────────────────

  const ownerPassword = 'Owner@1234';
  const clientPassword = 'Client@1234';
  const managerPassword = 'Manager@1234';
  const driverPassword = 'Driver@1234';

  const [ownerHash, clientHash, managerHash, driverHash] = await Promise.all([
    argon2.hash(ownerPassword, ARGON2_CONFIG),
    argon2.hash(clientPassword, ARGON2_CONFIG),
    argon2.hash(managerPassword, ARGON2_CONFIG),
    argon2.hash(driverPassword, ARGON2_CONFIG),
  ]);

  const owner = await db.user.create({
    data: {
      email: 'owner@tapa.rw',
      password: ownerHash,
      phone: '+250****0001',
      role: 'OWNER',
      isVerified: true,
      phoneVerifiedAt: new Date(),
      ruraCode: 'RURA-2024-001',
    },
  });

  const manager = await db.user.create({
    data: {
      email: 'manager@tapa.rw',
      password: managerHash,
      phone: '+250****0002',
      role: 'MANAGER',
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: 'MGR-001',
    },
  });

  const driver = await db.user.create({
    data: {
      email: 'driver@tapa.rw',
      password: driverHash,
      phone: '+250****0003',
      role: 'DRIVER',
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: 'DRV-001',
    },
  });

  const client = await db.user.create({
    data: {
      email: 'client@tapa.rw',
      password: clientHash,
      phone: '+250****0004',
      role: 'CLIENT',
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });

  console.log('✅ Users created');

  // ─── Wallets ──────────────────────────────────────────────────────────────

  const usersAndPasswords = [
    { user: owner, password: ownerPassword },
    { user: manager, password: managerPassword },
    { user: driver, password: driverPassword },
    { user: client, password: clientPassword },
  ];

  for (const { user, password } of usersAndPasswords) {
    // Give client 50,000 to test purchases; others 10,000
    const initialBalance = user.role === 'CLIENT' ? 50_000 : 10_000;
    const encrypted = encryptBalance(initialBalance, password);
    const walletPasswordHash = await argon2.hash(password, ARGON2_CONFIG);
    await db.wallet.create({
      data: {
        userId: user.id,
        walletPassword: walletPasswordHash,
        encryptedBalance: encrypted.encryptedBalance,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        salt: encrypted.salt,
        status: 'ACTIVE',
      },
    });
  }

  console.log('✅ Wallets created');

  // ─── Agency ───────────────────────────────────────────────────────────────

  const agency = await db.agency.create({
    data: { name: 'Tapa Express', ownerId: owner.id, verified: true },
  });

  // Assign manager and driver to agency
  await db.user.update({ where: { id: driver.id }, data: { driverAgencyId: agency.id } });

  console.log('✅ Agency created');

  // ─── Stations ─────────────────────────────────────────────────────────────

  const kigali = await db.station.create({
    data: { name: 'Kigali Central Bus Park', location: 'Kigali, Rwanda', agencyId: agency.id },
  });

  const musanze = await db.station.create({
    data: { name: 'Musanze Station', location: 'Musanze, Rwanda', agencyId: agency.id },
  });

  const huye = await db.station.create({
    data: { name: 'Huye Station', location: 'Huye, Rwanda', agencyId: agency.id },
  });

  // Assign manager to agency + station
  await db.user.update({
    where: { id: manager.id },
    data: { managedAgencyId: agency.id, managedStationId: kigali.id },
  });

  console.log('✅ Stations created');

  // ─── Vehicle ──────────────────────────────────────────────────────────────

  const vehicle = await db.vehicle.create({
    data: {
      plateNumber: 'RAB 001 A',
      model: 'Toyota Coaster',
      capacity: 30,
      agencyId: agency.id,
      driverId: driver.id,
    },
  });

  console.log('✅ Vehicle created');

  // ─── Journeys ─────────────────────────────────────────────────────────────

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const journey1 = await db.journey.create({
    data: {
      sourceStationId: kigali.id,
      destinationStationId: musanze.id,
      vehicleId: vehicle.id,
      departureTime: tomorrow,
      price: 3_000,
    },
  });

  const journey2Date = new Date(tomorrow);
  journey2Date.setHours(14, 0, 0, 0);

  await db.journey.create({
    data: {
      sourceStationId: kigali.id,
      destinationStationId: huye.id,
      vehicleId: vehicle.id,
      departureTime: journey2Date,
      price: 2_500,
    },
  });

  console.log('✅ Journeys created');

  // ─── Sample Ticket ────────────────────────────────────────────────────────
  // Pre-buy one seat so we can see the unique constraint in action
  await db.ticket.create({
    data: { userId: client.id, journeyId: journey1.id, seatNumber: 1, status: 'PAID' },
  });

  console.log('✅ Sample ticket created');

  // ─── Sample Parcel ────────────────────────────────────────────────────────
  await db.parcel.create({
    data: {
      senderId: client.id,
      journeyId: journey1.id,
      receiverName: 'Jane Doe',
      receiverPhone: '+250780000099',
      notes: 'Handle with care',
    },
  });

  console.log('✅ Sample parcel created');

  console.log('\n🎉 Seeding complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('🔑 Test credentials:');
  console.log(`  OWNER:   owner@tapa.rw   / ${ownerPassword}`);
  console.log(`  MANAGER: manager@tapa.rw / ${managerPassword}`);
  console.log(`  DRIVER:  driver@tapa.rw  / ${driverPassword}`);
  console.log(`  CLIENT:  client@tapa.rw  / ${clientPassword}`);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
