/*
  Warnings:

  - A unique constraint covering the columns `[reportId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Order_companyId_deleted_status_branchId_createdAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reportId_key" ON "Transaction"("reportId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
