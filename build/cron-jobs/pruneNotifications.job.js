"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPruneNotificationsCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const db_1 = require("../database/db");
const RETENTION_DAYS = 90;
const startPruneNotificationsCron = () => {
    // Sundays at 04:00
    node_cron_1.default.schedule("0 4 * * 0", async () => {
        try {
            let total = 0;
            for (;;) {
                const deleted = await db_1.prisma.$executeRaw `
            DELETE FROM "Notification"
            WHERE "id" IN (
              SELECT "id" FROM "Notification"
              WHERE "createdAt" < now() - interval '${client_1.Prisma.raw(String(RETENTION_DAYS))} days'
              LIMIT 10000
            );
          `;
                if (deleted === 0)
                    break;
                total += deleted;
                await new Promise((r) => setTimeout(r, 200));
            }
            console.log(`[prune-cron] deleted ${total} old notifications`);
        }
        catch (err) {
            console.error("[prune-cron] failed:", err);
        }
    }, { timezone: "Asia/Baghdad" });
};
exports.startPruneNotificationsCron = startPruneNotificationsCron;
//# sourceMappingURL=pruneNotifications.job.js.map