-- DropIndex
DROP INDEX "OrderTimeline_orderId_idx";

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_createdAt_idx" ON "OrderTimeline"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_type_createdAt_idx" ON "OrderTimeline"("orderId", "type", "createdAt");
