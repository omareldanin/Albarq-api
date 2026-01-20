-- CreateTable
CREATE TABLE "MessageSeen" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageSeen_messageId_userId_key" ON "MessageSeen"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "MessageSeen" ADD CONSTRAINT "MessageSeen_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSeen" ADD CONSTRAINT "MessageSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
