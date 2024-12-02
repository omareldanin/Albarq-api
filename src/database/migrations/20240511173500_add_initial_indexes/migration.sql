-- CreateIndex
CREATE INDEX "BranchReport_branchId_idx" ON "BranchReport"("branchId");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "ClientReport_clientId_idx" ON "ClientReport"("clientId");

-- CreateIndex
CREATE INDEX "ClientReport_storeId_idx" ON "ClientReport"("storeId");

-- CreateIndex
CREATE INDEX "CompanyReport_companyId_idx" ON "CompanyReport"("companyId");

-- CreateIndex
CREATE INDEX "DeliveryAgentReport_deliveryAgentId_idx" ON "DeliveryAgentReport"("deliveryAgentId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Employee_role_idx" ON "Employee"("role");

-- CreateIndex
CREATE INDEX "Employee_permissions_idx" ON "Employee"("permissions");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE INDEX "GovernorateReport_governorate_idx" ON "GovernorateReport"("governorate");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Order_receiptNumber_idx" ON "Order"("receiptNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_secondaryStatus_idx" ON "Order"("secondaryStatus");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_deliveryAgentId_idx" ON "Order"("deliveryAgentId");

-- CreateIndex
CREATE INDEX "Order_governorate_idx" ON "Order"("governorate");

-- CreateIndex
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");

-- CreateIndex
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_clientId_idx" ON "Product"("clientId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Report_type_idx" ON "Report"("type");

-- CreateIndex
CREATE INDEX "Report_employeeId_idx" ON "Report"("employeeId");

-- CreateIndex
CREATE INDEX "Report_companyId_idx" ON "Report"("companyId");

-- CreateIndex
CREATE INDEX "RepositoryReport_repositoryId_idx" ON "RepositoryReport"("repositoryId");

-- CreateIndex
CREATE INDEX "Store_companyId_idx" ON "Store"("companyId");

-- CreateIndex
CREATE INDEX "Store_clientId_idx" ON "Store"("clientId");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");
