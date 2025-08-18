/*
  Warnings:

  - You are about to drop the column `deliveryAgentDeliveryCost` on the `BranchReport` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryAgentDeliveryCost` on the `GovernorateReport` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BranchReport" DROP COLUMN "deliveryAgentDeliveryCost",
ADD COLUMN     "baghdadDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "governoratesDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GovernorateReport" DROP COLUMN "deliveryAgentDeliveryCost",
ADD COLUMN     "baghdadDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "governoratesDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
