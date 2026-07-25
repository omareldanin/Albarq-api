"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startApproveTransactionsCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const transaction_repository_1 = require("../app/transactions/transaction.repository");
const transactionsRepository = new transaction_repository_1.TransactionsRepository();
const startApproveTransactionsCron = () => {
    node_cron_1.default.schedule("0 0 * * *", async () => {
        try {
            const { approvedCount } = await transactionsRepository.approveAllPendingTransactions();
            console.log(`[CRON] Auto-approved ${approvedCount} transactions at ${new Date().toISOString()}`);
        }
        catch (err) {
            console.error("[CRON] approveAllPendingTransactions failed:", err);
        }
    }, {
        timezone: "Asia/Baghdad", // match your business timezone
    });
    console.log("[CRON] Transaction auto-approve job scheduled (daily 00:00)");
};
exports.startApproveTransactionsCron = startApproveTransactionsCron;
//# sourceMappingURL=approveTransactions.job.js.map