/*
  Warnings:

  - You are about to drop the column `clientReportId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `returnedClientReportId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `returnedCompanyReportId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `returnedRepositoryReportId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the `ReturnedClientReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReturnedCompanyReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReturnedRepositoryReport` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_clientReportId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_returnedClientReportId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_returnedCompanyReportId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_returnedRepositoryReportId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedClientReport" DROP CONSTRAINT "ReturnedClientReport_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedClientReport" DROP CONSTRAINT "ReturnedClientReport_id_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedClientReport" DROP CONSTRAINT "ReturnedClientReport_repositoryId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedClientReport" DROP CONSTRAINT "ReturnedClientReport_storeId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedCompanyReport" DROP CONSTRAINT "ReturnedCompanyReport_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedCompanyReport" DROP CONSTRAINT "ReturnedCompanyReport_id_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedCompanyReport" DROP CONSTRAINT "ReturnedCompanyReport_repositoryId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedRepositoryReport" DROP CONSTRAINT "ReturnedRepositoryReport_id_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedRepositoryReport" DROP CONSTRAINT "ReturnedRepositoryReport_repositoryId_fkey";

-- AlterTable
ALTER TABLE "ClientOrderReceipt" ADD COLUMN     "paperReceipt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "clientReportId",
DROP COLUMN "returnedClientReportId",
DROP COLUMN "returnedCompanyReportId",
DROP COLUMN "returnedRepositoryReportId";

-- DropTable
DROP TABLE "ReturnedClientReport";

-- DropTable
DROP TABLE "ReturnedCompanyReport";

-- DropTable
DROP TABLE "ReturnedRepositoryReport";

-- CreateTable
CREATE TABLE "_ClientReportToOrder" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ClientReportToOrder_AB_unique" ON "_ClientReportToOrder"("A", "B");

-- CreateIndex
CREATE INDEX "_ClientReportToOrder_B_index" ON "_ClientReportToOrder"("B");

-- AddForeignKey
ALTER TABLE "_ClientReportToOrder" ADD CONSTRAINT "_ClientReportToOrder_A_fkey" FOREIGN KEY ("A") REFERENCES "ClientReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientReportToOrder" ADD CONSTRAINT "_ClientReportToOrder_B_fkey" FOREIGN KEY ("B") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
