-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "loansDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ClientLoan" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "transactionId" INTEGER NOT NULL,
    "reportId" INTEGER,
    "releasedReportId" INTEGER,
    "settledAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientLoan_transactionId_key" ON "ClientLoan"("transactionId");

-- CreateIndex
CREATE INDEX "ClientLoan_companyId_clientId_reportId_idx" ON "ClientLoan"("companyId", "clientId", "reportId");

-- CreateIndex
CREATE INDEX "ClientLoan_reportId_idx" ON "ClientLoan"("reportId");

-- CreateIndex
CREATE INDEX "ClientLoan_releasedReportId_idx" ON "ClientLoan"("releasedReportId");

-- AddForeignKey
ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_releasedReportId_fkey" FOREIGN KEY ("releasedReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
