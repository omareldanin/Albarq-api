"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsController = void 0;
const client_1 = require("@prisma/client");
const AppError_1 = require("../../lib/AppError");
const catchAsync_1 = require("../../lib/catchAsync");
const transactions_dto_1 = require("./transactions.dto");
const transaction_repository_1 = require("./transaction.repository");
const db_1 = require("../../database/db");
const transactionsRepository = new transaction_repository_1.TransactionsRepository();
class TransactionsController {
    createTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const data = transactions_dto_1.TransactionCreateSchema.parse(req.body);
        let branchID = loggedInUser.branchId;
        const companyID = loggedInUser.companyID;
        if (!companyID) {
            throw new AppError_1.AppError("الشركة غير محددة", 400);
        }
        if (loggedInUser?.role === "COMPANY_MANAGER") {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: loggedInUser.companyID,
                    mainRepository: true,
                },
                select: {
                    branchId: true,
                },
            });
            branchID = mainBranch?.branchId || loggedInUser.branchId;
        }
        const transaction = await transactionsRepository.createTransaction({
            companyID,
            createdByID: loggedInUser.id,
            data: { ...data, branchID },
        });
        res.status(200).json({ status: "success", data: transaction });
    });
    getProfitOrders = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        let companyId;
        if (Object.keys(client_1.AdminRole).includes(loggedInUser.role)) {
            companyId = req.query.company_id
                ? +req.query.company_id
                : loggedInUser.companyID;
        }
        else {
            companyId = loggedInUser.companyID;
        }
        const bucket = req.query.bucket;
        if (!bucket || !["inside", "received", "forwarded"].includes(bucket)) {
            throw new AppError_1.AppError("نوع الأرباح غير صحيح", 400);
        }
        // resolve the branch the same way getAllDailyProfits does
        const targetBranch = req.query.targetBranch
            ? +req.query.targetBranch
            : undefined;
        const receivedBranch = req.query.receivedBranch
            ? +req.query.receivedBranch
            : undefined;
        const forwardedBranch = req.query.forwardedBranch
            ? +req.query.forwardedBranch
            : undefined;
        let myBranchId = loggedInUser.branchId;
        if (loggedInUser.role === client_1.EmployeeRole.BRANCH_MANAGER) {
            myBranchId = loggedInUser.branchId;
        }
        else if (loggedInUser.role === client_1.EmployeeRole.COMPANY_MANAGER) {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: loggedInUser.companyID,
                    mainRepository: true,
                },
                select: { branchId: true },
            });
            myBranchId = mainBranch?.branchId || loggedInUser?.branchId;
        }
        let applyBranchScope = (loggedInUser.role === "COMPANY_MANAGER" ||
            !!loggedInUser.mainRepository) &&
            !targetBranch;
        if (loggedInUser?.role === "COMPANY_MANAGER" &&
            loggedInUser.mainRepository &&
            targetBranch) {
            myBranchId = targetBranch;
            applyBranchScope = false;
        }
        const startDay = req.query.start_day;
        const endDay = req.query.end_day;
        const clientId = req.query.client_id ? +req.query.client_id : undefined;
        const storeId = req.query.store_id ? +req.query.store_id : undefined;
        const deliveryAgentId = req.query.delivery_agent_id
            ? +req.query.delivery_agent_id
            : undefined;
        const governorate = req.query.governorate;
        const receiptNumber = req.query.receipt_number;
        const size = req.query.size ? +req.query.size : 20;
        let page = 1;
        if (req.query.page &&
            !Number.isNaN(+req.query.page) &&
            +req.query.page > 0) {
            page = +req.query.page;
        }
        const { orders, pagesCount, totals } = await transactionsRepository.getProfitOrders({
            companyId,
            myBranchId,
            bucket,
            applyBranchScope,
            startDay,
            endDay,
            page,
            size,
            clientId,
            storeId,
            deliveryAgentId,
            governorate,
            receiptNumber,
            receivedBranch,
            forwardedBranch,
        });
        res.status(200).json({
            status: "success",
            page,
            pagesCount,
            totals,
            data: orders,
        });
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
        const branchID = req.query.branch_id
            ? +req.query.branch_id
            : loggedInUser.branchId;
        const targetBranch = req.query.targetBranch
            ? +req.query.targetBranch
            : undefined;
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
            targetBranch,
        }, loggedInUser);
        res.status(200).json({
            status: "success",
            page,
            pagesCount,
            data: transactions,
        });
    });
    getAllDailyProfits = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        let companyId;
        if (Object.keys(client_1.AdminRole).includes(loggedInUser.role)) {
            companyId = req.query.company_id
                ? +req.query.company_id
                : loggedInUser.companyID;
        }
        else {
            companyId = loggedInUser.companyID;
        }
        // branch managers see only their own branch
        let branchId = req.query.branch_id ? +req.query.branch_id : undefined;
        const targetBranch = req.query.targetBranch
            ? +req.query.targetBranch
            : undefined;
        if (loggedInUser.role === client_1.EmployeeRole.BRANCH_MANAGER) {
            branchId = loggedInUser.branchId;
        }
        else if (loggedInUser.role === client_1.EmployeeRole.COMPANY_MANAGER) {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: loggedInUser.companyID,
                    mainRepository: true,
                },
                select: {
                    branchId: true,
                },
            });
            branchId = mainBranch?.branchId || loggedInUser?.branchId;
        }
        if (loggedInUser?.role === "COMPANY_MANAGER" &&
            loggedInUser.mainRepository &&
            targetBranch) {
            branchId = targetBranch;
        }
        const startDay = req.query.start_day;
        const endDay = req.query.end_day;
        const size = req.query.size ? +req.query.size : 30;
        let page = 1;
        if (req.query.page &&
            !Number.isNaN(+req.query.page) &&
            +req.query.page > 0) {
            page = +req.query.page;
        }
        const { dailyProfits, pagesCount, totals } = await transactionsRepository.getAllDailyProfits({
            page,
            size,
            companyId,
            branchId,
            startDay,
            endDay,
        });
        res.status(200).json({
            status: "success",
            page,
            pagesCount,
            totals,
            data: dailyProfits,
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
        const targetBranch = req.query.targetBranch
            ? +req.query.targetBranch
            : undefined;
        const statistics = await transactionsRepository.getStatistics({
            companyId,
            deliveryAgentId,
            clientId,
            branchId,
            type,
            start_date,
            end_date,
            targetBranch,
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
        const targetBranch = req.query.targetBranch
            ? +req.query.targetBranch
            : undefined;
        const statistics = await transactionsRepository.getDailyStatistics({
            companyId,
            deliveryAgentId,
            clientId,
            branchId,
            type,
            start_date,
            targetBranch,
            end_date,
            loggedInUser,
        });
        res.status(200).json({
            status: "success",
            data: statistics,
        });
    });
    getBranchrofit = (0, catchAsync_1.catchAsync)(async (req, res) => {
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
        const targetBranch = req.query.targetBranch
            ? +req.query.targetBranch
            : undefined;
        const statistics = await transactionsRepository.getDailyProfit({
            companyId,
            deliveryAgentId,
            clientId,
            branchId,
            type,
            start_date,
            end_date,
            targetBranch,
            loggedInUser,
        });
        res.status(200).json({
            status: "success",
            data: {
                today: statistics.today,
            },
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
            loggedInUser,
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