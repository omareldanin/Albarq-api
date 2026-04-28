import cron from "node-cron";
import {automaticUpdatesTask} from "../app/automatic-updates/tasks/automaticUpdatesTask";
import {Logger} from "../lib/logger";

export const automaticUpdatesCronJob = cron.schedule(
  "*/10 * * * *",
  async () => {
    Logger.info("Running automatic updates");

    await automaticUpdatesTask();
  },
  {
    scheduled: false,
    timezone: "Asia/Baghdad",
  },
);
