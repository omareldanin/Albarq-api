-- AlterTable
ALTER TABLE "CustomerOutput" ADD COLUMN     "clientId" INTEGER,
ADD COLUMN     "companyId" INTEGER;

-- AddForeignKey
ALTER TABLE "CustomerOutput" ADD CONSTRAINT "CustomerOutput_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOutput" ADD CONSTRAINT "CustomerOutput_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
