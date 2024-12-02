-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'ADMIN_ASSISTANT');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('COMPANY_MANAGER', 'ACCOUNT_MANAGER', 'ACCOUNTANT', 'DELIVERY_AGENT', 'RECEIVING_AGENT', 'BRANCH_MANAGER', 'EMERGENCY_EMPLOYEE', 'DATA_ENTRY', 'REPOSITORIY_EMPLOYEE', 'INQUIRY_EMPLOYEE', 'CLIENT_ASSISTANT');

-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('CLIENT');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('ADD_STORE', 'ADD_CLIENT', 'ADD_LOCATION', 'ADD_DELIVERY_AGENT', 'ADD_ORDER', 'DELETE_ORDER', 'CONFIRM_ORDER', 'CHANGE_ORDER_STATUS', 'CHANGE_CLOSED_ORDER_STATUS', 'CHANGE_ORDER_TOTAL_AMOUNT', 'LOCK_ORDER_STATUS', 'CHANGE_ORDER_DELIVERY_AGENT', 'CHANGE_ORDER_BRANCH', 'CHANGE_ORDER_CLIENT', 'CHANGE_ORDER_COMPANY', 'CREATE_DELIVERY_AGENT_REPORT', 'CREATE_CLIENT_REPORT', 'CREATE_REPOSITORY_REPORT', 'CREATE_COMPANY_REPORT', 'CREATE_GOVERNMENT_REPORT', 'CREATE_BRANCH_REPORT', 'DELETE_COMPANY_REPORT', 'DELETE_REPOSITORY_REPORT', 'DELETE_GOVERNMENT_REPORT', 'DELETE_DELIVERY_AGENT_REPORT', 'DELETE_CLIENT_REPORT', 'DELETE_BRANCH_REPORT');

