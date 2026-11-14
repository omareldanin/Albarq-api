-- CreateTable
CREATE TABLE "ReceivingReport" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "receivingAgentId" INTEGER,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "baghdadOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "governoratesOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingReportOrder" (
    "orderId" TEXT NOT NULL,
    "reportId" INTEGER NOT NULL,

    CONSTRAINT "ReceivingReportOrder_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "ReceivingReport_companyId_clientId_createdAt_idx" ON "ReceivingReport"("companyId", "clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReceivingReport_companyId_receivingAgentId_createdAt_idx" ON "ReceivingReport"("companyId", "receivingAgentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReceivingReportOrder_reportId_idx" ON "ReceivingReportOrder"("reportId");

-- AddForeignKey
ALTER TABLE "ReceivingReport" ADD CONSTRAINT "ReceivingReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingReport" ADD CONSTRAINT "ReceivingReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingReport" ADD CONSTRAINT "ReceivingReport_receivingAgentId_fkey" FOREIGN KEY ("receivingAgentId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingReportOrder" ADD CONSTRAINT "ReceivingReportOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingReportOrder" ADD CONSTRAINT "ReceivingReportOrder_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ReceivingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
