-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "returnedClientReportId" INTEGER,
ADD COLUMN     "returnedCompanyReportId" INTEGER,
ADD COLUMN     "returnedRepositoryReportId" INTEGER;

-- CreateTable
CREATE TABLE "ReturnedCompanyReport" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "repositoryId" INTEGER,
    "baghdadDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "governoratesDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "secondaryType" "SecondaryReportType" NOT NULL DEFAULT 'RETURNED',

    CONSTRAINT "ReturnedCompanyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnedClientReport" (
    "id" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "storeId" INTEGER,
    "repositoryId" INTEGER,
    "baghdadDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "governoratesDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "secondaryType" "SecondaryReportType" NOT NULL DEFAULT 'RETURNED',

    CONSTRAINT "ReturnedClientReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnedRepositoryReport" (
    "id" INTEGER NOT NULL,
    "targetRepositoryName" TEXT,
    "targetRepositoryId" INTEGER,
    "repositoryId" INTEGER NOT NULL,
    "secondaryType" "SecondaryReportType" NOT NULL DEFAULT 'RETURNED',

    CONSTRAINT "ReturnedRepositoryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnedCompanyReport_companyId_idx" ON "ReturnedCompanyReport"("companyId");

-- CreateIndex
CREATE INDEX "ReturnedClientReport_clientId_idx" ON "ReturnedClientReport"("clientId");

-- CreateIndex
CREATE INDEX "ReturnedClientReport_storeId_idx" ON "ReturnedClientReport"("storeId");

-- CreateIndex
CREATE INDEX "ReturnedRepositoryReport_repositoryId_idx" ON "ReturnedRepositoryReport"("repositoryId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_returnedClientReportId_fkey" FOREIGN KEY ("returnedClientReportId") REFERENCES "ReturnedClientReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_returnedRepositoryReportId_fkey" FOREIGN KEY ("returnedRepositoryReportId") REFERENCES "ReturnedRepositoryReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_returnedCompanyReportId_fkey" FOREIGN KEY ("returnedCompanyReportId") REFERENCES "ReturnedCompanyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedCompanyReport" ADD CONSTRAINT "ReturnedCompanyReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedCompanyReport" ADD CONSTRAINT "ReturnedCompanyReport_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedCompanyReport" ADD CONSTRAINT "ReturnedCompanyReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedClientReport" ADD CONSTRAINT "ReturnedClientReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedClientReport" ADD CONSTRAINT "ReturnedClientReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedClientReport" ADD CONSTRAINT "ReturnedClientReport_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedClientReport" ADD CONSTRAINT "ReturnedClientReport_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedRepositoryReport" ADD CONSTRAINT "ReturnedRepositoryReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedRepositoryReport" ADD CONSTRAINT "ReturnedRepositoryReport_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
