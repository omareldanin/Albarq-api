/*
  Warnings:

  - Added the required column `clientId` to the `Color` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Color" ADD COLUMN     "clientId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Color" ADD CONSTRAINT "Color_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
