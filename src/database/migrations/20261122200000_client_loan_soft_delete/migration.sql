-- Deleting an open client loan keeps it (deleted items) with who deleted it and when
ALTER TABLE "ClientLoan" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" INTEGER;

ALTER TABLE "ClientLoan" ADD CONSTRAINT "ClientLoan_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Open loans already cancelled by deleting their treasury transaction
UPDATE "ClientLoan" SET "deleted" = true
WHERE "reportId" IS NULL
  AND "transactionId" IN (SELECT "id" FROM "Transaction" WHERE "deleted" = true);
