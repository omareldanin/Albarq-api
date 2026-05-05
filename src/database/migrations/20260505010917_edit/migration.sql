-- DropIndex
DROP INDEX "Order_branchId_idx";

-- DropIndex
DROP INDEX "Order_clientId_idx";

-- DropIndex
DROP INDEX "Order_companyId_idx";

-- DropIndex
DROP INDEX "Order_deliveryAgentId_idx";

-- DropIndex
DROP INDEX "Order_governorate_idx";

-- DropIndex
DROP INDEX "Order_secondaryStatus_idx";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Order_storeId_idx";

-- CreateIndex
CREATE INDEX "BranchReport_branchId_type_idx" ON "BranchReport"("branchId", "type");

-- CreateIndex
CREATE INDEX "ClientReport_secondaryType_idx" ON "ClientReport"("secondaryType");

-- CreateIndex
CREATE INDEX "ClientReport_clientId_secondaryType_idx" ON "ClientReport"("clientId", "secondaryType");

-- CreateIndex
CREATE INDEX "ClientReport_storeId_secondaryType_idx" ON "ClientReport"("storeId", "secondaryType");

-- CreateIndex
CREATE INDEX "Order_companyId_confirmed_createdAt_idx" ON "Order"("companyId", "confirmed", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_status_createdAt_idx" ON "Order"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_branchId_status_createdAt_idx" ON "Order"("branchId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_clientId_status_createdAt_idx" ON "Order"("clientId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_deliveryAgentId_status_createdAt_idx" ON "Order"("deliveryAgentId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Report_deleted_idx" ON "Report"("deleted");

-- CreateIndex
CREATE INDEX "RepositoryReport_secondaryType_idx" ON "RepositoryReport"("secondaryType");

-- CreateIndex
CREATE INDEX "RepositoryReport_repositoryId_secondaryType_idx" ON "RepositoryReport"("repositoryId", "secondaryType");
