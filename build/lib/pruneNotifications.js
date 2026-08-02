"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../database/db");
const pruneNotifications = async (cutoff) => {
    console.log(`[prune] starting — deleting notifications before ${cutoff}`);
    let total = 0;
    for (;;) {
        const deleted = await db_1.prisma.$executeRaw `
      DELETE FROM "Notification"
      WHERE "id" IN (
        SELECT "id" FROM "Notification"
        WHERE "createdAt" < ${new Date(cutoff)}
        LIMIT 10000
      );
    `;
        if (deleted === 0)
            break;
        total += deleted;
        console.log(`[prune] ${total} deleted (before ${cutoff})`);
        // pause so production traffic isn't starved
        await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`[prune] done for ${cutoff} — ${total} rows`);
    return total;
};
const main = async () => {
    // cutoff passed as a CLI arg, e.g. npx tsx scripts/pruneNotifications.ts 2026-01-01
    const cutoff = process.argv[2];
    if (!cutoff) {
        console.error("Usage: npx tsx scripts/pruneNotifications.ts YYYY-MM-DD");
        process.exit(1);
    }
    await pruneNotifications(cutoff);
    await db_1.prisma.$disconnect();
};
main().catch(async (e) => {
    console.error("[prune] failed:", e);
    await db_1.prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=pruneNotifications.js.map