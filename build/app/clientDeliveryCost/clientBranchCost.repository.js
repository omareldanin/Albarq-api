"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBranchCostRepository = void 0;
const db_1 = require("../../database/db");
class ClientBranchCostRepository {
    getClientBranchCosts = async ({ clientID }) => {
        return db_1.prisma.clientBranchCost.findMany({
            where: { clientId: clientID },
            include: {
                branch: { select: { id: true, name: true } },
            },
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
            create: {
                clientId: clientID,
                branchId: branchID,
                ...profits,
            },
        });
    };
    deleteClientBranchCost = async ({ clientID, branchID, }) => {
        return db_1.prisma.clientBranchCost.delete({
            where: { clientId_branchId: { clientId: clientID, branchId: branchID } },
        });
    };
    // Resolve applicable cost: per-branch override (if active) -> client defaults
    resolveDeliveryCost = async ({ clientID, branchID, }) => {
        const override = await db_1.prisma.clientBranchCost.findUnique({
            where: { clientId_branchId: { clientId: clientID, branchId: branchID } },
        });
        if (!override) {
            return null;
        }
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