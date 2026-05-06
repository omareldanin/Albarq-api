CREATE INDEX IF NOT EXISTS "Notification_userId_id_idx"
ON "Notification" ("userId", "id");

CREATE INDEX IF NOT EXISTS "Notification_userId_seen_id_idx"
ON "Notification" ("userId", "seen", "id");

CREATE INDEX IF NOT EXISTS "OrderTimeline_orderId_createdAt_idx"
ON "OrderTimeline" ("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderTimeline_orderId_type_createdAt_idx"
ON "OrderTimeline" ("orderId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "_BranchReportToOrder_A_idx"
ON "_BranchReportToOrder" ("A");

CREATE INDEX IF NOT EXISTS "_ClientReportToOrder_A_idx"
ON "_ClientReportToOrder" ("A");

CREATE INDEX IF NOT EXISTS "_OrderToRepositoryReport_A_idx"
ON "_OrderToRepositoryReport" ("A");