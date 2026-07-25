"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsController = void 0;
const client_1 = require("@prisma/client");
const AppError_1 = require("../../lib/AppError");
const catchAsync_1 = require("../../lib/catchAsync");
const transactions_dto_1 = require("./transactions.dto");
const transaction_repository_1 = require("./transaction.repository");
const transactionsRepository = new transaction_repository_1.TransactionsRepository();
class TransactionsController {
    createTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const data = transactions_dto_1.TransactionCreateSchema.parse(req.body);
        const companyID = loggedInUser.companyID;
        if (!companyID) {
            throw new AppError_1.AppError("الشركة غير محددة", 400);
        }
        const transaction = await transactionsRepository.createTransaction({
            companyID,
            createdByID: loggedInUser.id,
            data,
        });
        res.status(200).json({ status: "success", data: transaction });
    });
    getAllTransactions = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        let companyID;
        if (Object.keys(client_1.AdminRole).includes(loggedInUser.role)) {
            companyID = req.query.company_id ? +req.query.company_id : undefined;
        }
        else {
            companyID = loggedInUser.companyID;
        }
        const branchID = req.query.branch_id ? +req.query.branch_id : undefined;
        const employeeID = req.query.employee_id
            ? +req.query.employee_id
            : undefined;
        const type = req.query.type;
        const approved = req.query.approved
            ? req.query.approved === "true"
            : undefined;
        const deleted = req.query.deleted === "true";
        const startDate = req.query.start_date
            ? new Date(req.query.start_date)
            : undefined;
        const endDate = req.query.end_date
            ? new Date(req.query.end_date)
            : undefined;
        const size = req.query.size ? +req.query.size : 10;
        let page = 1;
        if (req.query.page &&
            !Number.isNaN(+req.query.page) &&
            +req.query.page > 0) {
            page = +req.query.page;
        }
        const { transactions, pagesCount } = await transactionsRepository.getAllTransactionsPaginated({
            page,
            size,
            companyID,
            branchID,
            employeeID,
            type,
            approved,
            deleted,
            startDate,
            endDate,
        });
        res.status(200).json({
            status: "success",
            page,
            pagesCount,
            data: transactions,
        });
    });
    getTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const transactionID = +req.params.transactionID;
        const transaction = await transactionsRepository.getTransaction({
            transactionID,
        });
        if (!transaction) {
            throw new AppError_1.AppError("العملية غير موجودة", 404);
        }
        res.status(200).json({ status: "success", data: transaction });
    });
    getStatistics = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        // Admins may query any company; everyone else is scoped to their own
        let companyId;
        if (Object.keys(client_1.AdminRole).includes(loggedInUser.role)) {
            companyId = req.query.company_id ? +req.query.company_id : undefined;
        }
        else {
            companyId = loggedInUser.companyID;
        }
        const deliveryAgentId = req.query.delivery_agent_id
            ? +req.query.delivery_agent_id
            : undefined;
        const clientId = req.query.client_id ? +req.query.client_id : undefined;
        const branchId = req.query.branch_id ? +req.query.branch_id : undefined;
        const type = req.query.type;
        const start_date = req.query.start_date;
        const end_date = req.query.end_date;
        const statistics = await transactionsRepository.getStatistics({
            companyId,
            deliveryAgentId,
            clientId,
            branchId,
            type,
            start_date,
            end_date,
            loggedInUser,
        });
        res.status(200).json({
            status: "success",
            data: statistics,
        });
    });
    getDailyStatistics = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        // Admins may query any company; everyone else is scoped to their own
        let companyId;
        if (Object.keys(client_1.AdminRole).includes(loggedInUser.role)) {
            companyId = req.query.company_id ? +req.query.company_id : undefined;
        }
        else {
            companyId = loggedInUser.companyID;
        }
        const deliveryAgentId = req.query.delivery_agent_id
            ? +req.query.delivery_agent_id
            : undefined;
        const clientId = req.query.client_id ? +req.query.client_id : undefined;
        const branchId = req.query.branch_id ? +req.query.branch_id : undefined;
        const type = req.query.type;
        const start_date = req.query.start_date;
        const end_date = req.query.end_date;
        const statistics = await transactionsRepository.getDailyStatistics({
            companyId,
            deliveryAgentId,
            clientId,
            branchId,
            type,
            start_date,
            end_date,
            loggedInUser,
        });
        res.status(200).json({
            status: "success",
            data: statistics,
        });
    });
    updateTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const transactionID = +req.params.transactionID;
        const data = transactions_dto_1.TransactionUpdateSchema.parse(req.body);
        const transaction = await transactionsRepository.updateTransaction({
            transactionID,
            data,
        });
        res.status(200).json({ status: "success", data: transaction });
    });
    approveTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const transactionID = +req.params.transactionID;
        const transaction = await transactionsRepository.approveTransaction({
            transactionID,
        });
        res.status(200).json({ status: "success", data: transaction });
    });
    approveAllBranchTransactions = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const loggedInUser = res.locals.user;
        const branchID = loggedInUser.branchId;
        if (!branchID) {
            throw new AppError_1.AppError("لا يوجد فرع مرتبط بهذا المستخدم", 400);
        }
        const companyID = loggedInUser.companyID;
        if (!companyID) {
            throw new AppError_1.AppError("الشركة غير محددة", 400);
        }
        const { approvedCount } = await transactionsRepository.approveAllBranchTransactions({
            branchID,
            companyID,
        });
        res.status(200).json({
            status: "success",
            data: { approvedCount },
        });
    });
    deleteTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const transactionID = +req.params.transactionID;
        await transactionsRepository.deleteTransaction({ transactionID });
        res.status(200).json({ status: "success" });
    });
}
exports.TransactionsController = TransactionsController;
//# sourceMappingURL=transactions.controller.js.map