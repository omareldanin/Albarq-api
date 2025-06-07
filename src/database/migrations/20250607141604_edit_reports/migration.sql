-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('processed', 'not_processed', 'confirmed');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'not_processed';