-- CreateEnum
CREATE TYPE "Governorate" AS ENUM ('AL_ANBAR', 'BABIL', 'BABIL_COMPANIES', 'BAGHDAD', 'BASRA', 'DHI_QAR', 'AL_QADISIYYAH', 'DIYALA', 'DUHOK', 'ERBIL', 'KARBALA', 'KIRKUK', 'MAYSAN', 'MUTHANNA', 'NAJAF', 'NINAWA', 'SALAH_AL_DIN', 'SULAYMANIYAH', 'WASIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('REGISTERED', 'READY_TO_SEND', 'WITH_DELIVERY_AGENT', 'DELIVERED', 'REPLACED', 'PARTIALLY_RETURNED', 'RETURNED', 'POSTPONED', 'CHANGE_ADDRESS', 'RESEND', 'WITH_RECEIVING_AGENT', 'PROCESSING');

-- CreateEnum
CREATE TYPE "AutomaticUpdateReturnCondition" AS ENUM ('WITH_AGENT', 'IN_REPOSITORY');

-- CreateEnum
CREATE TYPE "SecondaryStatus" AS ENUM ('WITH_CLIENT', 'WITH_AGENT', 'IN_REPOSITORY');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('NORMAL', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('COMPANY', 'REPOSITORY', 'GOVERNORATE', 'DELIVERY_AGENT', 'BRANCH', 'CLIENT');

-- CreateEnum
CREATE TYPE "OrderTimelineType" AS ENUM ('DELIVERY_AGENT_CHANGE', 'CLIENT_CHANGE', 'REPOSITORY_CHANGE', 'BRANCH_CHANGE', 'PAID_AMOUNT_CHANGE', 'STATUS_CHANGE', 'CURRENT_LOCATION_CHANGE', 'REPORT_CREATE', 'REPORT_DELETE', 'ORDER_DELIVERY', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT 'https://w7.pngwing.com/pngs/627/693/png-transparent-computer-icons-user-user-icon.png',
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fcm" TEXT NOT NULL DEFAULT '',
    "refreshTokens" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL,
    "role" "AdminRole" NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL,
    "permissions" "Permission"[],
    "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "role" "EmployeeRole" NOT NULL,
    "branchId" INTEGER,
    "repositoryId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "inquiryGovernorates" "Governorate"[],
    "inquiryStatuses" "OrderStatus"[],
    "companyId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEmployeesDeliveryAgents" (
    "inquiryEmployeeId" INTEGER NOT NULL,
    "deliveryAgentId" INTEGER NOT NULL,

    CONSTRAINT "InquiryEmployeesDeliveryAgents_pkey" PRIMARY KEY ("inquiryEmployeeId","deliveryAgentId")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL,
    "role" "ClientRole" NOT NULL DEFAULT 'CLIENT',
    "token" TEXT NOT NULL DEFAULT '',
    "governoratesDeliveryCosts" JSONB NOT NULL DEFAULT '[]',
    "deletedById" INTEGER,
    "createdById" INTEGER NOT NULL,
    "repositoryId" INTEGER,
    "branchId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT 'https://w7.pngwing.com/pngs/307/22/png-transparent-computer-icons-business-company-corporation-company-angle-company-text.png',
    "notes" TEXT NOT NULL DEFAULT '',
    "clientAssistantId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEmployeesStores" (
    "inquiryEmployeeId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,

    CONSTRAINT "InquiryEmployeesStores_pkey" PRIMARY KEY ("inquiryEmployeeId","storeId")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "governorate" "Governorate",
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEmployeesBranches" (
    "inquiryEmployeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,

    CONSTRAINT "InquiryEmployeesBranches_pkey" PRIMARY KEY ("inquiryEmployeeId","branchId")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "governorate" "Governorate" NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "branchId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEmployeesLocations" (
    "inquiryEmployeeId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,

    CONSTRAINT "InquiryEmployeesLocations_pkey" PRIMARY KEY ("inquiryEmployeeId","locationId")
);

-- CreateTable
CREATE TABLE "DeliveryAgentsLocations" (
    "deliveryAgentId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,

    CONSTRAINT "DeliveryAgentsLocations_pkey" PRIMARY KEY ("deliveryAgentId","locationId")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "treasury" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT 'https://w7.pngwing.com/pngs/307/22/png-transparent-computer-icons-business-company-corporation-company-angle-company-text.png',
    "color" TEXT NOT NULL DEFAULT 'FF0000',
    "registrationText" TEXT NOT NULL DEFAULT '',
    "orderStatusAutomaticUpdate" BOOLEAN NOT NULL DEFAULT false,
    "governoratePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryAgentFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baghdadPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalPriceForEvery500000IraqiDinar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalPriceForEveryKilogram" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalPriceForRemoteAreas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEmployeesCompanies" (
    "inquiryEmployeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "InquiryEmployeesCompanies_pkey" PRIMARY KEY ("inquiryEmployeeId","companyId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "receiptNumber" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recipientName" TEXT NOT NULL DEFAULT 'غير معرف',
    "recipientPhones" TEXT[],
    "recipientAddress" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'NORMAL',
    "governorate" "Governorate" NOT NULL,
    "currentLocation" TEXT NOT NULL DEFAULT '',
    "deliveryDate" TIMESTAMP(3),
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryAgentNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'REGISTERED',
    "secondaryStatus" "SecondaryStatus",
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "clientId" INTEGER NOT NULL,
    "deliveryAgentId" INTEGER,
    "oldDeliveryAgentId" INTEGER,
    "locationId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "repositoryId" INTEGER,
    "branchId" INTEGER,
    "automaticUpdateId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processedById" INTEGER,
    "forwarded" BOOLEAN NOT NULL DEFAULT false,
    "forwardedAt" TIMESTAMP(3),
    "forwardedById" INTEGER,
    "forwardedFromId" INTEGER,
    "clientReportId" INTEGER,
    "repositoryReportId" INTEGER,
    "branchReportId" INTEGER,
    "deliveryAgentReportId" INTEGER,
    "governorateReportId" INTEGER,
    "companyReportId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTimeline" (
    "id" SERIAL NOT NULL,
    "type" "OrderTimelineType" NOT NULL,
    "old" JSONB,
    "new" JSONB,
    "message" TEXT NOT NULL,
    "by" JSONB NOT NULL,
    "orderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdersInquiryEmployees" (
    "inquiryEmployeeId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,

    CONSTRAINT "OrdersInquiryEmployees_pkey" PRIMARY KEY ("orderId","inquiryEmployeeId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "type" "ReportType" NOT NULL,
    "baghdadOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "governoratesOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'UNPAID',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryAgentNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyReport" (
    "id" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "baghdadDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "governoratesDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CompanyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReport" (
    "id" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "storeId" INTEGER,
    "baghdadDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "governoratesDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ClientReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryReport" (
    "id" INTEGER NOT NULL,
    "repositoryId" INTEGER NOT NULL,

    CONSTRAINT "RepositoryReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchReport" (
    "id" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "deliveryAgentDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BranchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAgentReport" (
    "id" INTEGER NOT NULL,
    "deliveryAgentId" INTEGER NOT NULL,
    "deliveryAgentDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryAgentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernorateReport" (
    "id" INTEGER NOT NULL,
    "governorate" "Governorate" NOT NULL,
    "deliveryAgentDeliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "GovernorateReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "image" TEXT NOT NULL DEFAULT 'https://w7.pngwing.com/pngs/436/721/png-transparent-package-delivery-box-freight-transport-computer-icons-shipping-miscellaneous-angle-freight-transport.png',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storeId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderProducts" (
    "quantity" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "colorId" INTEGER,
    "sizeId" INTEGER,

    CONSTRAINT "OrderProducts_pkey" PRIMARY KEY ("productId","orderId")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Color" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductColors" (
    "quantity" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "colorId" INTEGER NOT NULL,

    CONSTRAINT "ProductColors_pkey" PRIMARY KEY ("productId","colorId")
);

-- CreateTable
CREATE TABLE "ProductSizes" (
    "quantity" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "sizeId" INTEGER NOT NULL,

    CONSTRAINT "ProductSizes_pkey" PRIMARY KEY ("productId","sizeId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "userId" INTEGER NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT 'https://w7.pngwing.com/pngs/819/548/png-transparent-photo-image-landscape-icon-images.png',
    "url" TEXT NOT NULL DEFAULT '',
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomaticUpdate" (
    "id" SERIAL NOT NULL,
    "orderStatus" "OrderStatus" NOT NULL,
    "newOrderStatus" "OrderStatus" NOT NULL DEFAULT 'DELIVERED',
    "governorate" "Governorate" NOT NULL,
    "returnCondition" "AutomaticUpdateReturnCondition",
    "updateAt" INTEGER NOT NULL DEFAULT 22,
    "checkAfter" INTEGER NOT NULL DEFAULT 24,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "branchId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomaticUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Store_name_key" ON "Store"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_companyId_key" ON "Branch"("name", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_name_key" ON "Repository"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_title_key" ON "Category"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Size_title_key" ON "Size"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Color_title_key" ON "Color"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Color_code_key" ON "Color"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AutomaticUpdate_orderStatus_governorate_branchId_companyId_key" ON "AutomaticUpdate"("orderStatus", "governorate", "branchId", "companyId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesDeliveryAgents" ADD CONSTRAINT "InquiryEmployeesDeliveryAgents_inquiryEmployeeId_fkey" FOREIGN KEY ("inquiryEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesDeliveryAgents" ADD CONSTRAINT "InquiryEmployeesDeliveryAgents_deliveryAgentId_fkey" FOREIGN KEY ("deliveryAgentId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_clientAssistantId_fkey" FOREIGN KEY ("clientAssistantId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesStores" ADD CONSTRAINT "InquiryEmployeesStores_inquiryEmployeeId_fkey" FOREIGN KEY ("inquiryEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesStores" ADD CONSTRAINT "InquiryEmployeesStores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesBranches" ADD CONSTRAINT "InquiryEmployeesBranches_inquiryEmployeeId_fkey" FOREIGN KEY ("inquiryEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesBranches" ADD CONSTRAINT "InquiryEmployeesBranches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesLocations" ADD CONSTRAINT "InquiryEmployeesLocations_inquiryEmployeeId_fkey" FOREIGN KEY ("inquiryEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesLocations" ADD CONSTRAINT "InquiryEmployeesLocations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgentsLocations" ADD CONSTRAINT "DeliveryAgentsLocations_deliveryAgentId_fkey" FOREIGN KEY ("deliveryAgentId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgentsLocations" ADD CONSTRAINT "DeliveryAgentsLocations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesCompanies" ADD CONSTRAINT "InquiryEmployeesCompanies_inquiryEmployeeId_fkey" FOREIGN KEY ("inquiryEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEmployeesCompanies" ADD CONSTRAINT "InquiryEmployeesCompanies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAgentId_fkey" FOREIGN KEY ("deliveryAgentId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_automaticUpdateId_fkey" FOREIGN KEY ("automaticUpdateId") REFERENCES "AutomaticUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_forwardedById_fkey" FOREIGN KEY ("forwardedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientReportId_fkey" FOREIGN KEY ("clientReportId") REFERENCES "ClientReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_repositoryReportId_fkey" FOREIGN KEY ("repositoryReportId") REFERENCES "RepositoryReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchReportId_fkey" FOREIGN KEY ("branchReportId") REFERENCES "BranchReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAgentReportId_fkey" FOREIGN KEY ("deliveryAgentReportId") REFERENCES "DeliveryAgentReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_governorateReportId_fkey" FOREIGN KEY ("governorateReportId") REFERENCES "GovernorateReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyReportId_fkey" FOREIGN KEY ("companyReportId") REFERENCES "CompanyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeline" ADD CONSTRAINT "OrderTimeline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersInquiryEmployees" ADD CONSTRAINT "OrdersInquiryEmployees_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersInquiryEmployees" ADD CONSTRAINT "OrdersInquiryEmployees_inquiryEmployeeId_fkey" FOREIGN KEY ("inquiryEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReport" ADD CONSTRAINT "CompanyReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReport" ADD CONSTRAINT "CompanyReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReport" ADD CONSTRAINT "ClientReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReport" ADD CONSTRAINT "ClientReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReport" ADD CONSTRAINT "ClientReport_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryReport" ADD CONSTRAINT "RepositoryReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryReport" ADD CONSTRAINT "RepositoryReport_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchReport" ADD CONSTRAINT "BranchReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchReport" ADD CONSTRAINT "BranchReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgentReport" ADD CONSTRAINT "DeliveryAgentReport_deliveryAgentId_fkey" FOREIGN KEY ("deliveryAgentId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgentReport" ADD CONSTRAINT "DeliveryAgentReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernorateReport" ADD CONSTRAINT "GovernorateReport_id_fkey" FOREIGN KEY ("id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProducts" ADD CONSTRAINT "OrderProducts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProducts" ADD CONSTRAINT "OrderProducts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProducts" ADD CONSTRAINT "OrderProducts_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProducts" ADD CONSTRAINT "OrderProducts_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Size" ADD CONSTRAINT "Size_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Color" ADD CONSTRAINT "Color_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColors" ADD CONSTRAINT "ProductColors_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColors" ADD CONSTRAINT "ProductColors_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSizes" ADD CONSTRAINT "ProductSizes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSizes" ADD CONSTRAINT "ProductSizes_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticUpdate" ADD CONSTRAINT "AutomaticUpdate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticUpdate" ADD CONSTRAINT "AutomaticUpdate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

