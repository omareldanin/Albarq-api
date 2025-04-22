-- AlterEnum
ALTER TYPE "EmployeeRole" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "createdByRole" "EmployeeRole";
