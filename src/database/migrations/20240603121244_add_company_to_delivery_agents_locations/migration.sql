-- AlterTable
ALTER TABLE "DeliveryAgentsLocations" ADD COLUMN     "companyId" INTEGER;

-- AddForeignKey
ALTER TABLE "DeliveryAgentsLocations" ADD CONSTRAINT "DeliveryAgentsLocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
