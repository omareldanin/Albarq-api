-- DropIndex
DROP INDEX "idx_seenBy_user";

-- CreateIndex
CREATE INDEX "idx_seenBy_user_message" ON "MessageSeen"("userId", "messageId");
