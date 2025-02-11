/*
  Warnings:

  - A unique constraint covering the columns `[clientOrderReceiptId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientOrderReceiptId" INTEGER;

-- CreateTable
CREATE TABLE "ClientOrderReceipt" (
    "id" SERIAL NOT NULL,
    "receiptNumber" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientOrderReceipt_clientId_idx" ON "ClientOrderReceipt"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientOrderReceiptId_key" ON "Order"("clientOrderReceiptId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientOrderReceiptId_fkey" FOREIGN KEY ("clientOrderReceiptId") REFERENCES "ClientOrderReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOrderReceipt" ADD CONSTRAINT "ClientOrderReceipt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
