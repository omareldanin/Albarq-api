/*
  Warnings:

  - You are about to drop the column `clientId` on the `ClientOrderReceipt` table. All the data in the column will be lost.
  - Added the required column `storeId` to the `ClientOrderReceipt` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ClientOrderReceipt" DROP CONSTRAINT "ClientOrderReceipt_clientId_fkey";

-- DropIndex
DROP INDEX "ClientOrderReceipt_clientId_idx";

-- AlterTable
ALTER TABLE "ClientOrderReceipt" DROP COLUMN "clientId",
ADD COLUMN     "storeId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "ClientOrderReceipt_storeId_idx" ON "ClientOrderReceipt"("storeId");

-- AddForeignKey
ALTER TABLE "ClientOrderReceipt" ADD CONSTRAINT "ClientOrderReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
