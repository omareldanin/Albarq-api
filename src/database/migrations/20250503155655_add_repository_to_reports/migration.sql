/*
  Warnings:

  - You are about to drop the column `namse` on the `Department` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClientReport" ADD COLUMN     "repositoryId" INTEGER;

-- AlterTable
ALTER TABLE "CompanyReport" ADD COLUMN     "repositoryId" INTEGER;

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "namse";

-- AddForeignKey
ALTER TABLE "CompanyReport" ADD CONSTRAINT "CompanyReport_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReport" ADD CONSTRAINT "ClientReport_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
