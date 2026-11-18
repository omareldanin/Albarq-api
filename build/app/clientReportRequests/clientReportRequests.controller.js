"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientReportRequestsController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const clientReportRequests_dto_1 = require("./clientReportRequests.dto");
const clientReportRequests_repository_1 = require("./clientReportRequests.repository");
const repository = new clientReportRequests_repository_1.ClientReportRequestsRepository();
const user = (res) => res.locals.user;
class ClientReportRequestsController {
    getPreview = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const data = await repository.getPreview(user(res));
        res.status(200).json({ status: "success", data });
    });
    createRequest = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const data = clientReportRequests_dto_1.ReportRequestCreateSchema.parse(req.body);
        const request = await repository.createRequest(user(res), data);
        res.status(201).json({ status: "success", data: request });
    });
    getMyRequests = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const data = await repository.getMyRequests(user(res));
        res.status(200).json({ status: "success", data });
    });
    cancelRequest = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { requestID } = clientReportRequests_dto_1.ReportRequestParamsSchema.parse(req.params);
        await repository.cancelRequest(user(res), requestID);
        res.status(200).json({ status: "success" });
    });
    getRequests = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const filters = clientReportRequests_dto_1.ReportRequestsListSchema.parse(req.query);
        const result = await repository.getRequests(user(res), filters);
        res.status(200).json({ status: "success", ...result });
    });
    getRequestPdf = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { requestID } = clientReportRequests_dto_1.ReportRequestParamsSchema.parse(req.params);
        const pdf = await repository.getRequestPdf(user(res), requestID);
        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=account-request-${requestID}.pdf`);
        res.send(pdfBuffer);
    });
    approveRequest = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { requestID } = clientReportRequests_dto_1.ReportRequestParamsSchema.parse(req.params);
        const data = await repository.approveRequest(user(res), requestID);
        res.status(200).json({ status: "success", data });
    });
    rejectRequest = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { requestID } = clientReportRequests_dto_1.ReportRequestParamsSchema.parse(req.params);
        const { reason } = clientReportRequests_dto_1.ReportRequestRejectSchema.parse(req.body);
        await repository.rejectRequest(user(res), requestID, reason);
        res.status(200).json({ status: "success" });
    });
}
exports.ClientReportRequestsController = ClientReportRequestsController;
//# sourceMappingURL=clientReportRequests.controller.js.map