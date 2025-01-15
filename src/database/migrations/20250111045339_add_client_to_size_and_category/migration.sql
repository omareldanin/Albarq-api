/*
  Warnings:

  - Added the required column `clientId` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientId` to the `Size` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "clientId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Size" ADD COLUMN     "clientId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Size" ADD CONSTRAINT "Size_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
