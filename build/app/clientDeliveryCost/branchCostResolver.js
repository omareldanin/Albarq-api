"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findActiveStoreBranchCost = exports.totalBranchCost = exports.resolveBranchCost = exports.branchCostValuesSelect = void 0;
const db_1 = require("../../database/db");
exports.branchCostValuesSelect = {
    branchId: true,
    deliveryAgentProfit: true,
    mainBranchProfit: true,
    forwardedBranchProfit: true,
    receivingBranchProfit: true,
};
/**
 * Store costs override the client's: when the store's active profit is on and it has
 * a row for this branch, that row is used. Otherwise the client's settings apply as before.
 */
const resolveBranchCost = (params) => {
    const { store, client, branchId } = params;
    if (branchId != null && store?.activeProfit) {
        const storeCost = store.branchCosts?.find((cost) => cost.branchId === branchId);
        if (storeCost) {
            return { activeProfit: true, cost: storeCost };
        }
    }
    return {
        activeProfit: !!client?.activeProfit,
        cost: branchId != null
            ? client?.branchCosts?.find((cost) => cost.branchId === branchId)
            : undefined,
    };
};
exports.resolveBranchCost = resolveBranchCost;
const totalBranchCost = (cost) => cost.deliveryAgentProfit +
    cost.mainBranchProfit +
    cost.forwardedBranchProfit +
    cost.receivingBranchProfit;
exports.totalBranchCost = totalBranchCost;
/** The store's own row for this branch, only when the store's active profit is on. */
const findActiveStoreBranchCost = async (storeId, branchId) => {
    if (!storeId || !branchId)
        return null;
    const store = await db_1.prisma.store.findUnique({
        where: { id: storeId },
        select: {
            activeProfit: true,
            branchCosts: { where: { branchId }, select: exports.branchCostValuesSelect },
        },
    });
    if (!store?.activeProfit)
        return null;
    return store.branchCosts[0] ?? null;
};
exports.findActiveStoreBranchCost = findActiveStoreBranchCost;
//# sourceMappingURL=branchCostResolver.js.map