-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastPasswordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "passwordHistory" TEXT[];
