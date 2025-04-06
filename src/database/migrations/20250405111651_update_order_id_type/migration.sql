/*
  Warnings:

  - The primary key for the `Order` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `OrderProducts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `OrdersInquiryEmployees` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "CustomerOutput" DROP CONSTRAINT "CustomerOutput_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderProducts" DROP CONSTRAINT "OrderProducts_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderTimeline" DROP CONSTRAINT "OrderTimeline_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrdersInquiryEmployees" DROP CONSTRAINT "OrdersInquiryEmployees_orderId_fkey";

-- AlterTable
ALTER TABLE "ClientOrderReceipt" ALTER COLUMN "receiptNumber" SET DEFAULT '',
ALTER COLUMN "receiptNumber" DROP DEFAULT,
ALTER COLUMN "receiptNumber" SET DATA TYPE TEXT;
DROP SEQUENCE "ClientOrderReceipt_receiptNumber_seq";

-- AlterTable
ALTER TABLE "CustomerOutput" ALTER COLUMN "orderId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Order" DROP CONSTRAINT "Order_pkey",
ALTER COLUMN "id" SET DEFAULT '',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "receiptNumber" SET DEFAULT '',
ALTER COLUMN "receiptNumber" DROP DEFAULT,
ALTER COLUMN "receiptNumber" SET DATA TYPE TEXT,
ADD CONSTRAINT "Order_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Order_id_seq";
DROP SEQUENCE "Order_receiptNumber_seq";

-- AlterTable
ALTER TABLE "OrderProducts" DROP CONSTRAINT "OrderProducts_pkey",
ALTER COLUMN "orderId" SET DATA TYPE TEXT,
ADD CONSTRAINT "OrderProducts_pkey" PRIMARY KEY ("productId", "orderId");

-- AlterTable
ALTER TABLE "OrderTimeline" ALTER COLUMN "orderId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "OrdersInquiryEmployees" DROP CONSTRAINT "OrdersInquiryEmployees_pkey",
ALTER COLUMN "orderId" SET DATA TYPE TEXT,
ADD CONSTRAINT "OrdersInquiryEmployees_pkey" PRIMARY KEY ("orderId", "inquiryEmployeeId");

-- AddForeignKey
ALTER TABLE "CustomerOutput" ADD CONSTRAINT "CustomerOutput_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeline" ADD CONSTRAINT "OrderTimeline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersInquiryEmployees" ADD CONSTRAINT "OrdersInquiryEmployees_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProducts" ADD CONSTRAINT "OrderProducts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
