-- Store-level branch costs: a store can override its client's branch costs.
ALTER TABLE "Store" ADD COLUMN "activeProfit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClientBranchCost" ADD COLUMN "storeId" INTEGER;

CREATE INDEX "ClientBranchCost_storeId_idx" ON "ClientBranchCost"("storeId");

CREATE UNIQUE INDEX "ClientBranchCost_storeId_branchId_key" ON "ClientBranchCost"("storeId", "branchId");

ALTER TABLE "ClientBranchCost" ADD CONSTRAINT "ClientBranchCost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
