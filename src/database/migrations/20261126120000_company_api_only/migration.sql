-- AlterTable
-- Partner companies that only integrate through the API (docs + API key, no dashboard).
ALTER TABLE "Company" ADD COLUMN "apiOnly" BOOLEAN NOT NULL DEFAULT false;
