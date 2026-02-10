-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'REACTIVE_ORDERS';
ALTER TYPE "Permission" ADD VALUE 'REACTIVE_REPORT';
ALTER TYPE "Permission" ADD VALUE 'REACTIVE_STORE';
ALTER TYPE "Permission" ADD VALUE 'REACTIVE_CLIENT';
ALTER TYPE "Permission" ADD VALUE 'REACTIVE_EMPLOYEE';
