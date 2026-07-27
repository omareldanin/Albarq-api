-- CreateIndex
CREATE INDEX "BranchReport_branchId_type_id_idx" ON "BranchReport"("branchId", "type", "id");

-- CreateIndex
CREATE INDEX "ClientReport_clientId_secondaryType_id_idx" ON "ClientReport"("clientId", "secondaryType", "id");

-- CreateIndex
CREATE INDEX "DeliveryAgentReport_deliveryAgentId_id_idx" ON "DeliveryAgentReport"("deliveryAgentId", "id");

-- CreateIndex
CREATE INDEX "Order_companyId_deleted_receivedAt_idx" ON "Order"("companyId", "deleted", "receivedAt");

-- CreateIndex
CREATE INDEX "Order_deliveryAgentId_deliveryDate_idx" ON "Order"("deliveryAgentId", "deliveryDate");

-- CreateIndex
CREATE INDEX "Report_deleted_activeProfit_idx" ON "Report"("deleted", "activeProfit");

-- CreateIndex
CREATE INDEX "Transaction_reportId_deleted_approved_idx" ON "Transaction"("reportId", "deleted", "approved");
