/*
  Warnings:

  - A unique constraint covering the columns `[companyId,branchId]` on the table `ClientBranchCost` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reportId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'CREATE_EMPLOYEE_REPORT';
ALTER TYPE "Permission" ADD VALUE 'DELETE_EMPLOYEE_REPORT';

-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'EMPLOYEE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'WITHDRAW_FROM_MAIN';
ALTER TYPE "TransactionType" ADD VALUE 'DEPOSIT_FROM_MAIN';

-- DropIndex
DROP INDEX "Order_companyId_locationId_deleted_createdAt_idx";

-- DropIndex
DROP INDEX "Order_companyId_storeId_deleted_createdAt_idx";

-- DropIndex
DROP INDEX "Order_forwardedFromId_deleted_createdAt_idx";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "activeProfit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "employeeReportId" INTEGER,
ADD COLUMN     "forwardedBranchNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "insideBranchNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receivingBranchNet" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "activeProfit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "branchNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "clientNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryAgentNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "forwardedBranchNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "insideBranchNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receivingBranchNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reportId" INTEGER,
ADD COLUMN     "totalPaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmployeeClientCommission" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "baghdadOrderCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "govOrderCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeClientCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeReport" (
    "id" INTEGER NOT NULL,
    "employeeId" INTEGER,

    CONSTRAINT "EmployeeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeClientCommission_clientId_key" ON "EmployeeClientCommission"("clientId");

-- CreateIndex
CREATE INDEX "EmployeeClientCommission_employeeId_idx" ON "EmployeeClientCommission"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeClientCommission_clientId_idx" ON "EmployeeClientCommission"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeClientCommission_employeeId_clientId_key" ON "EmployeeClientCommission"("employeeId", "clientId");

-- CreateIndex
CREATE INDEX "EmployeeReport_employeeId_idx" ON "EmployeeReport"("employeeId");

-- CreateIndex
CREATE INDEX "ClientBranchCost_companyId_idx" ON "ClientBranchCost"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBranchCost_companyId_branchId_key" ON "ClientBranchCost"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "Order_employeeReportId_idx" ON "Order"("employeeReportId");

-- CreateIndex
CREATE INDEX "Order_companyId_deleted_deliveryAgentId_createdAt_idx" ON "Order"("companyId", "deleted", "deliveryAgentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reportId_key" ON "Transaction"("reportId");

-- CreateIndex
CREATE INDEX "Transaction_branchId_deleted_approved_companyId_idx" ON "Transaction"("branchId", "deleted", "approved", "companyId");

-- CreateIndex
CREATE INDEX "Transaction_approved_deleted_idx" ON "Transaction"("approved", "deleted");

-- AddForeignKey
ALTER TABLE "EmployeeClientCommission" ADD CONSTRAINT "EmployeeClientCommission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeClientCommission" ADD CONSTRAINT "EmployeeClientCommission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeReportId_fkey" FOREIGN KEY ("employeeReportId") REFERENCES "EmployeeReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeReport" ADD CONSTRAINT "EmployeeReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeReport" ADD CONSTRAINT "EmployeeReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
