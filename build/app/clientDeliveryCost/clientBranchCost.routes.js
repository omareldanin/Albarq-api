"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clientBranchCost_controller_1 = require("./clientBranchCost.controller");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const isAutherized_1 = require("../../middlewares/isAutherized");
const client_1 = require("@prisma/client");
const upload_1 = require("../../middlewares/upload");
const router = (0, express_1.Router)();
const clientBranchCostController = new clientBranchCost_controller_1.ClientBranchCostController();
router
    .route("/clients/:clientID/branch-costs")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER]), clientBranchCostController.getClientBranchCosts)
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER]), upload_1.upload.none(), clientBranchCostController.upsertClientBranchCost);
router
    .route("/clients/:clientID/branch-costs/:branchID")
    .delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER]), upload_1.upload.none(), clientBranchCostController.deleteClientBranchCost);
router
    .route("/clients/:clientID/branch-costs/:branchID/resolve")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER]), clientBranchCostController.getResolvedCost);
exports.default = router;
//# sourceMappingURL=clientBranchCost.routes.js.map