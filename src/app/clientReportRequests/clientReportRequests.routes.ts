import { ClientRole, EmployeeRole, Permission } from "@prisma/client";
import { Router } from "express";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { upload } from "../../middlewares/upload";
import { ClientReportRequestsController } from "./clientReportRequests.controller";

const router = Router();
const controller = new ClientReportRequestsController();
const client = isAutherized([ClientRole.CLIENT]);
// Same people who can make client reports in the dashboard.
const reviewers = isAutherized(
    [EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER, EmployeeRole.ACCOUNTANT],
    [Permission.CREATE_CLIENT_REPORT]
);

// Client side: طلب حساب
router.get(
    "/client-report-requests/preview",
    isLoggedIn,
    client,
    controller.getPreview
    /* #swagger.tags = ['Client Report Requests']
       #swagger.description = 'Delivered orders without a delivered client report (count, totals), open loans, amount due, and blockReason when a request is not allowed (pending request, unconfirmed reports, no orders, loans above net).' */
);
router.get(
    "/client-report-requests/mine",
    isLoggedIn,
    client,
    controller.getMyRequests
    /* #swagger.tags = ['Client Report Requests'] */
);
router.post(
    "/client-report-requests",
    isLoggedIn,
    client,
    upload.none(),
    controller.createRequest
    /* #swagger.tags = ['Client Report Requests']
       #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['receiveMethod'], properties: {receiveMethod: {type: 'string', enum: ['RECEIVING_AGENT', 'COMPANY_OFFICE']}, note: {type: 'string', maxLength: 300}}}}}} */
);
router.patch(
    "/client-report-requests/:requestID/cancel",
    isLoggedIn,
    client,
    controller.cancelRequest
    /* #swagger.tags = ['Client Report Requests'] */
);

// Both sides: the request as a draft delivered report PDF
router.get(
    "/client-report-requests/:requestID/pdf",
    isLoggedIn,
    isAutherized(
        [ClientRole.CLIENT, EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER, EmployeeRole.ACCOUNTANT],
        [Permission.CREATE_CLIENT_REPORT]
    ),
    controller.getRequestPdf
    /* #swagger.tags = ['Client Report Requests']
       #swagger.description = 'The delivered client report template filled with the orders the client asked for, marked as a draft (nothing is saved). Pending: the orders approval would report and the open loans it would deduct. Clients see only their own requests.'
       #swagger.produces = ['application/pdf'] */
);

// Dashboard side: review
router.get(
    "/client-report-requests",
    isLoggedIn,
    reviewers,
    controller.getRequests
    /* #swagger.tags = ['Client Report Requests']
       #swagger.parameters['status'] = {in: 'query', type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']}
       #swagger.parameters['client_id'] = {in: 'query', type: 'integer'}
       #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
       #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100} */
);
router.post(
    "/client-report-requests/:requestID/approve",
    isLoggedIn,
    reviewers,
    controller.approveRequest
    /* #swagger.tags = ['Client Report Requests']
       #swagger.description = 'Creates the client\'s delivered report now, one per store with eligible orders, through the regular report creation (loans are deducted). With RECEIVING_AGENT the report is assigned to the client\'s receiving agent when exactly one is assigned. failures lists stores whose report could not be made.' */
);
router.post(
    "/client-report-requests/:requestID/reject",
    isLoggedIn,
    reviewers,
    upload.none(),
    controller.rejectRequest
    /* #swagger.tags = ['Client Report Requests']
       #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['reason'], properties: {reason: {type: 'string', maxLength: 300}}}}}} */
);

export default router;
