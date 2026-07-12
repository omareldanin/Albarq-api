"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBranchCostRepository = void 0;
const db_1 = require("../../database/db");
class ClientBranchCostRepository {
    // ---------- CLIENT ----------
    getClientBranchCosts = async ({ clientID }) => {
        return db_1.prisma.clientBranchCost.findMany({
            where: { clientId: clientID },
            include: { branch: { select: { id: true, name: true } } },
        });
    };
    getClientBranchCost = async ({ clientID, branchID, }) => {
        return db_1.prisma.clientBranchCost.findUnique({
            where: { clientId_branchId: { clientId: clientID, branchId: branchID } },
        });
    };
    upsertClientBranchCost = async ({ clientID, data, }) => {
        const { branchID, ...profits } = data;
        return db_1.prisma.clientBranchCost.upsert({
            where: { clientId_branchId: { clientId: clientID, branchId: branchID } },
            update: profits,
            create: { clientId: clientID, branchId: branchID, ...profits },
        });
    };
    deleteClientBranchCost = async ({ clientID, branchID, }) => {
        return db_1.prisma.clientBranchCost.delete({
            where: { clientId_branchId: { clientId: clientID, branchId: branchID } },
        });
    };
    resolveClientDeliveryCost = async ({ clientID, branchID, }) => {
        const override = await db_1.prisma.clientBranchCost.findUnique({
            where: { clientId_branchId: { clientId: clientID, branchId: branchID } },
        });
        if (!override)
            return null;
        return {
            branchID,
            deliveryAgentProfit: override.deliveryAgentProfit,
            mainBranchProfit: override.mainBranchProfit,
            forwardedBranchProfit: override.forwardedBranchProfit,
            receivingBranchProfit: override.receivingBranchProfit,
            activeProfit: override.activeProfit,
        };
    };
    // ---------- COMPANY ----------
    getCompanyBranchCosts = async ({ companyID }) => {
        return db_1.prisma.clientBranchCost.findMany({
            where: { companyId: companyID },
            include: { branch: { select: { id: true, name: true } } },
        });
    };
    getCompanyBranchCost = async ({ companyID, branchID, }) => {
        return db_1.prisma.clientBranchCost.findUnique({
            where: { companyId_branchId: { companyId: companyID, branchId: branchID } },
        });
    };
    upsertCompanyBranchCost = async ({ companyID, data, }) => {
        const { branchID, ...profits } = data;
        return db_1.prisma.clientBranchCost.upsert({
            where: { companyId_branchId: { companyId: companyID, branchId: branchID } },
            update: profits,
            create: { companyId: companyID, branchId: branchID, ...profits },
        });
    };
    deleteCompanyBranchCost = async ({ companyID, branchID, }) => {
        return db_1.prisma.clientBranchCost.delete({
            where: { companyId_branchId: { companyId: companyID, branchId: branchID } },
        });
    };
    resolveCompanyDeliveryCost = async ({ companyID, branchID, }) => {
        const override = await db_1.prisma.clientBranchCost.findUnique({
            where: { companyId_branchId: { companyId: companyID, branchId: branchID } },
        });
        if (!override)
            return null;
        return {
            branchID,
            deliveryAgentProfit: override.deliveryAgentProfit,
            mainBranchProfit: override.mainBranchProfit,
            forwardedBranchProfit: override.forwardedBranchProfit,
            receivingBranchProfit: override.receivingBranchProfit,
            activeProfit: override.activeProfit,
        };
    };
}
exports.ClientBranchCostRepository = ClientBranchCostRepository;
//# sourceMappingURL=clientBranchCost.repository.js.map