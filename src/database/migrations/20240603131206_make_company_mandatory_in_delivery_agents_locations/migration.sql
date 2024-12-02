/*
  Warnings:

  - Made the column `companyId` on table `DeliveryAgentsLocations` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "DeliveryAgentsLocations" DROP CONSTRAINT "DeliveryAgentsLocations_companyId_fkey";

-- AlterTable
ALTER TABLE "DeliveryAgentsLocations" ALTER COLUMN "companyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "DeliveryAgentsLocations" ADD CONSTRAINT "DeliveryAgentsLocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
