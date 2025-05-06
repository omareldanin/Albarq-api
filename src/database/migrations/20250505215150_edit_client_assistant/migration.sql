-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MANAGE_TICKETS';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "clientAssistantRole" TEXT;
