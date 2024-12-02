-- CreateTable
CREATE TABLE "UsersLoginHistory" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsersLoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsersLoginHistory_userId_idx" ON "UsersLoginHistory"("userId");

-- AddForeignKey
ALTER TABLE "UsersLoginHistory" ADD CONSTRAINT "UsersLoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
