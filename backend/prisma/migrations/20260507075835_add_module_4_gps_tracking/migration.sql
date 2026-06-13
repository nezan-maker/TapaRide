-- CreateTable
CREATE TABLE "TripPositionLog" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPositionLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TripPositionLog" ADD CONSTRAINT "TripPositionLog_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
