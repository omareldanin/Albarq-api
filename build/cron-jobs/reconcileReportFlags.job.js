"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReconcileReportFlagsCron = exports.reconcileReportFlags = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const db_1 = require("../database/db");
const recomputeReportFlags_1 = require("../app/orders/helpers/recomputeReportFlags");
// set to true only after the report-only mode has been quiet for several days
const AUTO_FIX = false;
const MISMATCH_CONDITION = client_1.Prisma.sql `
  o."hasMainReceivedReport" <> EXISTS (
    SELECT 1 FROM "_BranchReportToOrder" bro
    JOIN "BranchReport" br ON br."id" = bro."A"
    JOIN "Report" r ON r."id" = br."id"
    WHERE bro."B" = o."id" AND r."deleted" = false
      AND br."type" = 'received' AND br."forChildBranches" = false
  )
  OR o."hasMainForwardedReport" <> EXISTS (
    SELECT 1 FROM "_BranchReportToOrder" bro
    JOIN "BranchReport" br ON br."id" = bro."A"
    JOIN "Report" r ON r."id" = br."id"
    WHERE bro."B" = o."id" AND r."deleted" = false
      AND br."type" = 'forwarded' AND br."forChildBranches" = false
  )
  OR o."hasChildReceivedReport" <> EXISTS (
    SELECT 1 FROM "_BranchReportToOrder" bro
    JOIN "BranchReport" br ON br."id" = bro."A"
    JOIN "Report" r ON r."id" = br."id"
    WHERE bro."B" = o."id" AND r."deleted" = false
      AND br."type" = 'received' AND br."forChildBranches" = true
  )
  OR o."hasChildForwardedReport" <> EXISTS (
    SELECT 1 FROM "_BranchReportToOrder" bro
    JOIN "BranchReport" br ON br."id" = bro."A"
    JOIN "Report" r ON r."id" = br."id"
    WHERE bro."B" = o."id" AND r."deleted" = false
      AND br."type" = 'forwarded' AND br."forChildBranches" = true
  )
  OR o."hasDeliveredClientReport" <> EXISTS (
    SELECT 1 FROM "_ClientReportToOrder" cro
    JOIN "ClientReport" cr ON cr."id" = cro."A"
    JOIN "Report" r ON r."id" = cr."id"
    WHERE cro."B" = o."id" AND r."deleted" = false
      AND cr."secondaryType" = 'DELIVERED'
  )
  OR o."hasReturnedClientReport" <> EXISTS (
    SELECT 1 FROM "_ClientReportToOrder" cro
    JOIN "ClientReport" cr ON cr."id" = cro."A"
    JOIN "Report" r ON r."id" = cr."id"
    WHERE cro."B" = o."id" AND r."deleted" = false
      AND cr."secondaryType" = 'RETURNED'
  )
`;
const reconcileReportFlags = async () => {
    const startedAt = Date.now();
    // Only check recently-touched orders — keeps the job cheap.
    // Widen the window if you suspect older drift.
    const recentWindow = client_1.Prisma.sql `o."updatedAt" > now() - interval '3 days'`;
    const mismatches = await db_1.prisma.$queryRaw `
    SELECT o."id" FROM "Order" o
    WHERE ${recentWindow} AND (${MISMATCH_CONDITION})
    LIMIT 1000;
  `;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (mismatches.length === 0) {
        console.log(`[reconcile] clean — no mismatches (${elapsed}s)`);
        return { mismatchCount: 0, fixed: 0 };
    }
    console.error(`[reconcile] FOUND ${mismatches.length} flag mismatches (${elapsed}s)`, `sample ids: ${mismatches
        .slice(0, 10)
        .map((m) => m.id)
        .join(", ")}`);
    if (!AUTO_FIX) {
        // report-only: investigate the code path that caused these
        return { mismatchCount: mismatches.length, fixed: 0 };
    }
    const ids = mismatches.map((m) => m.id);
    const fixed = await (0, recomputeReportFlags_1.recomputeReportFlags)(client_1.Prisma.sql `o."id" = ANY(${ids}::text[])`);
    console.log(`[reconcile] fixed ${fixed} orders`);
    return { mismatchCount: mismatches.length, fixed };
};
exports.reconcileReportFlags = reconcileReportFlags;
const startReconcileReportFlagsCron = () => {
    // 03:00 daily — off-peak
    node_cron_1.default.schedule("0 3 * * *", async () => {
        try {
            await (0, exports.reconcileReportFlags)();
        }
        catch (err) {
            console.error("[reconcile] job failed:", err);
        }
    }, { timezone: "Asia/Baghdad" });
    console.log("[reconcile] report-flag reconciliation scheduled (daily 03:00)");
};
exports.startReconcileReportFlagsCron = startReconcileReportFlagsCron;
//# sourceMappingURL=reconcileReportFlags.job.js.map