import {prisma} from "../database/db";
import type {Governorate, Prisma} from "@prisma/client";

const BATCH_SIZE = 500;
const DRY_RUN = true; // ← flip to false after reviewing the dry output

type CostEntry = {governorate: Governorate; cost: number};
type OrderRow = {
  id: string;
  receiptNumber: string;
  governorate: Governorate;
  deliveryCost: number;
  forwardedFromId: number | null;
  forwarded: boolean;
  branchId: number | null;
  insideBranchNet: number;
  forwardedBranchNet: number;
  receivingBranchNet: number;
  client: {branchId: number | null};
  forwardedFrom: {
    governoratesDeliveryCosts: Prisma.JsonValue;
  } | null;
  deliveryAgent: {deliveryCost: number} | null;
};
const recompute = async () => {
  // one month back
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  from.setHours(0, 0, 0, 0);

  // preload every branch's cost tables — avoids a query per order
  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      receivingDeliveryCosts: true,
      forwardedDeliveryCosts: true,
    },
  });
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const costFor = (list: unknown, gov: Governorate | null) =>
    (list as CostEntry[] | null)?.find((c) => c.governorate === gov)?.cost ?? 0;

  let cursor: string | null = null;
  let scanned = 0;
  let changed = 0;

  for (;;) {
    const orders: OrderRow[] = await prisma.order.findMany({
      where: {
        deleted: false,
        deliveriedAt: {gte: from},
        forwardedBranchNet: {equals: 0},
        client: {
          branchId: {not: 114},
        },
        companyId: 16,
        ...(cursor && {id: {gt: cursor}}),
      },
      orderBy: {id: "asc"},
      take: BATCH_SIZE,
      select: {
        id: true,
        receiptNumber: true,
        governorate: true,
        deliveryCost: true,
        branchId: true,
        insideBranchNet: true,
        forwardedBranchNet: true,
        receivingBranchNet: true,
        forwardedFromId: true,
        forwarded: true,
        forwardedFrom: {
          select: {
            governoratesDeliveryCosts: true,
          },
        },
        client: {select: {branchId: true}},
        deliveryAgent: {select: {deliveryCost: true}},
      },
    });

    if (orders.length === 0) break;

    for (const o of orders) {
      const deliveryAgentCost = o.deliveryAgent?.deliveryCost ?? 0;

      let insideProfit = 0;
      let forwardedProfit = 0;
      let receivingBranchNet = 0;

      if (o.branchId === o.client.branchId) {
        insideProfit = (o.deliveryCost ?? 0) - deliveryAgentCost;
      } else {
        // NOTE: mirrors getProfits — order's branch uses forwardedDeliveryCosts,
        // client's branch uses receivingDeliveryCosts
        const orderBranch = o.branchId ? branchMap.get(o.branchId) : undefined;
        const clientBranch = o.client.branchId
          ? branchMap.get(o.client.branchId)
          : undefined;

        receivingBranchNet = costFor(
          orderBranch?.forwardedDeliveryCosts,
          o.governorate,
        );

        forwardedProfit = costFor(
          clientBranch?.receivingDeliveryCosts,
          o.governorate,
        );
      }

      // const differs =
      //   o.insideBranchNet !== insideProfit ||
      //   o.forwardedBranchNet !== forwardedProfit ||
      //   o.receivingBranchNet !== receivingBranchNet;

      // if (!differs) continue;

      if (DRY_RUN) {
        console.log(o.receiptNumber, {
          was: {
            inside: o.insideBranchNet,
            forwarded: o.forwardedBranchNet,
            receiving: o.receivingBranchNet,
          },
          now: {
            inside: insideProfit,
            forwarded: forwardedProfit,
            receiving: receivingBranchNet,
          },
        });
      } else {
        await prisma.order.update({
          where: {id: o.id},
          data: {
            insideBranchNet: insideProfit,
            forwardedBranchNet: forwardedProfit,
            receivingBranchNet: receivingBranchNet,
          },
        });
      }
      changed++;
    }

    cursor = orders[orders.length - 1].id;
    scanned += orders.length;
    console.log(
      `[recompute] ${scanned} scanned / ${changed} ${DRY_RUN ? "would change" : "changed"}`,
    );

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`[recompute] done — ${scanned} scanned, ${changed} affected`);
  await prisma.$disconnect();
};

recompute().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
