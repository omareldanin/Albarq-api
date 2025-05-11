-- DropForeignKey
ALTER TABLE "ClientOrderReceipt" DROP CONSTRAINT "ClientOrderReceipt_storeId_fkey";

-- AlterTable
ALTER TABLE "ClientOrderReceipt" ALTER COLUMN "storeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ClientOrderReceipt" ADD CONSTRAINT "ClientOrderReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
