-- CreateIndex
CREATE INDEX "Order_branchReportId_idx" ON "Order"("branchReportId");

-- CreateIndex
CREATE INDEX "Order_deliveryAgentReportId_idx" ON "Order"("deliveryAgentReportId");

-- CreateIndex
CREATE INDEX "Order_governorateReportId_idx" ON "Order"("governorateReportId");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_forwardedFromId_idx" ON "Order"("forwardedFromId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_deliveryAgentId_idx" ON "Order"("deliveryAgentId");

-- CreateIndex
CREATE INDEX "Order_confirmed_idx" ON "Order"("confirmed");

-- CreateIndex
CREATE INDEX "Order_processed_idx" ON "Order"("processed");

-- CreateIndex
CREATE INDEX "Order_processingStatus_idx" ON "Order"("processingStatus");

-- CreateIndex
CREATE INDEX "Order_deliveryType_idx" ON "Order"("deliveryType");

-- CreateIndex
CREATE INDEX "Order_updatedAt_idx" ON "Order"("updatedAt");

-- CreateIndex
CREATE INDEX "Order_deliveryDate_idx" ON "Order"("deliveryDate");
