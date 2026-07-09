-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'SUCCESSFUL_DELIVERY_WITH_AMOUNT_CHANGE';

-- AlterEnum
ALTER TYPE "SecondaryStatus" ADD VALUE 'SEND_TO_COMPANY';

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_createdById_fkey";

-- DropIndex
DROP INDEX "Order_branchId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_branchId_status_createdAt_idx";

-- DropIndex
DROP INDEX "Order_clientId_idx";

-- DropIndex
DROP INDEX "Order_companyId_confirmed_createdAt_idx";

-- DropIndex
DROP INDEX "Order_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_companyId_idx";

-- DropIndex
DROP INDEX "Order_companyId_locationId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_companyId_status_createdAt_idx";

-- DropIndex
DROP INDEX "Order_companyId_storeId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_confirmed_idx";

-- DropIndex
DROP INDEX "Order_createdAt_idx";

-- DropIndex
DROP INDEX "Order_deleted_idx";

-- DropIndex
DROP INDEX "Order_deliveryAgentId_idx";

-- DropIndex
DROP INDEX "Order_deliveryType_idx";

-- DropIndex
DROP INDEX "Order_forwardedFromId_idx";

-- DropIndex
DROP INDEX "Order_locationId_idx";

-- DropIndex
DROP INDEX "Order_printed_idx";

-- DropIndex
DROP INDEX "Order_processed_idx";

-- DropIndex
DROP INDEX "Order_processingStatus_idx";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Order_storeId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_storeId_idx";

-- DropIndex
DROP INDEX "Repository_name_key";

-- DropIndex
DROP INDEX "Store_name_key";

-- DropIndex
DROP INDEX "_BranchReportToOrder_A_idx";

-- DropIndex
DROP INDEX "_ClientReportToOrder_A_idx";

-- DropIndex
DROP INDEX "_OrderToRepositoryReport_A_idx";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "forwardedDeliveryCosts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "receivingDeliveryCosts" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activeProfit" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "additionalPriceForEvery500000IraqiDinar",
DROP COLUMN "additionalPriceForEveryKilogram",
DROP COLUMN "additionalPriceForRemoteAreas",
DROP COLUMN "baghdadPrice",
DROP COLUMN "color",
DROP COLUMN "deliveryAgentFee",
DROP COLUMN "governoratePrice",
DROP COLUMN "orderStatusAutomaticUpdate",
DROP COLUMN "treasury",
DROP COLUMN "website",
ADD COLUMN     "apiKeyHash" TEXT,
ADD COLUMN     "governoratesDeliveryCosts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "isExternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "targetCompanyId" INTEGER,
ADD COLUMN     "webhookUrl" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shipment_number" TEXT;

-- CreateTable
CREATE TABLE "ClientBranchCost" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "deliveryAgentProfit" INTEGER NOT NULL DEFAULT 0,
    "mainBranchProfit" INTEGER NOT NULL DEFAULT 0,
    "forwardedBranchProfit" INTEGER NOT NULL DEFAULT 0,
    "receivingBranchProfit" INTEGER NOT NULL DEFAULT 0,
    "activeProfit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBranchCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientBranchCost_branchId_idx" ON "ClientBranchCost"("branchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBranchCost_clientId_branchId_key" ON "ClientBranchCost"("clientId" ASC, "branchId" ASC);

-- CreateIndex
CREATE INDEX "ClientBranchCost_clientId_idx" ON "ClientBranchCost"("clientId" ASC);

-- CreateIndex
CREATE INDEX "Chat_orderId_idx" ON "Chat"("orderId" ASC);

-- CreateIndex
CREATE INDEX "Client_branchId_idx" ON "Client"("branchId" ASC);

-- CreateIndex
CREATE INDEX "ClientReport_id_secondaryType_idx" ON "ClientReport"("id" ASC, "secondaryType" ASC);

-- CreateIndex
CREATE INDEX "idx_notification_user_id" ON "Notification"("userId" ASC, "id" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_user_seen_id" ON "Notification"("userId" ASC, "seen" ASC, "id" DESC);

-- CreateIndex
CREATE INDEX "Order_branchId_deleted_createdAt_idx" ON "Order"("branchId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_branchId_status_deleted_createdAt_idx" ON "Order"("branchId" ASC, "status" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_clientId_deleted_createdAt_idx" ON "Order"("companyId" ASC, "clientId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_deleted_createdAt_idx" ON "Order"("companyId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_deliveryAgentId_deleted_createdAt_idx" ON "Order"("companyId" ASC, "deliveryAgentId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_locationId_deleted_createdAt_idx" ON "Order"("companyId" ASC, "locationId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_status_deleted_createdAt_idx" ON "Order"("companyId" ASC, "status" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_companyId_storeId_deleted_createdAt_idx" ON "Order"("companyId" ASC, "storeId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_forwardedFromId_deleted_createdAt_idx" ON "Order"("forwardedFromId" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_forwardedFromId_status_deleted_createdAt_idx" ON "Order"("forwardedFromId" ASC, "status" ASC, "deleted" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_order_timeline_order_created_desc" ON "OrderTimeline"("orderId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_order_timeline_order_type_created_desc" ON "OrderTimeline"("orderId" ASC, "type" ASC, "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranchCost" ADD CONSTRAINT "ClientBranchCost_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranchCost" ADD CONSTRAINT "ClientBranchCost_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

