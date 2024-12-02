/*
  Warnings:

  - You are about to drop the column `companyId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `Color` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `Size` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Color" DROP CONSTRAINT "Color_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Size" DROP CONSTRAINT "Size_companyId_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "Color" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "branchId" DROP NOT NULL,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Size" DROP COLUMN "companyId";

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
