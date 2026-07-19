"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeClientCommissionController = void 0;
const db_1 = require("../../database/db");
const catchAsync_1 = require("../../lib/catchAsync");
const generateEmployeeReport_1 = require("../reports/helpers/generateEmployeeReport");
const reports_responses_1 = require("../reports/reports.responses");
const employeeCommission_repository_1 = require("./employeeCommission.repository");
const employeeCommissions_dto_1 = require("./employeeCommissions.dto");
const repository = new employeeCommission_repository_1.EmployeeClientCommissionRepository();
class EmployeeClientCommissionController {
    getEmployeeClients = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const employeeID = +req.params.employeeID;
        const data = await repository.getEmployeeClients({ employeeID });
        res.status(200).json({ status: "success", data });
    });
    upsertEmployeeClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const employeeID = +req.params.employeeID;
        const data = employeeCommissions_dto_1.EmployeeClientCommissionUpsertSchema.parse(req.body);
        const result = await repository.upsertEmployeeClient({ employeeID, data });
        res.status(200).json({ status: "success", data: result });
    });
    deleteEmployeeClient = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const employeeID = +req.params.employeeID;
        const clientID = +req.params.clientID;
        await repository.deleteEmployeeClient({ employeeID, clientID });
        res.status(200).json({ status: "success" });
    });
    getEmployeeCommission = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const employeeID = +req.params.employeeID;
        const startDate = req.query.start_date
            ? new Date(req.query.start_date)
            : undefined;
        const endDate = req.query.end_date
            ? new Date(req.query.end_date)
            : undefined;
        const data = await repository.calculateEmployeeCommission({
            employeeID,
            startDate,
            endDate,
        });
        res.status(200).json({ status: "success", data });
    });
    createReport = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const employeeID = +req.params.employeeID;
        const startDate = req.query.start_date
            ? new Date(req.query.start_date)
            : undefined;
        const endDate = req.query.end_date
            ? new Date(req.query.end_date)
            : undefined;
        const data = await repository.createReport({
            employeeID,
            startDate,
            endDate,
            loggedInUser,
        });
        const report = await db_1.prisma.report.findUnique({
            where: {
                id: data.id,
            },
            select: reports_responses_1.reportSelect,
        });
        const reportData = (0, reports_responses_1.reportReform)(report);
        const pdf = await (0, generateEmployeeReport_1.generateEmployeeReport)(reportData, data.data.details);
        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        // Set headers for a PDF response
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=generated.pdf");
        console.log("PDF size:", pdfBuffer.length);
        res.send(pdfBuffer);
    });
}
exports.EmployeeClientCommissionController = EmployeeClientCommissionController;
//# sourceMappingURL=employeeCommission.controller.js.map