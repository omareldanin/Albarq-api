-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "_BranchReportToOrder_A_idx";

-- DropIndex
DROP INDEX "_ClientReportToOrder_A_idx";

-- DropIndex
DROP INDEX "_OrderToRepositoryReport_A_idx";

-- CreateIndex
CREATE INDEX "Notification_userId_id_idx" ON "Notification"("userId", "id");

-- CreateIndex
CREATE INDEX "Notification_userId_seen_idx" ON "Notification"("userId", "seen");

-- CreateIndex
CREATE INDEX "Notification_userId_seen_id_idx" ON "Notification"("userId", "seen", "id");
