import cron from "node-cron";
import {Prisma} from "@prisma/client";
import {prisma} from "../database/db";
import {recomputeReportFlags} from "../app/orders/helpers/recomputeReportFlags";

// set to true only after the report-only mode has been quiet for several days
const AUTO_FIX = true;

const MISMATCH_CONDITION = Prisma.sql`
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

export const reconcileReportFlags = async () => {
  const startedAt = Date.now();

  // Only check recently-touched orders — keeps the job cheap.
  // Widen the window if you suspect older drift.
  const recentWindow = Prisma.sql`o."updatedAt" > now() - interval '30 days'`;

  const mismatches = await prisma.$queryRaw<{id: string}[]>`
    SELECT o."id" FROM "Order" o
    WHERE ${recentWindow} AND (${MISMATCH_CONDITION})
    LIMIT 1000;
  `;

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (mismatches.length === 0) {
    console.log(`[reconcile] clean — no mismatches (${elapsed}s)`);
    return {mismatchCount: 0, fixed: 0};
  }

  console.error(
    `[reconcile] FOUND ${mismatches.length} flag mismatches (${elapsed}s)`,
    `sample ids: ${mismatches
      .slice(0, 10)
      .map((m) => m.id)
      .join(", ")}`,
  );

  if (!AUTO_FIX) {
    // report-only: investigate the code path that caused these
    return {mismatchCount: mismatches.length, fixed: 0};
  }

  const ids = mismatches.map((m) => m.id);
  const fixed = await recomputeReportFlags(
    Prisma.sql`o."id" = ANY(${ids}::text[])`,
  );

  console.log(`[reconcile] fixed ${fixed} orders`);
  return {mismatchCount: mismatches.length, fixed};
};

export const startReconcileReportFlagsCron = () => {
  // 03:00 daily — off-peak
  cron.schedule(
    "04 06 * * *",
    async () => {
      try {
        await reconcileReportFlags();
      } catch (err) {
        console.error("[reconcile] job failed:", err);
      }
    },
    {timezone: "Asia/Baghdad"},
  );

  console.log("[reconcile] report-flag reconciliation scheduled (daily 03:00)");
};
