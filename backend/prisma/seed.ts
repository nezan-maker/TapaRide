import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { encryptBalance } from '../src/lib/crypto';
import { createPrismaClient } from '../src/lib/prisma-client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not found — check backend/.env exists');
}

const db = createPrismaClient() as PrismaClient;

const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Clear existing data ───────────────────────────────────────────────────
  await db.boardingEvent.deleteMany();
  await db.bulkPassenger.deleteMany();
  await db.bulkBooking.deleteMany();
  await db.organization.deleteMany();
  await db.walletTransaction.deleteMany();
  await db.ticket.deleteMany();
  await db.parcel.deleteMany();
  await db.journeyStop.deleteMany();
  await db.journey.deleteMany();
  await db.tripPositionLog.deleteMany();
  await db.vehicle.deleteMany();
  await db.station.deleteMany();
  await db.passkey.deleteMany();
  await db.waitlistEntry.deleteMany();
  await db.idempotencyKey.deleteMany();
  await db.wallet.deleteMany();
  await db.agency.deleteMany();
  await db.aiMessage.deleteMany();
  await db.aiConversation.deleteMany();
  await db.user.deleteMany();

  // ─── Users (10 records) ───────────────────────────────────────────────────
  const passwords = {
    owner: "Owner@1234",
    owner2: "Owner2@1234",
    manager: "Manager@1234",
    manager2: "Manager2@1234",
    driver: "Driver@1234",
    driver2: "Driver2@1234",
    driver3: "Driver3@1234",
    client: "Client@1234",
  };

  const hash = (pw: string) => argon2.hash(pw, ARGON2_CONFIG);

  const [
    ownerHash,
    owner2Hash,
    managerHash,
    manager2Hash,
    driverHash,
    driver2Hash,
    driver3Hash,
    clientHash,
  ] = await Promise.all([
    hash(passwords.owner),
    hash(passwords.owner2),
    hash(passwords.manager),
    hash(passwords.manager2),
    hash(passwords.driver),
    hash(passwords.driver2),
    hash(passwords.driver3),
    hash(passwords.client),
  ]);

  const owner = await db.user.create({
    data: {
      email: "owner@tapa.rw",
      password: ownerHash,
      phone: "+250788000001",
      role: "OWNER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      ruraCode: "RURA-2024-001",
    },
  });
  const owner2 = await db.user.create({
    data: {
      email: "owner2@tapa.rw",
      password: owner2Hash,
      phone: "+250788000002",
      role: "OWNER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      ruraCode: "RURA-2024-002",
    },
  });
  const manager = await db.user.create({
    data: {
      email: "manager@tapa.rw",
      password: managerHash,
      phone: "+250788000003",
      role: "MANAGER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: "MGR-001",
    },
  });
  const manager2 = await db.user.create({
    data: {
      email: "manager2@tapa.rw",
      password: manager2Hash,
      phone: "+250788000004",
      role: "MANAGER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: "MGR-002",
    },
  });
  const driver = await db.user.create({
    data: {
      email: "driver@tapa.rw",
      password: driverHash,
      phone: "+250788000005",
      role: "DRIVER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: "DRV-001",
    },
  });
  const driver2 = await db.user.create({
    data: {
      email: "driver2@tapa.rw",
      password: driver2Hash,
      phone: "+250788000006",
      role: "DRIVER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: "DRV-002",
    },
  });
  const driver3 = await db.user.create({
    data: {
      email: "driver3@tapa.rw",
      password: driver3Hash,
      phone: "+250788000007",
      role: "DRIVER",
      isVerified: true,
      phoneVerifiedAt: new Date(),
      agencyIssuedId: "DRV-003",
    },
  });
  const client = await db.user.create({
    data: {
      email: "client@tapa.rw",
      password: clientHash,
      phone: "+250788000010",
      role: "CLIENT",
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });
  const client2 = await db.user.create({
    data: {
      email: "amina@tapa.rw",
      password: clientHash,
      phone: "+250788000011",
      role: "CLIENT",
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });
  const client3 = await db.user.create({
    data: {
      email: "jean@tapa.rw",
      password: clientHash,
      phone: "+250788000012",
      role: "CLIENT",
      isVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });

  console.log("✅ Users created (10)");

  // ─── Wallets (10 records) ─────────────────────────────────────────────────
  const usersAndBalances = [
    { user: owner, pw: passwords.owner, balance: 100_000 },
    { user: owner2, pw: passwords.owner2, balance: 80_000 },
    { user: manager, pw: passwords.manager, balance: 30_000 },
    { user: manager2, pw: passwords.manager2, balance: 25_000 },
    { user: driver, pw: passwords.driver, balance: 15_000 },
    { user: driver2, pw: passwords.driver2, balance: 12_000 },
    { user: driver3, pw: passwords.driver3, balance: 10_000 },
    { user: client, pw: passwords.client, balance: 50_000 },
    { user: client2, pw: passwords.client, balance: 25_000 },
    { user: client3, pw: passwords.client, balance: 15_000 },
  ];

  const wallets: Record<string, string> = {};
  for (const { user, pw, balance } of usersAndBalances) {
    const encrypted = encryptBalance(balance, pw);
    const walletPwHash = await argon2.hash(pw, ARGON2_CONFIG);
    const wallet = await db.wallet.create({
      data: {
        userId: user.id,
        walletPassword: walletPwHash,
        encryptedBalance: encrypted.encryptedBalance,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        salt: encrypted.salt,
        status: "ACTIVE",
      },
    });
    wallets[user.id] = wallet.id;
  }
  console.log("✅ Wallets created (10)");

  // ─── Wallet Transactions (10 records) ─────────────────────────────────────
  for (const { user, balance } of usersAndBalances) {
    await db.walletTransaction.create({
      data: {
        walletId: wallets[user.id],
        type: "TOPUP",
        status: "COMMITTED",
        direction: "CREDIT",
        amount: balance,
        note: "Initial balance",
        committedAt: new Date(),
      },
    });
  }
  console.log("✅ Wallet transactions created (10)");

  // ─── Agencies (5 records) ─────────────────────────────────────────────────
  const agency1 = await db.agency.create({
    data: {
      name: "Tapa Express",
      ownerId: owner.id,
      verified: true,
      ruraCode: "RURA-001",
    },
  });
  const agency2 = await db.agency.create({
    data: {
      name: "Kigali Bus Services",
      ownerId: owner2.id,
      verified: true,
      ruraCode: "RURA-002",
    },
  });
  const agency3 = await db.agency.create({
    data: {
      name: "Rwanda Mountain Express",
      ownerId: owner.id,
      verified: true,
      ruraCode: "RURA-003",
    },
  });
  const agency4 = await db.agency.create({
    data: {
      name: "Lake Kivu Transit",
      ownerId: owner2.id,
      verified: false,
      ruraCode: "RURA-004",
    },
  });
  const agency5 = await db.agency.create({
    data: {
      name: "Eastern Express",
      ownerId: owner.id,
      verified: true,
      ruraCode: "RURA-005",
    },
  });

  await db.user.update({
    where: { id: driver.id },
    data: { driverAgencyId: agency1.id },
  });
  await db.user.update({
    where: { id: driver2.id },
    data: { driverAgencyId: agency2.id },
  });
  await db.user.update({
    where: { id: driver3.id },
    data: { driverAgencyId: agency3.id },
  });
  await db.user.update({
    where: { id: manager.id },
    data: { managedAgencyId: agency1.id },
  });
  await db.user.update({
    where: { id: manager2.id },
    data: { managedAgencyId: agency2.id },
  });

  console.log("✅ Agencies created (5)");

  // ─── Stations (10 records) ────────────────────────────────────────────────
  const stations = await Promise.all([
    db.station.create({
      data: {
        name: "Kigali (Nyabugogo)",
        location: "-1.95,30.06",
        agencyId: agency1.id,
      },
    }),
    db.station.create({
      data: {
        name: "Musanze (Ruhengeri)",
        location: "-1.50,29.63",
        agencyId: agency1.id,
      },
    }),
    db.station.create({
      data: {
        name: "Huye (Butare)",
        location: "-2.60,29.74",
        agencyId: agency1.id,
      },
    }),
    db.station.create({
      data: {
        name: "Rubavu (Gisenyi)",
        location: "-1.68,29.26",
        agencyId: agency2.id,
      },
    }),
    db.station.create({
      data: {
        name: "Rusizi (Cyangugu)",
        location: "-2.47,28.90",
        agencyId: agency2.id,
      },
    }),
    db.station.create({
      data: {
        name: "Nyagatare",
        location: "-1.28,30.32",
        agencyId: agency3.id,
      },
    }),
    db.station.create({
      data: {
        name: "Muhanga (Gitarama)",
        location: "-2.08,29.75",
        agencyId: agency3.id,
      },
    }),
    db.station.create({
      data: {
        name: "Karongi (Kibuye)",
        location: "-2.00,29.35",
        agencyId: agency4.id,
      },
    }),
    db.station.create({
      data: {
        name: "Rwamagana",
        location: "-1.95,30.43",
        agencyId: agency5.id,
      },
    }),
    db.station.create({
      data: { name: "Kayonza", location: "-1.93,30.55", agencyId: agency5.id },
    }),
  ]);
  const [
    kigali,
    musanze,
    huye,
    rubavu,
    rusizi,
    nyagatare,
    muhanga,
    karongi,
    rwamagana,
    kayonza,
  ] = stations;

  console.log("✅ Stations created (10)");

  // ─── Vehicles (6 records) ─────────────────────────────────────────────────
  const vehicle1 = await db.vehicle.create({
    data: {
      plateNumber: "RAB 001 A",
      model: "Toyota Coaster",
      capacity: 30,
      amenities: ["WiFi", "AC", "Charging"],
      agencyId: agency1.id,
      driverId: driver.id,
    },
  });
  const vehicle2 = await db.vehicle.create({
    data: {
      plateNumber: "RAB 002 A",
      model: "Toyota Hiace",
      capacity: 18,
      amenities: ["AC", "Charging"],
      agencyId: agency1.id,
      driverId: driver2.id,
    },
  });
  const vehicle3 = await db.vehicle.create({
    data: {
      plateNumber: "RAB 003 A",
      model: "Coaster Bus",
      capacity: 28,
      amenities: ["WiFi", "AC"],
      agencyId: agency2.id,
      driverId: driver3.id,
    },
  });
  const vehicle4 = await db.vehicle.create({
    data: {
      plateNumber: "RAB 004 A",
      model: "Sprinter",
      capacity: 14,
      amenities: ["AC"],
      agencyId: agency3.id,
    },
  });
  const vehicle5 = await db.vehicle.create({
    data: {
      plateNumber: "RAB 005 A",
      model: "Toyota Coaster",
      capacity: 32,
      amenities: ["WiFi", "AC", "Restroom"],
      agencyId: agency4.id,
    },
  });
  const vehicle6 = await db.vehicle.create({
    data: {
      plateNumber: "RAB 006 A",
      model: "Hiace",
      capacity: 16,
      amenities: ["Charging"],
      agencyId: agency5.id,
    },
  });

  console.log("✅ Vehicles created (6)");

  // ─── Journeys (15 records) ────────────────────────────────────────────────
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const createJourney = async (
    source: any,
    dest: any,
    vehicle: any,
    date: Date,
    price: number,
  ) => {
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

  // Clone dates to avoid mutation side-effects across journey creation calls
  const t = (base: Date, h: number, m: number) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const j1 = await createJourney(
    kigali,
    musanze,
    vehicle1,
    t(tomorrow, 7, 0),
    3_000,
  );
  const j2 = await createJourney(
    kigali,
    huye,
    vehicle2,
    t(tomorrow, 8, 30),
    2_500,
  );
  const j3 = await createJourney(
    kigali,
    rubavu,
    vehicle1,
    t(tomorrow, 9, 0),
    3_500,
  );
  const j4 = await createJourney(
    kigali,
    rusizi,
    vehicle2,
    t(tomorrow, 10, 0),
    4_000,
  );
  const j5 = await createJourney(
    kigali,
    muhanga,
    vehicle3,
    t(tomorrow, 11, 0),
    1_500,
  );
  const j6 = await createJourney(
    kigali,
    nyagatare,
    vehicle4,
    t(dayAfter, 6, 0),
    3_500,
  );
  const j7 = await createJourney(
    kigali,
    karongi,
    vehicle5,
    t(dayAfter, 8, 0),
    3_000,
  );
  const j8 = await createJourney(
    musanze,
    kigali,
    vehicle1,
    t(dayAfter, 16, 0),
    3_000,
  );
  const j9 = await createJourney(
    huye,
    kigali,
    vehicle2,
    t(dayAfter, 17, 0),
    2_500,
  );
  const j10 = await createJourney(
    rubavu,
    kigali,
    vehicle3,
    t(dayAfter, 14, 0),
    3_500,
  );
  const j11 = await createJourney(
    kigali,
    rwamagana,
    vehicle6,
    t(tomorrow, 13, 0),
    2_000,
  );
  const j12 = await createJourney(
    rwamagana,
    kayonza,
    vehicle6,
    t(tomorrow, 15, 0),
    1_500,
  );
  const j13 = await createJourney(
    kigali,
    kayonza,
    vehicle4,
    t(dayAfter, 7, 30),
    2_500,
  );
  const j14 = await createJourney(
    musanze,
    rubavu,
    vehicle5,
    t(dayAfter, 10, 0),
    2_000,
  );
  const j15 = await createJourney(
    huye,
    rusizi,
    vehicle3,
    t(dayAfter, 12, 0),
    3_000,
  );

  console.log("✅ Journeys created (15)");

  // ─── Trip Position Logs (11 records) ──────────────────────────────────────
  const positionData = [
    { journeyId: j1.id, lat: -1.95, lng: 30.06 },
    { journeyId: j1.id, lat: -1.85, lng: 30.05 },
    { journeyId: j1.id, lat: -1.7, lng: 29.85 },
    { journeyId: j1.id, lat: -1.5, lng: 29.63 },
    { journeyId: j2.id, lat: -1.95, lng: 30.06 },
    { journeyId: j2.id, lat: -2.1, lng: 30.1 },
    { journeyId: j2.id, lat: -2.35, lng: 30.0 },
    { journeyId: j2.id, lat: -2.6, lng: 29.74 },
    { journeyId: j3.id, lat: -1.95, lng: 30.06 },
    { journeyId: j3.id, lat: -1.8, lng: 29.8 },
    { journeyId: j3.id, lat: -1.68, lng: 29.26 },
  ];

  await db.tripPositionLog.createMany({ data: positionData });
  console.log("✅ Trip position logs created (11)");

  // ─── Tickets (8 records) ──────────────────────────────────────────────────
  await db.ticket.createMany({
    data: [
      { userId: client.id, journeyId: j1.id, seatNumber: 1, status: "PAID" },
      { userId: client2.id, journeyId: j1.id, seatNumber: 2, status: "PAID" },
      { userId: client3.id, journeyId: j2.id, seatNumber: 5, status: "PAID" },
      { userId: client.id, journeyId: j3.id, seatNumber: 3, status: "PAID" },
      { userId: client2.id, journeyId: j4.id, seatNumber: 7, status: "PAID" },
      { userId: client3.id, journeyId: j5.id, seatNumber: 1, status: "PAID" },
      { userId: client.id, journeyId: j8.id, seatNumber: 4, status: "PAID" },
      { userId: client2.id, journeyId: j9.id, seatNumber: 6, status: "PAID" },
    ],
  });
  console.log("✅ Tickets created (8)");

  // ─── Parcels (6 records) ──────────────────────────────────────────────────
  await db.parcel.createMany({
    data: [
      {
        senderId: client.id,
        journeyId: j1.id,
        receiverName: "Aline Uwimana",
        receiverPhone: "+250788000099",
        notes: "Fragile - handle with care",
        status: "CONFIRMED",
        claimKey: "ABC-DEF-GHI",
        paidAt: new Date(),
      },
      {
        senderId: client2.id,
        journeyId: j2.id,
        receiverName: "Jean Paul Habimana",
        receiverPhone: "+250788000088",
        notes: "Documents inside",
        status: "IN_TRANSIT",
        claimKey: "JKL-MNO-PQR",
        paidAt: new Date(),
      },
      {
        senderId: client3.id,
        journeyId: j3.id,
        receiverName: "Marie Claire",
        receiverPhone: "+250788000077",
        notes: "Electronics",
        status: "PENDING",
      },
      {
        senderId: client.id,
        journeyId: j4.id,
        receiverName: "Patrick Ndayisaba",
        receiverPhone: "+250788000066",
        notes: "Clothes",
        status: "CLAIMED",
        claimKey: "STU-VWX-YZA",
        paidAt: new Date(),
        claimedAt: new Date(),
      },
      {
        senderId: client2.id,
        journeyId: j5.id,
        receiverName: "Grace Mukamana",
        receiverPhone: "+250788000055",
        notes: "Books",
        status: "AWAITING_PAYMENT",
      },
      {
        senderId: client3.id,
        journeyId: j6.id,
        receiverName: "Eric Habimana",
        receiverPhone: "+250788000044",
        notes: "Food items",
        status: "CONFIRMED",
        claimKey: "BCD-EFG-HIJ",
        paidAt: new Date(),
      },
    ],
  });
  console.log("✅ Parcels created (6)");

  // ─── Organizations (5 records) ────────────────────────────────────────────
  const org1 = await db.organization.create({
    data: { name: "University of Rwanda", ownerId: owner.id },
  });
  const org2 = await db.organization.create({
    data: { name: "BK Group", ownerId: owner2.id },
  });
  const org3 = await db.organization.create({
    data: { name: "Cogebanque", ownerId: owner.id },
  });
  const org4 = await db.organization.create({
    data: { name: "RDB", ownerId: owner2.id },
  });
  const org5 = await db.organization.create({
    data: { name: "Ministry of Health", ownerId: owner.id },
  });

  console.log("✅ Organizations created (5)");

  // ─── Bulk Bookings (5 records) ────────────────────────────────────────────
  const bb1 = await db.bulkBooking.create({
    data: {
      organizationId: org1.id,
      journeyId: j1.id,
      destination: "Musanze",
      departureTime: j1.departureTime,
      manifestHash: "hash1",
      signature: "sig1",
    },
  });
  const bb2 = await db.bulkBooking.create({
    data: {
      organizationId: org2.id,
      journeyId: j2.id,
      destination: "Huye",
      departureTime: j2.departureTime,
      manifestHash: "hash2",
      signature: "sig2",
    },
  });
  const bb3 = await db.bulkBooking.create({
    data: {
      organizationId: org3.id,
      journeyId: j3.id,
      destination: "Rubavu",
      departureTime: j3.departureTime,
      manifestHash: "hash3",
      signature: "sig3",
    },
  });
  const bb4 = await db.bulkBooking.create({
    data: {
      organizationId: org4.id,
      journeyId: j4.id,
      destination: "Rusizi",
      departureTime: j4.departureTime,
      manifestHash: "hash4",
      signature: "sig4",
    },
  });
  const bb5 = await db.bulkBooking.create({
    data: {
      organizationId: org5.id,
      journeyId: j5.id,
      destination: "Muhanga",
      departureTime: j5.departureTime,
      manifestHash: "hash5",
      signature: "sig5",
    },
  });

  console.log("✅ Bulk bookings created (5)");

  // ─── Bulk Passengers (10 records) ─────────────────────────────────────────
  await db.bulkPassenger.createMany({
    data: [
      {
        bulkBookingId: bb1.id,
        name: "Student A",
        nationalId: "11990001",
        seatNumber: 10,
        status: "BOARDED",
        boardingHash: "bh1",
      },
      {
        bulkBookingId: bb1.id,
        name: "Student B",
        nationalId: "11990002",
        seatNumber: 11,
        status: "BOARDED",
        boardingHash: "bh2",
      },
      {
        bulkBookingId: bb2.id,
        name: "Employee A",
        nationalId: "11990003",
        seatNumber: 5,
        status: "PENDING",
        boardingHash: "bh3",
      },
      {
        bulkBookingId: bb2.id,
        name: "Employee B",
        nationalId: "11990004",
        seatNumber: 6,
        status: "PENDING",
        boardingHash: "bh4",
      },
      {
        bulkBookingId: bb3.id,
        name: "Staff A",
        nationalId: "11990005",
        seatNumber: 8,
        status: "BOARDED",
        boardingHash: "bh5",
      },
      {
        bulkBookingId: bb3.id,
        name: "Staff B",
        nationalId: "11990006",
        seatNumber: 9,
        status: "ALIGHTED",
        boardingHash: "bh6",
      },
      {
        bulkBookingId: bb4.id,
        name: "Officer A",
        nationalId: "11990007",
        seatNumber: 3,
        status: "PENDING",
        boardingHash: "bh7",
      },
      {
        bulkBookingId: bb4.id,
        name: "Officer B",
        nationalId: "11990008",
        seatNumber: 4,
        status: "PENDING",
        boardingHash: "bh8",
      },
      {
        bulkBookingId: bb5.id,
        name: "Doctor A",
        nationalId: "11990009",
        seatNumber: 1,
        status: "BOARDED",
        boardingHash: "bh9",
      },
      {
        bulkBookingId: bb5.id,
        name: "Nurse A",
        nationalId: "11990010",
        seatNumber: 2,
        status: "BOARDED",
        boardingHash: "bh10",
      },
    ],
  });
  console.log("✅ Bulk passengers created (10)");

  // ─── Boarding Events (5 records) ──────────────────────────────────────────
  await db.boardingEvent.createMany({
    data: [
      {
        bulkBookingId: bb1.id,
        type: "BOARD",
        location: "Kigali (Nyabugogo)",
        timestamp: new Date(),
      },
      {
        bulkBookingId: bb1.id,
        type: "ALIGHT",
        location: "Musanze (Ruhengeri)",
        timestamp: new Date(),
      },
      {
        bulkBookingId: bb3.id,
        type: "BOARD",
        location: "Kigali (Nyabugogo)",
        timestamp: new Date(),
      },
      {
        bulkBookingId: bb5.id,
        type: "BOARD",
        location: "Kigali (Nyabugogo)",
        timestamp: new Date(),
      },
      {
        bulkBookingId: bb5.id,
        type: "ALIGHT",
        location: "Muhanga (Gitarama)",
        timestamp: new Date(),
      },
    ],
  });
  console.log("✅ Boarding events created (5)");

  // ─── Waitlist Entries (5 records) ─────────────────────────────────────────
  await db.waitlistEntry.createMany({
    data: [
      {
        userId: client.id,
        journeyId: j1.id,
        boardingStopId: kigali.id,
        status: "ACTIVE",
      },
      {
        userId: client2.id,
        journeyId: j2.id,
        boardingStopId: kigali.id,
        status: "ACTIVE",
      },
      {
        userId: client3.id,
        journeyId: j3.id,
        boardingStopId: kigali.id,
        status: "NOTIFIED",
      },
      {
        userId: client.id,
        journeyId: j4.id,
        boardingStopId: kigali.id,
        status: "CONVERTED",
      },
      {
        userId: client2.id,
        journeyId: j5.id,
        boardingStopId: kigali.id,
        status: "ACTIVE",
      },
    ],
  });
  console.log("✅ Waitlist entries created (5)");

  // ─── Idempotency Keys (5 records) ─────────────────────────────────────────
  await db.idempotencyKey.createMany({
    data: [
      {
        userId: client.id,
        route: "POST /api/payments/topup",
        key: "idem-1",
        requestHash: "hash1",
        state: "COMPLETED",
        statusCode: 201,
      },
      {
        userId: client2.id,
        route: "POST /api/tickets",
        key: "idem-2",
        requestHash: "hash2",
        state: "COMPLETED",
        statusCode: 201,
      },
      {
        userId: client3.id,
        route: "POST /api/parcels",
        key: "idem-3",
        requestHash: "hash3",
        state: "PROCESSING",
      },
      {
        userId: owner.id,
        route: "POST /api/agencies",
        key: "idem-4",
        requestHash: "hash4",
        state: "COMPLETED",
        statusCode: 201,
      },
      {
        userId: manager.id,
        route: "POST /api/journeys",
        key: "idem-5",
        requestHash: "hash5",
        state: "FAILED",
        statusCode: 400,
      },
    ],
  });
  console.log("✅ Idempotency keys created (5)");

  // ─── Passkeys (5 records) ─────────────────────────────────────────────────
  // Note: createMany does not work with Buffer fields on all DBs — kept as individual creates
  await db.passkey.create({
    data: {
      id: "pk-1",
      userId: client.id,
      publicKey: Buffer.from("key1"),
      counter: 0n,
      deviceName: "iPhone",
    },
  });
  await db.passkey.create({
    data: {
      id: "pk-2",
      userId: client2.id,
      publicKey: Buffer.from("key2"),
      counter: 0n,
      deviceName: "MacBook",
    },
  });
  await db.passkey.create({
    data: {
      id: "pk-3",
      userId: owner.id,
      publicKey: Buffer.from("key3"),
      counter: 0n,
      deviceName: "Pixel 8",
    },
  });
  await db.passkey.create({
    data: {
      id: "pk-4",
      userId: manager.id,
      publicKey: Buffer.from("key4"),
      counter: 0n,
      deviceName: "Samsung S24",
    },
  });
  await db.passkey.create({
    data: {
      id: "pk-5",
      userId: driver.id,
      publicKey: Buffer.from("key5"),
      counter: 0n,
      deviceName: "iPad",
    },
  });
  console.log("✅ Passkeys created (5)");

  // ─── AI Conversations & Messages (5 + 10 records) ─────────────────────────
  const conv1 = await db.aiConversation.create({ data: { userId: client.id } });
  const conv2 = await db.aiConversation.create({
    data: { userId: client2.id },
  });
  const conv3 = await db.aiConversation.create({ data: { userId: owner.id } });
  const conv4 = await db.aiConversation.create({ data: { anonymous: true } });
  const conv5 = await db.aiConversation.create({
    data: { userId: manager.id },
  });

  await db.aiMessage.createMany({
    data: [
      {
        conversationId: conv1.id,
        role: "user",
        content: "How do I book a trip?",
      },
      {
        conversationId: conv1.id,
        role: "assistant",
        content:
          "You can book a trip by searching for routes on the landing page!",
      },
      {
        conversationId: conv2.id,
        role: "user",
        content: "How does the wallet work?",
      },
      {
        conversationId: conv2.id,
        role: "assistant",
        content:
          "Your wallet is the source of truth for all TapaRide transactions.",
      },
      {
        conversationId: conv3.id,
        role: "user",
        content: "How do I register a vehicle?",
      },
      {
        conversationId: conv3.id,
        role: "assistant",
        content: "Go to your Owner Dashboard and click Register Vehicle.",
      },
      { conversationId: conv4.id, role: "user", content: "What is TapaRide?" },
      {
        conversationId: conv4.id,
        role: "assistant",
        content: "TapaRide is an inter-city transport platform for Rwanda.",
      },
      {
        conversationId: conv5.id,
        role: "user",
        content: "How do I assign a driver?",
      },
      {
        conversationId: conv5.id,
        role: "assistant",
        content: "Go to Manager Dashboard and use the Assign Driver form.",
      },
    ],
  });
  console.log("✅ AI conversations (5) and messages (10) created");

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n🎉 Seeding complete!\n");
  console.log("═════════════════════════════════════════");
  console.log("🔑 Test credentials:");
  console.log(
    `  OWNER:   owner@tapa.rw    / ${passwords.owner}   (100,000 RWF)`,
  );
  console.log(
    `  OWNER:   owner2@tapa.rw   / ${passwords.owner2}  (80,000 RWF)`,
  );
  console.log(
    `  MANAGER: manager@tapa.rw  / ${passwords.manager} (30,000 RWF)`,
  );
  console.log(
    `  MANAGER: manager2@tapa.rw / ${passwords.manager2}(25,000 RWF)`,
  );
  console.log(
    `  DRIVER:  driver@tapa.rw   / ${passwords.driver}  (15,000 RWF)`,
  );
  console.log(
    `  DRIVER:  driver2@tapa.rw  / ${passwords.driver2} (12,000 RWF)`,
  );
  console.log(
    `  DRIVER:  driver3@tapa.rw  / ${passwords.driver3} (10,000 RWF)`,
  );
  console.log(
    `  CLIENT:  client@tapa.rw   / ${passwords.client}  (50,000 RWF)`,
  );
  console.log(
    `  CLIENT:  amina@tapa.rw    / ${passwords.client}  (25,000 RWF)`,
  );
  console.log(
    `  CLIENT:  jean@tapa.rw     / ${passwords.client}  (15,000 RWF)`,
  );
  console.log("═════════════════════════════════════════");
  console.log("📊 Seeded data:");
  console.log("  Users: 10 (2 owners, 2 managers, 3 drivers, 3 clients)");
  console.log("  Wallets: 10 | Transactions: 10");
  console.log("  Agencies: 5 | Vehicles: 6 | Stations: 10");
  console.log("  Journeys: 15 | JourneyStops: 30");
  console.log("  TripPositionLogs: 11 (GPS tracking)");
  console.log("  Tickets: 8 | Parcels: 6");
  console.log("  Organizations: 5 | BulkBookings: 5 | BulkPassengers: 10");
  console.log("  BoardingEvents: 5 | WaitlistEntries: 5");
  console.log("  IdempotencyKeys: 5 | Passkeys: 5");
  console.log("  AiConversations: 5 | AiMessages: 10");
  console.log("═════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
