CREATE INDEX IF NOT EXISTS "Notification_userId_id_idx"
ON "Notification"("userId", "id");

CREATE INDEX IF NOT EXISTS "Notification_userId_seen_id_idx"
ON "Notification"("userId", "seen", "id");

CREATE INDEX IF NOT EXISTS "OrderTimeline_orderId_createdAt_idx"
ON "OrderTimeline"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderTimeline_orderId_type_createdAt_idx"
ON "OrderTimeline"("orderId", "type", "createdAt");