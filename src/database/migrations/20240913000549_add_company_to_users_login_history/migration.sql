/*
  Warnings:

  - Added the required column `companyId` to the `UsersLoginHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UsersLoginHistory" ADD COLUMN     "companyId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "UsersLoginHistory_companyId_idx" ON "UsersLoginHistory"("companyId");

-- AddForeignKey
ALTER TABLE "UsersLoginHistory" ADD CONSTRAINT "UsersLoginHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
