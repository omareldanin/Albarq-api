-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderTimelineType" ADD VALUE 'COMPANY_CHANGE';
ALTER TYPE "OrderTimelineType" ADD VALUE 'ORDER_CREATION';
ALTER TYPE "OrderTimelineType" ADD VALUE 'ORDER_CONFIRMATION';
