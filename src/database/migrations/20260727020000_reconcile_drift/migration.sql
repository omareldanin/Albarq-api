-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_reportId_fkey";

-- DropIndex
DROP INDEX "Order_companyId_status_deleted_createdAt_idx";

-- DropIndex
DROP INDEX "Transaction_approved_deleted_idx";

-- DropIndex
DROP INDEX "Transaction_branchId_deleted_approved_companyId_idx";

-- DropIndex
DROP INDEX "Transaction_reportId_key";

-- CreateIndex
CREATE INDEX "Order_companyId_deleted_status_branchId_createdAt_idx" ON "Order"("companyId", "deleted", "status", "branchId", "createdAt");

