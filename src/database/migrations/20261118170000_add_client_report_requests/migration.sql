-- CreateEnum
CREATE TYPE "ReportRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportReceiveMethod" AS ENUM ('RECEIVING_AGENT', 'COMPANY_OFFICE');

-- CreateTable
CREATE TABLE "ClientReportRequest" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "status" "ReportRequestStatus" NOT NULL DEFAULT 'PENDING',
    "receiveMethod" "ReportReceiveMethod" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "clientNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loansTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "reportIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientReportRequest_companyId_status_createdAt_idx" ON "ClientReportRequest"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClientReportRequest_clientId_status_idx" ON "ClientReportRequest"("clientId", "status");

-- AddForeignKey
ALTER TABLE "ClientReportRequest" ADD CONSTRAINT "ClientReportRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReportRequest" ADD CONSTRAINT "ClientReportRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReportRequest" ADD CONSTRAINT "ClientReportRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
