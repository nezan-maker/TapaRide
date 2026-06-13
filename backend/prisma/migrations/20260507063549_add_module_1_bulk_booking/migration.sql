-- CreateEnum
CREATE TYPE "BoardingStatus" AS ENUM ('PENDING', 'BOARDED', 'ALIGHTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ORGANIZATION';

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkBooking" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkPassenger" (
    "id" TEXT NOT NULL,
    "bulkBookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "boardingHash" TEXT NOT NULL,
    "status" "BoardingStatus" NOT NULL DEFAULT 'PENDING',
    "parentPhone" TEXT,
    "parentEmail" TEXT,

    CONSTRAINT "BulkPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardingEvent" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT,
    "bulkBookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkPassenger_boardingHash_key" ON "BulkPassenger"("boardingHash");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkBooking" ADD CONSTRAINT "BulkBooking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkBooking" ADD CONSTRAINT "BulkBooking_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkPassenger" ADD CONSTRAINT "BulkPassenger_bulkBookingId_fkey" FOREIGN KEY ("bulkBookingId") REFERENCES "BulkBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingEvent" ADD CONSTRAINT "BoardingEvent_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "BulkPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingEvent" ADD CONSTRAINT "BoardingEvent_bulkBookingId_fkey" FOREIGN KEY ("bulkBookingId") REFERENCES "BulkBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
