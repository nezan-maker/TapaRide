/*
  Warnings:

  - The primary key for the `AiConversation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AiMessage` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "AiMessage" DROP CONSTRAINT "AiMessage_conversationId_fkey";

-- AlterTable
ALTER TABLE "AiConversation" DROP CONSTRAINT "AiConversation_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AiMessage" DROP CONSTRAINT "AiMessage_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "conversationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "amenities" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WalletTransaction" ALTER COLUMN "direction" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Agency_ownerId_idx" ON "Agency"("ownerId");

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
