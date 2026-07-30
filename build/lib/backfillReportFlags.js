"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const db_1 = require("../database/db");
const recomputeReportFlags_1 = require("../app/orders/helpers/recomputeReportFlags");
const BATCH_SIZE = 5000;
const backfill = async () => {
    let cursor = null;
    let processed = 0;
    const startedAt = Date.now();
    for (;;) {
        // grab the next batch of ids in stable order
        const batch = await db_1.prisma.$queryRaw `
      SELECT "id" FROM "Order"
      ${cursor ? client_1.Prisma.sql `WHERE "id" > ${cursor}` : client_1.Prisma.empty}
      ORDER BY "id"
      LIMIT ${BATCH_SIZE};
    `;
        if (batch.length === 0)
            break;
        const ids = batch.map((r) => r.id);
        await (0, recomputeReportFlags_1.recomputeReportFlags)(client_1.Prisma.sql `o."id" = ANY(${ids}::text[])`);
        cursor = ids[ids.length - 1];
        processed += ids.length;
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(`[backfill] ${processed} orders processed (${elapsed}s)`);
        // small pause so we don't starve production traffic
        await new Promise((r) => setTimeout(r, 100));
    }
    console.log(`[backfill] done — ${processed} orders`);
    await db_1.prisma.$disconnect();
};
backfill().catch((e) => {
    console.error("[backfill] failed:", e);
    process.exit(1);
});
//# sourceMappingURL=backfillReportFlags.js.map