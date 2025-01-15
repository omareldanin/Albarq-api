-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "orderStatus" "OrderStatus"[] DEFAULT ARRAY['REGISTERED', 'READY_TO_SEND', 'WITH_DELIVERY_AGENT', 'DELIVERED', 'REPLACED', 'PARTIALLY_RETURNED', 'RETURNED', 'POSTPONED', 'CHANGE_ADDRESS', 'RESEND', 'WITH_RECEIVING_AGENT', 'PROCESSING']::"OrderStatus"[];

-- CreateIndex
CREATE INDEX "Employee_orderStatus_idx" ON "Employee"("orderStatus");
