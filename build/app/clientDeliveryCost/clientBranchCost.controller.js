"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBranchCostController = void 0;
const client_1 = require("@prisma/client");
const AppError_1 = require("../../lib/AppError");
const catchAsync_1 = require("../../lib/catchAsync");
const clientBranchCost_dto_1 = require("./clientBranchCost.dto");
const clientBranchCost_repository_1 = require("./clientBranchCost.repository");
const clientBranchCostRepository = new clientBranchCost_repository_1.ClientBranchCostRepository();
class ClientBranchCostController {
    // ---------- CLIENT ----------
    getClientBranchCosts = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        const loggedInUser = res.locals.user;
        if ((loggedInUser.role === client_1.ClientRole.CLIENT ||
            loggedInUser.role === client_1.EmployeeRole.CLIENT_ASSISTANT) &&
            clientID !== loggedInUser.id) {
            throw new AppError_1.AppError("غير مصرح لك الاطلاع علي بيانات عميل اخر", 403);
        }
        const costs = await clientBranchCostRepository.getClientBranchCosts({
            clientID,
        });
        res.status(200).json({ status: "success", data: costs });
    });
    getResolvedCost = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        const branchID = +req.params.branchID;
        const cost = await clientBranchCostRepository.resolveClientDeliveryCost({
            clientID,
            branchID,
        });
        if (!cost) {
            throw new AppError_1.AppError("لا توجد تكلفة محددة لهذا الفرع", 404);
        }
        res.status(200).json({ status: "success", data: cost });
    });
    upsertClientBranchCost = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        const data = clientBranchCost_dto_1.ClientBranchCostUpsertSchema.parse(req.body);
        const cost = await clientBranchCostRepository.upsertClientBranchCost({
            clientID,
            data,
        });
        res.status(200).json({ status: "success", data: cost });
    });
    deleteClientBranchCost = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const clientID = +req.params.clientID;
        const branchID = +req.params.branchID;
        await clientBranchCostRepository.deleteClientBranchCost({
            clientID,
            branchID,
        });
        res.status(200).json({ status: "success" });
    });
    // ---------- COMPANY ----------
    getCompanyBranchCosts = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        const costs = await clientBranchCostRepository.getCompanyBranchCosts({
            companyID,
        });
        res.status(200).json({ status: "success", data: costs });
    });
    getCompanyResolvedCost = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        const branchID = +req.params.branchID;
        const cost = await clientBranchCostRepository.resolveCompanyDeliveryCost({
            companyID,
            branchID,
        });
        if (!cost) {
            throw new AppError_1.AppError("لا توجد تكلفة محددة لهذا الفرع", 404);
        }
        res.status(200).json({ status: "success", data: cost });
    });
    upsertCompanyBranchCost = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        const data = clientBranchCost_dto_1.ClientBranchCostUpsertSchema.parse(req.body);
        const cost = await clientBranchCostRepository.upsertCompanyBranchCost({
            companyID,
            data,
        });
        res.status(200).json({ status: "success", data: cost });
    });
    deleteCompanyBranchCost = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const companyID = +req.params.companyID;
        const branchID = +req.params.branchID;
        await clientBranchCostRepository.deleteCompanyBranchCost({
            companyID,
            branchID,
        });
        res.status(200).json({ status: "success" });
    });
}
exports.ClientBranchCostController = ClientBranchCostController;
//# sourceMappingURL=clientBranchCost.controller.js.map