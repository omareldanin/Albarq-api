"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeWalletsController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const employeeWallets_dto_1 = require("./employeeWallets.dto");
const employeeWallets_repository_1 = require("./employeeWallets.repository");
const employeeWallets_pdf_1 = require("./employeeWallets.pdf");
const repository = new employeeWallets_repository_1.EmployeeWalletsRepository();
class EmployeeWalletsController {
    getOwnWallets = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const wallets = await repository.getOwnWallets(res.locals.user);
        res.status(200).json({ status: "success", data: wallets });
    });
    getOwnWalletFilters = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const data = await repository.getOwnWalletFilters(res.locals.user, walletID);
        res.status(200).json({ status: "success", data });
    });
    getOwnWalletTargets = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const filters = employeeWallets_dto_1.EmployeeWalletTargetsSchema.parse(req.query);
        const result = await repository.getOwnWalletTargets(res.locals.user, walletID, filters);
        res.status(200).json({ status: "success", ...result });
    });
    createOwnTransaction = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const data = employeeWallets_dto_1.EmployeeWalletTransactionCreateSchema.parse(req.body);
        const transaction = await repository.createOwnTransaction(res.locals.user, walletID, data);
        res.status(201).json({ status: "success", data: transaction });
    });
    getOwnTransactions = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const filters = employeeWallets_dto_1.EmployeeWalletTransactionsSchema.parse(req.query);
        const result = await repository.getTransactions(res.locals.user, walletID, filters, true);
        res.status(200).json({ status: "success", ...result });
    });
    exportOwnTransactionsPDF = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const filters = employeeWallets_dto_1.EmployeeWalletTransactionsExportSchema.parse(req.query);
        const report = await repository.getTransactionsExport(res.locals.user, walletID, filters, true);
        const pdf = await (0, employeeWallets_pdf_1.generateWalletTransactionsPDF)(report, filters);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="wallet-${walletID}-transactions.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).send(Buffer.from(pdf));
    });
    createWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const data = employeeWallets_dto_1.EmployeeWalletCreateSchema.parse(req.body);
        const wallet = await repository.createWallet(res.locals.user, data);
        res.status(201).json({ status: "success", data: wallet });
    });
    getWallets = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const filters = employeeWallets_dto_1.EmployeeWalletListSchema.parse(req.query);
        const result = await repository.getWallets(res.locals.user, filters);
        res.status(200).json({ status: "success", ...result });
    });
    getWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const wallet = await repository.getWallet(res.locals.user, walletID);
        res.status(200).json({ status: "success", data: wallet });
    });
    updateWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const data = employeeWallets_dto_1.EmployeeWalletUpdateSchema.parse(req.body);
        const wallet = await repository.updateWallet(res.locals.user, walletID, data);
        res.status(200).json({ status: "success", data: wallet });
    });
    deleteWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        await repository.deleteWallet(res.locals.user, walletID);
        res.status(204).send();
    });
    exportTransactionsPDF = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const filters = employeeWallets_dto_1.EmployeeWalletTransactionsExportSchema.parse(req.query);
        const report = await repository.getTransactionsExport(res.locals.user, walletID, filters);
        const pdf = await (0, employeeWallets_pdf_1.generateWalletTransactionsPDF)(report, filters);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="wallet-${walletID}-transactions.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).send(Buffer.from(pdf));
    });
    getTransactions = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { walletID } = employeeWallets_dto_1.EmployeeWalletParamsSchema.parse(req.params);
        const filters = employeeWallets_dto_1.EmployeeWalletTransactionsSchema.parse(req.query);
        const result = await repository.getTransactions(res.locals.user, walletID, filters);
        res.status(200).json({ status: "success", ...result });
    });
}
exports.EmployeeWalletsController = EmployeeWalletsController;
//# sourceMappingURL=employeeWallets.controller.js.map