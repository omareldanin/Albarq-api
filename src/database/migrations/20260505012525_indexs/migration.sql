-- Notification
DROP INDEX IF EXISTS "Notification_userId_idx";

CREATE INDEX IF NOT EXISTS "Notification_userId_seen_idx"
ON "Notification"("userId", "seen");

CREATE INDEX IF NOT EXISTS "Notification_userId_id_idx"
ON "Notification"("userId", "id");

CREATE INDEX IF NOT EXISTS "Notification_userId_seen_id_idx"
ON "Notification"("userId", "seen", "id");

-- OrderTimeline
CREATE INDEX IF NOT EXISTS "OrderTimeline_orderId_createdAt_idx"
ON "OrderTimeline"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderTimeline_orderId_type_createdAt_idx"
ON "OrderTimeline"("orderId", "type", "createdAt");

-- _BranchReportToOrder
CREATE INDEX IF NOT EXISTS "_BranchReportToOrder_A_idx"
ON "_BranchReportToOrder"("A");

-- _ClientReportToOrder
CREATE INDEX IF NOT EXISTS "_ClientReportToOrder_A_idx"
ON "_ClientReportToOrder"("A");

-- _OrderToRepositoryReport
CREATE INDEX IF NOT EXISTS "_OrderToRepositoryReport_A_idx"
ON "_OrderToRepositoryReport"("A");