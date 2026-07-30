import {Prisma} from "@prisma/client";
import {prisma} from "../database/db";
import {recomputeReportFlags} from "../app/orders/helpers/recomputeReportFlags";

const BATCH_SIZE = 5000;

const backfill = async () => {
  let cursor: string | null = null;
  let processed = 0;
  const startedAt = Date.now();

  for (;;) {
    // grab the next batch of ids in stable order
    const batch: {id: string}[] = await prisma.$queryRaw`
      SELECT "id" FROM "Order"
      ${cursor ? Prisma.sql`WHERE "id" > ${cursor}` : Prisma.empty}
      ORDER BY "id"
      LIMIT ${BATCH_SIZE};
    `;

    if (batch.length === 0) break;

    const ids = batch.map((r) => r.id);

    await recomputeReportFlags(Prisma.sql`o."id" = ANY(${ids}::text[])`);

    cursor = ids[ids.length - 1];
    processed += ids.length;

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(`[backfill] ${processed} orders processed (${elapsed}s)`);

    // small pause so we don't starve production traffic
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`[backfill] done — ${processed} orders`);
  await prisma.$disconnect();
};

backfill().catch((e) => {
  console.error("[backfill] failed:", e);
  process.exit(1);
});
