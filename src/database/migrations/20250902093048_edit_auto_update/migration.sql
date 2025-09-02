-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pdfId" INTEGER;

-- CreateTable
CREATE TABLE "SavedPdf" (
    "id" SERIAL NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" INTEGER,

    CONSTRAINT "SavedPdf_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pdfId_fkey" FOREIGN KEY ("pdfId") REFERENCES "SavedPdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPdf" ADD CONSTRAINT "SavedPdf_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
