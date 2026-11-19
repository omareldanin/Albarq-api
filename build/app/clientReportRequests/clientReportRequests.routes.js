"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const upload_1 = require("../../middlewares/upload");
const clientReportRequests_controller_1 = require("./clientReportRequests.controller");
const router = (0, express_1.Router)();
const controller = new clientReportRequests_controller_1.ClientReportRequestsController();
const client = (0, isAutherized_1.isAutherized)([client_1.ClientRole.CLIENT]);
// Same people who can make client reports in the dashboard.
const reviewers = (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER, client_1.EmployeeRole.ACCOUNTANT], [client_1.Permission.CREATE_CLIENT_REPORT]);
// Client side: طلب حساب
router.get("/client-report-requests/preview", isLoggedIn_1.isLoggedIn, client, controller.getPreview
/* #swagger.tags = ['Client Report Requests']
   #swagger.description = 'Delivered orders without a delivered client report (count, totals), open loans, amount due, and blockReason when a request is not allowed (no store chosen, pending request, unconfirmed delivered reports, no orders, loans above net). Clients with more than one store (storeRequired) pass store_id; stores lists the orders and net of each store.'
   #swagger.parameters['store_id'] = {in: 'query', type: 'integer', description: 'Required to request when the client has more than one store' */
);
router.get("/client-report-requests/mine", isLoggedIn_1.isLoggedIn, client, controller.getMyRequests
/* #swagger.tags = ['Client Report Requests'] */
);
router.post("/client-report-requests", isLoggedIn_1.isLoggedIn, client, upload_1.upload.none(), controller.createRequest
/* #swagger.tags = ['Client Report Requests']
   #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['receiveMethod'], properties: {receiveMethod: {type: 'string', enum: ['RECEIVING_AGENT', 'COMPANY_OFFICE']}, note: {type: 'string', maxLength: 300}, storeID: {type: 'integer', description: 'Required when the client has more than one store'}}}}}} */
);
router.patch("/client-report-requests/:requestID/cancel", isLoggedIn_1.isLoggedIn, client, controller.cancelRequest
/* #swagger.tags = ['Client Report Requests'] */
);
// Both sides: the request as a draft delivered report PDF
router.get("/client-report-requests/:requestID/pdf", isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.ClientRole.CLIENT, client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER, client_1.EmployeeRole.ACCOUNTANT], [client_1.Permission.CREATE_CLIENT_REPORT]), controller.getRequestPdf
/* #swagger.tags = ['Client Report Requests']
   #swagger.description = 'The delivered client report template filled with the orders the client asked for, marked as a draft (nothing is saved). Pending: the orders approval would report and the open loans it would deduct. Clients see only their own requests.'
   #swagger.produces = ['application/pdf'] */
);
// Dashboard side: review
router.get("/client-report-requests", isLoggedIn_1.isLoggedIn, reviewers, controller.getRequests
/* #swagger.tags = ['Client Report Requests']
   #swagger.parameters['status'] = {in: 'query', type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']}
   #swagger.parameters['client_id'] = {in: 'query', type: 'integer'}
   #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
   #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100} */
);
router.post("/client-report-requests/:requestID/approve", isLoggedIn_1.isLoggedIn, reviewers, controller.approveRequest
/* #swagger.tags = ['Client Report Requests']
   #swagger.description = 'Creates the client\'s delivered report now, one per store with eligible orders, through the regular report creation (loans are deducted). With RECEIVING_AGENT the report is assigned to the client\'s receiving agent when exactly one is assigned. failures lists stores whose report could not be made.' */
);
router.post("/client-report-requests/:requestID/reject", isLoggedIn_1.isLoggedIn, reviewers, upload_1.upload.none(), controller.rejectRequest
/* #swagger.tags = ['Client Report Requests']
   #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['reason'], properties: {reason: {type: 'string', maxLength: 300}}}}}} */
);
exports.default = router;
//# sourceMappingURL=clientReportRequests.routes.js.map