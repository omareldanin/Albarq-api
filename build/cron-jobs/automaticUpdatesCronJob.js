"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.automaticUpdatesCronJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const automaticUpdatesTask_1 = require("../app/automatic-updates/tasks/automaticUpdatesTask");
exports.automaticUpdatesCronJob = node_cron_1.default.schedule("*/10 * * * *", async () => {
    await (0, automaticUpdatesTask_1.automaticUpdatesTask)();
}, {
    scheduled: false,
    timezone: "Asia/Baghdad",
});
//# sourceMappingURL=automaticUpdatesCronJob.js.map