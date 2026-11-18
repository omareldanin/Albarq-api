-- Orders the client asked for, so the PDF and the approved report match what was reviewed
ALTER TABLE "ClientReportRequest" ADD COLUMN "orderIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
