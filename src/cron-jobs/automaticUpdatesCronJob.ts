import cron from "node-cron";
import {automaticUpdatesTask} from "../app/automatic-updates/tasks/automaticUpdatesTask";

export const automaticUpdatesCronJob = cron.schedule(
  "*/10 * * * *",
  async () => {
    await automaticUpdatesTask();
  },
  {
    scheduled: false,
    timezone: "Asia/Baghdad",
  },
);
