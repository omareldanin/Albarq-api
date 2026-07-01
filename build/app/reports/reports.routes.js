"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// import { Role } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
const client_1 = require("@prisma/client");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const reports_controller_1 = require("./reports.controller");
const router = (0, express_1.Router)();
const reportController = new reports_controller_1.ReportController();
router
    .route("/reports")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.REPOSITORIY_EMPLOYEE,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.EmployeeRole.BRANCH_MANAGER,
], [
    client_1.Permission.CREATE_BRANCH_REPORT,
    client_1.Permission.CREATE_REPOSITORY_REPORT,
    client_1.Permission.CREATE_COMPANY_REPORT,
    client_1.Permission.CREATE_DELIVERY_AGENT_REPORT,
    client_1.Permission.CREATE_CLIENT_REPORT,
    client_1.Permission.CREATE_GOVERNMENT_REPORT,
]), reportController.createReport);
router.route("/reports").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), reportController.getAllReports);
router.route("/reports/:reportID").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), reportController.getReport);
router.route("/reports/:reportID/pdf").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), reportController.getReportPDF);
router.route("/reports/clients/:reportID/pdf").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), reportController.getReportClientsPDF);
router.route("/reports/pdf").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), reportController.getReportsReportPDF);
router.route("/reports/:reportID").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), reportController.updateReport);
router.route("/reports/:reportID").delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.AdminRole.ADMIN, client_1.AdminRole.ADMIN_ASSISTANT], [client_1.Permission.DELETE_DELIVERY_AGENT_REPORT]), reportController.deleteReport);
router.route("/reports/:reportID/deactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([...Object.values(client_1.AdminRole), ...Object.values(client_1.EmployeeRole)]), reportController.deactivateReport);
router.route("/reports/:reportID/reactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.AdminRole.ADMIN, client_1.AdminRole.ADMIN_ASSISTANT], [client_1.Permission.REACTIVE_REPORT]), reportController.reactivateReport);
exports.default = router;
//# sourceMappingURL=reports.routes.js.map