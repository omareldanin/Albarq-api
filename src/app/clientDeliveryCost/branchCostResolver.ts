import {prisma} from "../../database/db";

export interface BranchCostValues {
  branchId: number;
  deliveryAgentProfit: number;
  mainBranchProfit: number;
  forwardedBranchProfit: number;
  receivingBranchProfit: number;
}

interface CostOwner {
  activeProfit?: boolean | null;
  branchCosts?: BranchCostValues[] | null;
}

export const branchCostValuesSelect = {
  branchId: true,
  deliveryAgentProfit: true,
  mainBranchProfit: true,
  forwardedBranchProfit: true,
  receivingBranchProfit: true,
} as const;

/**
 * Store costs override the client's: when the store's active profit is on and it has
 * a row for this branch, that row is used. Otherwise the client's settings apply as before.
 */
export const resolveBranchCost = (params: {
  store?: CostOwner | null;
  client?: CostOwner | null;
  branchId?: number | null;
}) => {
  const {store, client, branchId} = params;
  if (branchId != null && store?.activeProfit) {
    const storeCost = store.branchCosts?.find((cost) => cost.branchId === branchId);
    if (storeCost) {
      return {activeProfit: true, cost: storeCost as BranchCostValues | undefined};
    }
  }
  return {
    activeProfit: !!client?.activeProfit,
    cost:
      branchId != null
        ? (client?.branchCosts?.find((cost) => cost.branchId === branchId) as
            | BranchCostValues
            | undefined)
        : undefined,
  };
};

export const totalBranchCost = (cost: Omit<BranchCostValues, "branchId">) =>
  cost.deliveryAgentProfit +
  cost.mainBranchProfit +
  cost.forwardedBranchProfit +
  cost.receivingBranchProfit;

/** The store's own row for this branch, only when the store's active profit is on. */
export const findActiveStoreBranchCost = async (
  storeId: number | null | undefined,
  branchId: number | null | undefined,
) => {
  if (!storeId || !branchId) return null;
  const store = await prisma.store.findUnique({
    where: {id: storeId},
    select: {
      activeProfit: true,
      branchCosts: {where: {branchId}, select: branchCostValuesSelect},
    },
  });
  if (!store?.activeProfit) return null;
  return store.branchCosts[0] ?? null;
};
