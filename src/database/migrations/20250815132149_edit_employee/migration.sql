/*
  Warnings:

  - You are about to drop the column `governorate` on the `AutomaticUpdate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orderStatus,branchId,companyId]` on the table `AutomaticUpdate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "AutomaticUpdate_orderStatus_governorate_branchId_companyId_key";

-- AlterTable
ALTER TABLE "AutomaticUpdate" DROP COLUMN "governorate";

-- CreateTable
CREATE TABLE "ClosedStatus" (
    "id" SERIAL NOT NULL,
    "orderStatus" "OrderStatus" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "branchId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosedStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosedStatus_orderStatus_branchId_companyId_key" ON "ClosedStatus"("orderStatus", "branchId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomaticUpdate_orderStatus_branchId_companyId_key" ON "AutomaticUpdate"("orderStatus", "branchId", "companyId");

-- AddForeignKey
ALTER TABLE "ClosedStatus" ADD CONSTRAINT "ClosedStatus_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosedStatus" ADD CONSTRAINT "ClosedStatus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
