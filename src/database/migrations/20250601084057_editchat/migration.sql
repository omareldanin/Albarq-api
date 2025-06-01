/*
  Warnings:

  - You are about to drop the column `orderId` on the `Chat` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_orderId_fkey";

-- DropIndex
DROP INDEX "Chat_orderId_key";

-- AlterTable
ALTER TABLE "Chat" DROP COLUMN "orderId",
ADD COLUMN     "receiptNumber" TEXT;
