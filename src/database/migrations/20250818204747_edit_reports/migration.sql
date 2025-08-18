-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_branchReportId_fkey";

-- AlterTable
ALTER TABLE "BranchReport" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'forwarded';

-- CreateTable
CREATE TABLE "_BranchReportToOrder" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BranchReportToOrder_AB_unique" ON "_BranchReportToOrder"("A", "B");

-- CreateIndex
CREATE INDEX "_BranchReportToOrder_B_index" ON "_BranchReportToOrder"("B");

-- AddForeignKey
ALTER TABLE "_BranchReportToOrder" ADD CONSTRAINT "_BranchReportToOrder_A_fkey" FOREIGN KEY ("A") REFERENCES "BranchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchReportToOrder" ADD CONSTRAINT "_BranchReportToOrder_B_fkey" FOREIGN KEY ("B") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
