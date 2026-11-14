"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceivingReportsController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const receivingReports_dto_1 = require("./receivingReports.dto");
const receivingReports_pdf_1 = require("./receivingReports.pdf");
const receivingReports_repository_1 = require("./receivingReports.repository");
const repository = new receivingReports_repository_1.ReceivingReportsRepository();
class ReceivingReportsController {
    createReports = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const data = receivingReports_dto_1.ReceivingReportCreateSchema.parse(req.body ?? {});
        const reports = await repository.createReports(res.locals.user, data);
        res.status(201).json({ status: "success", data: reports });
    });
    getReports = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const filters = receivingReports_dto_1.ReceivingReportsListSchema.parse(req.query);
        const result = await repository.getReports(res.locals.user, filters);
        res.status(200).json({ status: "success", ...result });
    });
    getReportPDF = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { reportID } = receivingReports_dto_1.ReceivingReportParamsSchema.parse(req.params);
        const data = await repository.getReportWithOrders(res.locals.user, reportID);
        const pdf = await (0, receivingReports_pdf_1.generateReceivingReportPDF)(data);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="receiving-report-${reportID}.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).send(Buffer.from(pdf));
    });
}
exports.ReceivingReportsController = ReceivingReportsController;
//# sourceMappingURL=receivingReports.controller.js.map