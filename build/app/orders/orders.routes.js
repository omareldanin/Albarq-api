"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import { ClientRole } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const orders_controller_1 = require("./orders.controller");
const preventDuplicateRequests_1 = require("../../middlewares/preventDuplicateRequests");
const multer_1 = __importDefault(require("multer"));
const isApiClient_1 = require("../../middlewares/isApiClient");
const upload = (0, multer_1.default)();
const router = (0, express_1.Router)();
const ordersController = new orders_controller_1.OrdersController();
router.post("/orders/update-from-csv", ordersController.updateOrderCsv);
router
    .route("/orders")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
], [client_1.Permission.ADD_ORDER]), preventDuplicateRequests_1.preventDuplicateRequests, ordersController.createOrder);
router
    .route("/orders/createPaperOrder")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
], [client_1.Permission.ADD_ORDER]), preventDuplicateRequests_1.preventDuplicateRequests, ordersController.createPaperOrderOrder);
router
    .route("/orders/create")
    .post(isApiClient_1.isApiClient, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
], [client_1.Permission.ADD_ORDER]), preventDuplicateRequests_1.preventDuplicateRequests, ordersController.createOrder);
router.route("/orders").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getAllOrders);
router
    .route("/orders/getAll")
    .get(isApiClient_1.isApiClient, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getAllOrdersApiKey);
router.route("/getGeneralInfo").get(ordersController.getGeneralInfo);
router.route("/orders/statistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrdersStatistics);
router.route("/orders/v2/statistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrdersStatistics);
router.route("/orders/clientStatistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getCLientOrdersStatistics);
router.route("/orders/statusStatistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getStatusOrdersStatistics);
router.route("/orders/v2/statusStatistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getStatusOrdersStatisticsV2);
router.route("/orders/repositoryStatusStatistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getRepositorOrdersStatistics);
router.route("/orders/returnedRepositoryStatusStatistics").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getReturnedRepositorOrdersStatistics);
router.route("/orders/repositoryOrders").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.REPOSITORIY_EMPLOYEE,
    client_1.EmployeeRole.BRANCH_MANAGER,
    client_1.EmployeeRole.ACCOUNT_MANAGER,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getRepositoryOrders);
router
    .route("/orders/getOrdersSheet")
    .get(isLoggedIn_1.isLoggedIn, ordersController.generateExcelSheet);
router.route("/orders/pdf").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrdersReportPDF);
router
    .route("/orders/excel")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrdersReportExcel);
router
    .route("/orders/excelZeroCost")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrdersWithoutCostReportExcel);
router.route("/repository-orders/pdf").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getRepositoryOrdersPDF);
router.route("/orders/getByStore").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getReceivingAgentStores);
router
    .route("/orders/pdf/getAll")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getPdfs);
router.route("/orders/getById/:orderID").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderById);
router
    .route("/orders/getOne/:orderID")
    .get(isApiClient_1.isApiClient, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderByIdApiKey);
router
    .route("/orders/pdf/:id")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderPdf);
router.route("/orders/:orderID").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrder);
router.route("/orders/:orderID/timeline").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderTimeline);
router.route("/orders/:orderID/orderTimeline").get(isApiClient_1.isApiClient, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderTimelineApiKey);
router.route("/orders/:orderID/chat-members").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderChatMembers);
router.route("/orders/:orderID/inquiry-employees").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.getOrderInquiryEmployees);
router.route("/orders/:orderID/chat").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.sendNotificationToOrderChatMembers);
router
    .route("/orders/receipts")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.createOrdersReceipts);
router
    .route("/orders/receiptsPdf")
    .post(isApiClient_1.isApiClient, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.createOrdersReceipts);
router.route("/orders/:orderID").patch(upload.none(), // Handles form-data without files
isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
], [
    client_1.Permission.CHANGE_CLOSED_ORDER_STATUS,
    client_1.Permission.CHANGE_ORDER_BRANCH,
    client_1.Permission.CHANGE_ORDER_CLIENT,
    client_1.Permission.CHANGE_ORDER_COMPANY,
    client_1.Permission.CHANGE_ORDER_DELIVERY_AGENT,
    client_1.Permission.CHANGE_ORDER_STATUS,
    client_1.Permission.CHANGE_ORDER_TOTAL_AMOUNT,
    client_1.Permission.LOCK_ORDER_STATUS,
    client_1.Permission.CHANGE_ORDER_DATA,
    client_1.Permission.CHANGE_ORDER_PAID_AMOUNT,
    client_1.Permission.CHANGE_ORDER_RECEIPT_NUMBER,
    client_1.Permission.CHANGE_ORDER_RECEPIENT_NUMBER,
]), ordersController.updateOrder);
router
    .route("/orders/changeClient/:orderID")
    .patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([...Object.values(client_1.AdminRole), ...Object.values(client_1.EmployeeRole)], [client_1.Permission.CHANGE_ORDER_CLIENT]), ordersController.changeOrderClient);
router
    .route("/orders/resend/:orderID")
    .patch(upload.none(), isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([...Object.values(client_1.ClientRole)]), ordersController.resendOrder);
router
    .route("/orders/forwardOrder/:orderID")
    .patch(upload.none(), isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
], [client_1.Permission.CHANGE_ORDER_COMPANY]), ordersController.forwradOrderToCompany);
router
    .route("/orders/bulkForwardOrder/")
    .post(upload.none(), isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
], [client_1.Permission.CHANGE_ORDER_COMPANY]), ordersController.bulkForwardOrdersToCompany);
router
    .route("/orders/sendOrders")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
], [
    client_1.Permission.CHANGE_CLOSED_ORDER_STATUS,
    client_1.Permission.CHANGE_ORDER_BRANCH,
    client_1.Permission.CHANGE_ORDER_CLIENT,
    client_1.Permission.CHANGE_ORDER_COMPANY,
    client_1.Permission.CHANGE_ORDER_DELIVERY_AGENT,
    client_1.Permission.CHANGE_ORDER_STATUS,
    client_1.Permission.CHANGE_ORDER_TOTAL_AMOUNT,
    client_1.Permission.LOCK_ORDER_STATUS,
    client_1.Permission.CHANGE_ORDER_DATA,
    client_1.Permission.CHANGE_ORDER_PAID_AMOUNT,
    client_1.Permission.CHANGE_ORDER_RECEIPT_NUMBER,
    client_1.Permission.CHANGE_ORDER_RECEPIENT_NUMBER,
    client_1.Permission.SEND_ORDER,
]), ordersController.sendOrdersToReceivingAgent);
router
    .route("/orders/sendOrderToShipped")
    .post(isApiClient_1.isApiClient, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
], []), ordersController.sendOrdersToReceivingAgentApiKey);
//  تأكيد مباشر برقم الطل في صفحة ادخال الطلبات المخزن
router.route("/orders/addOrderToRepository/:orderID").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.addOrderToRepository);
router
    .route("/orders/repository-confirm-order-by-receipt-number/:orderID")
    .patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), ordersController.addReturnedOrderToRepository);
router.route("/orders/:orderID").delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
]), ordersController.deleteOrder);
router.route("/orders/:orderID/deactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
], [client_1.Permission.DELETE_ORDER]), ordersController.deactivateOrder);
router.route("/orders/:orderID/reactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.AdminRole.ADMIN, client_1.AdminRole.ADMIN_ASSISTANT], [client_1.Permission.REACTIVE_ORDERS]), ordersController.reactivateOrder);
exports.default = router;
//# sourceMappingURL=orders.routes.js.map