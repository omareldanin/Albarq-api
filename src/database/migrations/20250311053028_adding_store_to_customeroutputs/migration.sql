-- AlterTable
ALTER TABLE "CustomerOutput" ADD COLUMN     "storeId" INTEGER;

-- AddForeignKey
ALTER TABLE "CustomerOutput" ADD CONSTRAINT "CustomerOutput_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
