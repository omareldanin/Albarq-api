-- طلب حساب per store: clients with more than one store choose the store first
ALTER TABLE "ClientReportRequest" ADD COLUMN "storeId" INTEGER;

ALTER TABLE "ClientReportRequest" ADD CONSTRAINT "ClientReportRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
