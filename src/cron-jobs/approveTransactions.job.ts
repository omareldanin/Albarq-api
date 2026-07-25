import cron from "node-cron";
import {TransactionsRepository} from "../app/transactions/transaction.repository";

const transactionsRepository = new TransactionsRepository();

export const startApproveTransactionsCron = () => {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const {approvedCount} =
          await transactionsRepository.approveAllPendingTransactions();
        console.log(
          `[CRON] Auto-approved ${approvedCount} transactions at ${new Date().toISOString()}`,
        );
      } catch (err) {
        console.error("[CRON] approveAllPendingTransactions failed:", err);
      }
    },
    {
      timezone: "Asia/Baghdad", // match your business timezone
    },
  );

  console.log("[CRON] Transaction auto-approve job scheduled (daily 00:00)");
};
