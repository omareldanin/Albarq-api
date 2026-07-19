"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const isAutherized_1 = require("../../middlewares/isAutherized");
const client_1 = require("@prisma/client");
const upload_1 = require("../../middlewares/upload");
const employeeCommission_controller_1 = require("./employeeCommission.controller");
const router = (0, express_1.Router)();
const controller = new employeeCommission_controller_1.EmployeeClientCommissionController();
router
    .route("/employees/:employeeID/commission")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), controller.createReport);
router
    .route("/employees/:employeeID/clients")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), controller.getEmployeeClients)
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), controller.upsertEmployeeClient);
router
    .route("/employees/:employeeID/clients/:clientID")
    .delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), controller.deleteEmployeeClient);
router
    .route("/employees/:employeeID/commission")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), controller.getEmployeeCommission);
exports.default = router;
//# sourceMappingURL=employeeCommission.routes.js.map