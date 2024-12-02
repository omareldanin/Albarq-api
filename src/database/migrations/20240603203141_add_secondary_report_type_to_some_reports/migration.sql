-- CreateEnum
CREATE TYPE "SecondaryReportType" AS ENUM ('DELIVERED', 'RETURNED');

-- AlterTable
ALTER TABLE "ClientReport" ADD COLUMN     "secondaryType" "SecondaryReportType" NOT NULL DEFAULT 'DELIVERED';

-- AlterTable
ALTER TABLE "CompanyReport" ADD COLUMN     "secondaryType" "SecondaryReportType" NOT NULL DEFAULT 'DELIVERED';

-- AlterTable
ALTER TABLE "RepositoryReport" ADD COLUMN     "secondaryType" "SecondaryReportType" NOT NULL DEFAULT 'DELIVERED';
