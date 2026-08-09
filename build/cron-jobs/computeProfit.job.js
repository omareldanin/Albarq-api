"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDailyProfitCron = exports.snapshotDailyProfits = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const db_1 = require("../database/db");
const n = (v) => Number(v ?? 0);
/**
 * Computes the three profit groups for one branch on one day,
 * mirroring computeProfit's logic exactly.
 */
const computeBranchDayProfit = async (params) => {
    const { companyId, branchId, applyBranchScope, from, to } = params;
    const dateSql = client_1.Prisma.sql `AND o."deliveriedAt" >= ${from} AND o."deliveriedAt" < ${to}`;
    const baseSql = client_1.Prisma.sql `
    o."companyId" = ${companyId}
    AND o."deleted" = false
    AND o."confirmed" = true
    AND o."status" IN ('DELIVERED','PARTIALLY_RETURNED','REPLACED')
  `;
    // ---- group 1: "inside" — differs by scope ----
    const insideRows = await db_1.prisma.$queryRaw `
    SELECT
      SUM(o."forwardedBranchNet") AS "forwardedBranchNet",
      SUM(o."receivingBranchNet") AS "receivingBranchNet",
      SUM(o."deliveryAgentNet")   AS "deliveryAgentNet",
      SUM(o."insideBranchNet")    AS "insideBranchNet",
      SUM(o."clientNet")          AS "clientNet",
      SUM(o."deliveryCost")       AS "deliveryCost",
      COUNT(o."id")               AS "count"
    FROM "Order" o
    JOIN "Client" c ON c."id" = o."clientId"
    WHERE ${baseSql}
      ${applyBranchScope
        ? client_1.Prisma.sql `
              AND c."branchId" <> ${branchId}
              AND o."branchId" IS DISTINCT FROM c."branchId"
            `
        : client_1.Prisma.sql `
              AND o."branchId" = ${branchId}
              AND c."branchId" = ${branchId}
            `}
      ${dateSql};
  `;
    // ---- group 2: "received" — same for both scopes ----
    const receivedRows = await db_1.prisma.$queryRaw `
    SELECT
      SUM(o."receivingBranchNet") AS "receivingBranchNet",
      SUM(o."deliveryAgentNet")   AS "deliveryAgentNet",
      COUNT(o."id")               AS "count"
    FROM "Order" o
    JOIN "Client" c ON c."id" = o."clientId"
    WHERE ${baseSql}
      AND o."branchId" = ${branchId}
      AND c."branchId" IS DISTINCT FROM ${branchId}
      ${dateSql};
  `;
    // ---- group 3: "forwarded" — same query, different formula ----
    const forwardedRows = await db_1.prisma.$queryRaw `
    SELECT
      SUM(o."forwardedBranchNet") AS "forwardedBranchNet",
      SUM(o."clientNet")          AS "clientNet",
      SUM(o."deliveryCost")       AS "deliveryCost",
      SUM(o."receivingBranchNet") AS "receivingBranchNet",
      SUM(o."deliveryAgentNet")   AS "deliveryAgentNet",
      COUNT(o."id")               AS "count"
    FROM "Order" o
    JOIN "Client" c ON c."id" = o."clientId"
    WHERE ${baseSql}
      AND o."branchId" IS DISTINCT FROM ${branchId}
      AND c."branchId" = ${branchId}
      ${dateSql};
  `;
    const inside = insideRows[0];
    const received = receivedRows[0];
    const forwarded = forwardedRows[0];
    const insideProfit = applyBranchScope
        ? n(inside.forwardedBranchNet) - n(inside.receivingBranchNet)
        : n(inside.insideBranchNet);
    const receivedProfit = n(received.receivingBranchNet) - n(received.deliveryAgentNet);
    const forwardedProfit = applyBranchScope
        ? n(forwarded.deliveryCost) -
            n(forwarded.receivingBranchNet) -
            n(forwarded.deliveryAgentNet)
        : n(forwarded.deliveryCost) - n(forwarded.forwardedBranchNet);
    return {
        insideProfit,
        receivedProfit,
        forwardedProfit,
        insideCount: n(inside.count),
        receivedCount: n(received.count),
        forwardedCount: n(forwarded.count),
    };
};
/**
 * Snapshots one DailyProfit row per branch for the given day.
 * Idempotent — safe to re-run.
 */
const snapshotDailyProfits = async (targetDay) => {
    const day = targetDay ?? new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 1);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayString = nextDay.toISOString().slice(0, 10);
    // every branch, flagged by whether it owns a main repository
    const branches = await db_1.prisma.branch.findMany({
        select: {
            id: true,
            companyId: true,
            repositories: {
                where: { mainRepository: true },
                select: { id: true },
            },
        },
    });
    let written = 0;
    for (const branch of branches) {
        const applyBranchScope = branch.repositories.length > 0;
        const p = await computeBranchDayProfit({
            companyId: branch.companyId,
            branchId: branch.id,
            applyBranchScope,
            from: day,
            to: nextDay,
        });
        // skip branches with no activity that day
        // if (totalCount === 0) continue;
        await db_1.prisma.dailyProfit.upsert({
            where: {
                companyId_branchId_day: {
                    companyId: branch.companyId,
                    branchId: branch.id,
                    day: dayString,
                },
            },
            update: {
                totalProfit: p.insideProfit + p.receivedProfit + p.forwardedProfit,
                insideProfit: p.insideProfit,
                receiviedProfit: p.receivedProfit,
                forwardedProfit: p.forwardedProfit,
                insideCount: p.insideCount,
                receiviedCount: p.receivedCount,
                forwardedCount: p.forwardedCount,
            },
            create: {
                day: dayString,
                companyId: branch.companyId,
                branchId: branch.id,
                totalProfit: p.insideProfit + p.receivedProfit + p.forwardedProfit,
                insideProfit: p.insideProfit,
                receiviedProfit: p.receivedProfit,
                forwardedProfit: p.forwardedProfit,
                insideCount: p.insideCount,
                receiviedCount: p.receivedCount,
                forwardedCount: p.forwardedCount,
            },
        });
        written++;
    }
    console.log(`[daily-profit] ${dayString} — ${written} branch rows`);
    return { day: dayString, written };
};
exports.snapshotDailyProfits = snapshotDailyProfits;
const startDailyProfitCron = () => {
    node_cron_1.default.schedule("0 0 * * *", async () => {
        try {
            await (0, exports.snapshotDailyProfits)();
        }
        catch (err) {
            console.error("[daily-profit] job failed:", err);
        }
    }, { timezone: "Asia/Baghdad" });
};
exports.startDailyProfitCron = startDailyProfitCron;
//# sourceMappingURL=computeProfit.job.js.map