"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const receivingReports_controller_1 = require("./receivingReports.controller");
const router = (0, express_1.Router)();
const controller = new receivingReports_controller_1.ReceivingReportsController();
// The repository narrows each role to its own reports (client, agent, or company).
const viewers = (0, isAutherized_1.isAutherized)([
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    client_1.EmployeeRole.RECEIVING_AGENT,
    client_1.EmployeeRole.COMPANY_MANAGER,
]);
router
    .route("/receiving-reports")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.RECEIVING_AGENT, client_1.ClientRole.CLIENT]), controller.createReports)
    .get(isLoggedIn_1.isLoggedIn, viewers, controller.getReports);
router.route("/receiving-reports/:reportID/pdf").get(isLoggedIn_1.isLoggedIn, viewers, controller.getReportPDF);
exports.default = router;
//# sourceMappingURL=receivingReports.routes.js.map