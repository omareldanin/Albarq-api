-- CreateIndex
-- CONCURRENTLY so adding the index doesn't block order writes while it builds.
-- It must be the only statement in this migration (it can't run in a transaction).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_recipientPhones_idx" ON "Order" USING GIN ("recipientPhones");
