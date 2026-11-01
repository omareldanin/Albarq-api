import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    EmployeeWalletCreateSchema,
    EmployeeWalletListSchema,
    EmployeeWalletParamsSchema,
    EmployeeWalletTargetsSchema,
    EmployeeWalletTransactionCreateSchema,
    EmployeeWalletTransactionsExportSchema,
    EmployeeWalletTransactionsSchema,
    EmployeeWalletUpdateSchema
} from "./employeeWallets.dto";
import { EmployeeWalletsRepository } from "./employeeWallets.repository";

import { generateWalletTransactionsPDF } from "./employeeWallets.pdf";

const repository = new EmployeeWalletsRepository();

export class EmployeeWalletsController {
    getOwnWallets = catchAsync(async (_req, res) => {
        const wallets = await repository.getOwnWallets(res.locals.user as loggedInUserType);
        res.status(200).json({ status: "success", data: wallets });
    });

    getOwnWalletFilters = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const data = await repository.getOwnWalletFilters(res.locals.user as loggedInUserType, walletID);
        res.status(200).json({ status: "success", data });
    });

    getOwnWalletTargets = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const filters = EmployeeWalletTargetsSchema.parse(req.query);
        const result = await repository.getOwnWalletTargets(
            res.locals.user as loggedInUserType,
            walletID,
            filters
        );
        res.status(200).json({ status: "success", ...result });
    });

    createOwnTransaction = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const data = EmployeeWalletTransactionCreateSchema.parse(req.body);
        const transaction = await repository.createOwnTransaction(
            res.locals.user as loggedInUserType,
            walletID,
            data
        );
        res.status(201).json({ status: "success", data: transaction });
    });

    getOwnTransactions = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const filters = EmployeeWalletTransactionsSchema.parse(req.query);
        const result = await repository.getTransactions(
            res.locals.user as loggedInUserType,
            walletID,
            filters,
            true
        );
        res.status(200).json({ status: "success", ...result });
    });

    exportOwnTransactionsPDF = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const filters = EmployeeWalletTransactionsExportSchema.parse(req.query);
        const report = await repository.getTransactionsExport(
            res.locals.user as loggedInUserType,
            walletID,
            filters,
            true
        );
        const pdf = await generateWalletTransactionsPDF(report, filters);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="wallet-${walletID}-transactions.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).send(Buffer.from(pdf));
    });

    createWallet = catchAsync(async (req, res) => {
        const data = EmployeeWalletCreateSchema.parse(req.body);
        const wallet = await repository.createWallet(res.locals.user as loggedInUserType, data);
        res.status(201).json({ status: "success", data: wallet });
    });

    getWallets = catchAsync(async (req, res) => {
        const filters = EmployeeWalletListSchema.parse(req.query);
        const result = await repository.getWallets(res.locals.user as loggedInUserType, filters);
        res.status(200).json({ status: "success", ...result });
    });

    getWallet = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const wallet = await repository.getWallet(res.locals.user as loggedInUserType, walletID);
        res.status(200).json({ status: "success", data: wallet });
    });

    updateWallet = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const data = EmployeeWalletUpdateSchema.parse(req.body);
        const wallet = await repository.updateWallet(res.locals.user as loggedInUserType, walletID, data);
        res.status(200).json({ status: "success", data: wallet });
    });

    deleteWallet = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        await repository.deleteWallet(res.locals.user as loggedInUserType, walletID);
        res.status(204).send();
    });

    exportTransactionsPDF = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const filters = EmployeeWalletTransactionsExportSchema.parse(req.query);
        const report = await repository.getTransactionsExport(
            res.locals.user as loggedInUserType,
            walletID,
            filters
        );
        const pdf = await generateWalletTransactionsPDF(report, filters);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="wallet-${walletID}-transactions.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).send(Buffer.from(pdf));
    });

    getTransactions = catchAsync(async (req, res) => {
        const { walletID } = EmployeeWalletParamsSchema.parse(req.params);
        const filters = EmployeeWalletTransactionsSchema.parse(req.query);
        const result = await repository.getTransactions(
            res.locals.user as loggedInUserType,
            walletID,
            filters
        );
        res.status(200).json({ status: "success", ...result });
    });
}
