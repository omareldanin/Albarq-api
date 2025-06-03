/*
  Warnings:

  - You are about to drop the column `companyReportId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `repositoryReportId` on the `Order` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_companyReportId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_repositoryReportId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "companyReportId",
DROP COLUMN "repositoryReportId";

-- CreateTable
CREATE TABLE "_OrderToRepositoryReport" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_CompanyReportToOrder" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_OrderToRepositoryReport_AB_unique" ON "_OrderToRepositoryReport"("A", "B");

-- CreateIndex
CREATE INDEX "_OrderToRepositoryReport_B_index" ON "_OrderToRepositoryReport"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyReportToOrder_AB_unique" ON "_CompanyReportToOrder"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyReportToOrder_B_index" ON "_CompanyReportToOrder"("B");

-- AddForeignKey
ALTER TABLE "_OrderToRepositoryReport" ADD CONSTRAINT "_OrderToRepositoryReport_A_fkey" FOREIGN KEY ("A") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrderToRepositoryReport" ADD CONSTRAINT "_OrderToRepositoryReport_B_fkey" FOREIGN KEY ("B") REFERENCES "RepositoryReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyReportToOrder" ADD CONSTRAINT "_CompanyReportToOrder_A_fkey" FOREIGN KEY ("A") REFERENCES "CompanyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyReportToOrder" ADD CONSTRAINT "_CompanyReportToOrder_B_fkey" FOREIGN KEY ("B") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
