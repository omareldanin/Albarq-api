-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'ADD_PRODUCT';
ALTER TYPE "Permission" ADD VALUE 'NOTIFICATIONS';
ALTER TYPE "Permission" ADD VALUE 'MESSAGES';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_ORDERS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_REPORTS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_EMPLOYEES';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "clientId" INTEGER,
ALTER COLUMN "idCard" DROP NOT NULL,
ALTER COLUMN "residencyCard" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
