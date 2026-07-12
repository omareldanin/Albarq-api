/*
  Warnings:

  - The values [SUCCESSFUL_DELIVERY_WITH_AMOUNT_CHANGE] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('REGISTERED', 'READY_TO_SEND', 'WITH_DELIVERY_AGENT', 'DELIVERED', 'REPLACED', 'PARTIALLY_RETURNED', 'RETURNED', 'POSTPONED', 'CHANGE_ADDRESS', 'RESEND', 'WITH_RECEIVING_AGENT', 'PROCESSING', 'IN_MAIN_REPOSITORY', 'IN_GOV_REPOSITORY');
ALTER TABLE "AutomaticUpdate" ALTER COLUMN "newOrderStatus" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "orderStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "inquiryStatuses" TYPE "OrderStatus_new"[] USING ("inquiryStatuses"::text::"OrderStatus_new"[]);
ALTER TABLE "Employee" ALTER COLUMN "orderStatus" TYPE "OrderStatus_new"[] USING ("orderStatus"::text::"OrderStatus_new"[]);
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "OrderStatus_new" USING ("type"::text::"OrderStatus_new");
ALTER TABLE "AutomaticUpdate" ALTER COLUMN "orderStatus" TYPE "OrderStatus_new" USING ("orderStatus"::text::"OrderStatus_new");
ALTER TABLE "AutomaticUpdate" ALTER COLUMN "newOrderStatus" TYPE "OrderStatus_new" USING ("newOrderStatus"::text::"OrderStatus_new");
ALTER TABLE "ClosedStatus" ALTER COLUMN "orderStatus" TYPE "OrderStatus_new" USING ("orderStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "AutomaticUpdate" ALTER COLUMN "newOrderStatus" SET DEFAULT 'DELIVERED';
ALTER TABLE "Employee" ALTER COLUMN "orderStatus" SET DEFAULT ARRAY['REGISTERED', 'READY_TO_SEND', 'WITH_DELIVERY_AGENT', 'DELIVERED', 'REPLACED', 'PARTIALLY_RETURNED', 'RETURNED', 'POSTPONED', 'CHANGE_ADDRESS', 'RESEND', 'WITH_RECEIVING_AGENT', 'PROCESSING']::"OrderStatus"[];
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'REGISTERED';
COMMIT;

-- DropForeignKey
ALTER TABLE "ClientBranchCost" DROP CONSTRAINT "ClientBranchCost_clientId_fkey";

-- AlterTable
ALTER TABLE "ClientBranchCost" ADD COLUMN     "companyId" INTEGER,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ClientBranchCost" ADD CONSTRAINT "ClientBranchCost_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranchCost" ADD CONSTRAINT "ClientBranchCost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
