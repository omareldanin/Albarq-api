-- CreateIndex
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");

-- CreateIndex
CREATE INDEX "Order_locationId_idx" ON "Order"("locationId");

-- CreateIndex
CREATE INDEX "Order_printed_idx" ON "Order"("printed");

-- CreateIndex
CREATE INDEX "Order_deleted_idx" ON "Order"("deleted");

-- CreateIndex
CREATE INDEX "Order_companyId_storeId_createdAt_idx" ON "Order"("companyId", "storeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_locationId_createdAt_idx" ON "Order"("companyId", "locationId", "createdAt" DESC);
