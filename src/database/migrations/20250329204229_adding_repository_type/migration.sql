-- CreateEnum
CREATE TYPE "RepositoryType" AS ENUM ('EXPORT', 'RETURN');

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "type" "RepositoryType" NOT NULL DEFAULT 'EXPORT';
