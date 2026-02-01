-- CreateIndex
CREATE INDEX "idx_message_chat_created" ON "Message"("chatId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_message_chat_creator" ON "Message"("chatId", "createdById");

-- CreateIndex
CREATE INDEX "idx_message_createdBy" ON "Message"("createdById");

-- CreateIndex
CREATE INDEX "idx_seenBy_user" ON "MessageSeen"("userId");

-- CreateIndex
CREATE INDEX "idx_seenBy_message" ON "MessageSeen"("messageId");
