-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "employeeWalletId" INTEGER;

-- CreateTable
CREATE TABLE "EmployeeWallet" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "createdById" INTEGER,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeWallet_companyId_branchId_idx" ON "EmployeeWallet"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "EmployeeWallet_companyId_branchId_employeeId_idx" ON "EmployeeWallet"("companyId", "branchId", "employeeId");

-- CreateIndex
CREATE INDEX "Transaction_employeeWalletId_idx" ON "Transaction"("employeeWalletId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_employeeWalletId_fkey" FOREIGN KEY ("employeeWalletId") REFERENCES "EmployeeWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWallet" ADD CONSTRAINT "EmployeeWallet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWallet" ADD CONSTRAINT "EmployeeWallet_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWallet" ADD CONSTRAINT "EmployeeWallet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWallet" ADD CONSTRAINT "EmployeeWallet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

