import cron from "node-cron";
import {Prisma} from "@prisma/client";
import {prisma} from "../database/db";

const RETENTION_DAYS = 90;

export const startPruneNotificationsCron = () => {
  // Sundays at 04:00
  cron.schedule(
    "0 4 * * 0",
    async () => {
      try {
        let total = 0;
        for (;;) {
          const deleted: number = await prisma.$executeRaw`
            DELETE FROM "Notification"
            WHERE "id" IN (
              SELECT "id" FROM "Notification"
              WHERE "createdAt" < now() - interval '${Prisma.raw(String(RETENTION_DAYS))} days'
              LIMIT 10000
            );
          `;
          if (deleted === 0) break;
          total += deleted;
          await new Promise((r) => setTimeout(r, 200));
        }
        console.log(`[prune-cron] deleted ${total} old notifications`);
      } catch (err) {
        console.error("[prune-cron] failed:", err);
      }
    },
    {timezone: "Asia/Baghdad"},
  );
};
