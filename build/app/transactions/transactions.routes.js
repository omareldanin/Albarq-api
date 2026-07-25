"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const transactions_controller_1 = require("./transactions.controller");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const isAutherized_1 = require("../../middlewares/isAutherized");
const upload_1 = require("../../middlewares/upload");
const router = (0, express_1.Router)();
const transactionsController = new transactions_controller_1.TransactionsController();
router
    .route("/transactions")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), transactionsController.getAllTransactions)
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), transactionsController.createTransaction);
// --- specific/static paths BEFORE the :transactionID param route ---
router
    .route("/transactions/statistics")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), transactionsController.getStatistics);
router
    .route("/transactions/daily-statistics")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), transactionsController.getDailyStatistics);
router
    .route("/transactions/approve-all")
    .patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), transactionsController.approveAllBranchTransactions);
// --- parameterized routes AFTER ---
router
    .route("/transactions/:transactionID")
    .get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), transactionsController.getTransaction)
    .patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), transactionsController.updateTransaction)
    .delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), transactionsController.deleteTransaction);
router
    .route("/transactions/:transactionID/approve")
    .patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]), upload_1.upload.none(), transactionsController.approveAllBranchTransactions === undefined
    ? transactionsController.approveTransaction
    : transactionsController.approveTransaction);
exports.default = router;
//# sourceMappingURL=transactions.routes.js.map