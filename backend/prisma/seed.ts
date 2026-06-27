import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as argon2 from 'argon2';
import { encryptBalance } from '../src/lib/crypto';
import 'dotenv/config';

const connectionString = `${process.env['DATABASE_URL']}`;
const adapter = new PrismaNeon({ connectionString });
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
  await db.journeyStop.deleteMany();
  await db.journey.deleteMany();
  await db.vehicle.deleteMany();
  await db.station.deleteMany();
  await db.passkey.deleteMany();
  await db.wallet.deleteMany();
  await db.agency.deleteMany();
  await db.user.deleteMany();

  // ─── Users ────────────────────────────────────────────────────────────────
  const passwords = {
    owner: 'Owner@1234',
    manager: 'Manager@1234',
    driver: 'Driver@1234',
    client: 'Client@1234',
  };

  const [ownerHash, managerHash, driverHash, clientHash] = await Promise.all([
    argon2.hash(passwords.owner, ARGON2_CONFIG),
    argon2.hash(passwords.manager, ARGON2_CONFIG),
    argon2.hash(passwords.driver, ARGON2_CONFIG),
    argon2.hash(passwords.client, ARGON2_CONFIG),
  ]);

  const owner = await db.user.create({
    data: {
      email: 'owner@tapa.rw',
      password: ownerHash,
      phone: '+250788000001',
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
      phone: '+250788000002',
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
      phone: '+250788000003',
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
      phone: '+250788000004',
      role: 'CLIENT',
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });

  // Additional clients for testing
  const client2 = await db.user.create({
    data: {
      email: 'amina@tapa.rw',
      password: clientHash,
      phone: '+250788000005',
      role: 'CLIENT',
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });

  const client3 = await db.user.create({
    data: {
      email: 'jean@tapa.rw',
      password: clientHash,
      phone: '+250788000006',
      role: 'CLIENT',
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });

  console.log('✅ Users created');

  // ─── Wallets ──────────────────────────────────────────────────────────────
  const usersAndPasswords = [
    { user: owner, password: passwords.owner },
    { user: manager, password: passwords.manager },
    { user: driver, password: passwords.driver },
    { user: client, password: passwords.client, balance: 50_000 },
    { user: client2, password: passwords.client, balance: 25_000 },
    { user: client3, password: passwords.client, balance: 15_000 },
  ];

  for (const { user, password, balance = 10_000 } of usersAndPasswords) {
    const encrypted = encryptBalance(balance, password);
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

  await db.user.update({ where: { id: driver.id }, data: { driverAgencyId: agency.id } });
  await db.user.update({
    where: { id: manager.id },
    data: { managedAgencyId: agency.id },
  });

  console.log('✅ Agency created');

  // ─── Stations (all major Rwandan cities) ─────────────────────────────────
  const stations = await Promise.all([
    db.station.create({ data: { name: 'Kigali (Nyabugogo)', location: '-1.95,30.06', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Musanze (Ruhengeri)', location: '-1.50,29.63', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Huye (Butare)', location: '-2.60,29.74', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Rubavu (Gisenyi)', location: '-1.68,29.26', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Rusizi (Cyangugu)', location: '-2.47,28.90', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Nyagatare', location: '-1.28,30.32', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Muhanga (Gitarama)', location: '-2.08,29.75', agencyId: agency.id } }),
    db.station.create({ data: { name: 'Karongi (Kibuye)', location: '-2.00,29.35', agencyId: agency.id } }),
  ]);

  const [kigali, musanze, huye, rubavu, rusizi, nyagatare, muhanga, karongi] = stations;

  console.log('✅ Stations created');

  // ─── Vehicles ─────────────────────────────────────────────────────────────
  const vehicle1 = await db.vehicle.create({
    data: { plateNumber: 'RAB 001 A', model: 'Toyota Coaster', capacity: 30, agencyId: agency.id, driverId: driver.id },
  });

  const vehicle2 = await db.vehicle.create({
    data: { plateNumber: 'RAB 002 A', model: 'Toyota Hiace', capacity: 18, agencyId: agency.id, driverId: driver.id },
  });

  console.log('✅ Vehicles created');

  // ─── Journeys (multiple routes and times) ─────────────────────────────────
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  // Helper to create journey with stops
  const createJourney = async (source: any, dest: any, vehicle: any, date: Date, price: number) => {
    const journey = await db.journey.create({
      data: {
        sourceStationId: source.id,
        destinationStationId: dest.id,
        vehicleId: vehicle.id,
        departureTime: date,
        price,
      },
    });

    await db.journeyStop.createMany({
      data: [
        { journeyId: journey.id, stationId: source.id, order: 1 },
        { journeyId: journey.id, stationId: dest.id, order: 2 },
      ],
    });

    return journey;
  };

  // Kigali → Musanze (popular route)
  await createJourney(kigali, musanze, vehicle1, new Date(tomorrow.setHours(7, 0, 0, 0)), 3_000);
  await createJourney(kigali, musanze, vehicle2, new Date(tomorrow.setHours(14, 0, 0, 0)), 3_000);

  // Kigali → Huye
  await createJourney(kigali, huye, vehicle1, new Date(tomorrow.setHours(8, 30, 0, 0)), 2_500);
  await createJourney(kigali, huye, vehicle2, new Date(tomorrow.setHours(15, 0, 0, 0)), 2_500);

  // Kigali → Rubavu
  await createJourney(kigali, rubavu, vehicle1, new Date(tomorrow.setHours(9, 0, 0, 0)), 3_500);

  // Kigali → Rusizi
  await createJourney(kigali, rusizi, vehicle2, new Date(tomorrow.setHours(10, 0, 0, 0)), 4_000);

  // Musanze → Kigali (return trips)
  await createJourney(musanze, kigali, vehicle1, new Date(dayAfter.setHours(16, 0, 0, 0)), 3_000);

  // Huye → Kigali (return trip)
  await createJourney(huye, kigali, vehicle2, new Date(dayAfter.setHours(17, 0, 0, 0)), 2_500);

  // Kigali → Nyagatare
  await createJourney(kigali, nyagatare, vehicle1, new Date(dayAfter.setHours(6, 0, 0, 0)), 3_500);

  // Kigali → Muhanga
  await createJourney(kigali, muhanga, vehicle2, new Date(tomorrow.setHours(11, 0, 0, 0)), 1_500);

  // Kigali → Karongi
  await createJourney(kigali, karongi, vehicle1, new Date(dayAfter.setHours(8, 0, 0, 0)), 3_000);

  console.log('✅ Journeys created');

  // ─── Sample Tickets ───────────────────────────────────────────────────────
  const journeys = await db.journey.findMany({ take: 3 });

  if (journeys.length > 0) {
    await db.ticket.create({
      data: { userId: client.id, journeyId: journeys[0].id, seatNumber: 1, status: 'PAID' },
    });
    await db.ticket.create({
      data: { userId: client2.id, journeyId: journeys[0].id, seatNumber: 2, status: 'PAID' },
    });
    if (journeys.length > 1) {
      await db.ticket.create({
        data: { userId: client3.id, journeyId: journeys[1].id, seatNumber: 5, status: 'PAID' },
      });
    }
  }

  console.log('✅ Sample tickets created');

  // ─── Sample Parcels ───────────────────────────────────────────────────────
  if (journeys.length > 0) {
    await db.parcel.create({
      data: {
        senderId: client.id,
        journeyId: journeys[0].id,
        receiverName: 'Aline Uwimana',
        receiverPhone: '+250788000099',
        notes: 'Fragile - handle with care',
      },
    });
    await db.parcel.create({
      data: {
        senderId: client2.id,
        journeyId: journeys.length > 1 ? journeys[1].id : journeys[0].id,
        receiverName: 'Jean Paul Habimana',
        receiverPhone: '+250788000088',
        notes: 'Documents inside',
      },
    });
  }

  console.log('✅ Sample parcels created');

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n🎉 Seeding complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('🔑 Test credentials:');
  console.log(`  OWNER:   owner@tapa.rw    / ${passwords.owner}`);
  console.log(`  MANAGER: manager@tapa.rw  / ${passwords.manager}`);
  console.log(`  DRIVER:  driver@tapa.rw   / ${passwords.driver}`);
  console.log(`  CLIENT:  client@tapa.rw   / ${passwords.client} (50,000 RWF)`);
  console.log(`  CLIENT:  amina@tapa.rw    / ${passwords.client} (25,000 RWF)`);
  console.log(`  CLIENT:  jean@tapa.rw     / ${passwords.client} (15,000 RWF)`);
  console.log('─────────────────────────────────────────');
  console.log('📊 Seeded data:');
  console.log('  6 users (1 owner, 1 manager, 1 driver, 3 clients)');
  console.log('  8 stations (all major Rwandan cities)');
  console.log('  2 vehicles (Toyota Coaster 30-seat, Toyota Hiace 18-seat)');
  console.log('  10+ journeys across multiple routes and times');
  console.log('  3 sample tickets');
  console.log('  2 sample parcels');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });