-- AlterTable
ALTER TABLE "ClientOrderReceipt" ADD COLUMN     "notes" TEXT DEFAULT '';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientNotes" TEXT NOT NULL DEFAULT '';
