import {Router} from "express";
import {EmployeeRole} from "@prisma/client";
import {TransactionsController} from "./transactions.controller";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {isAutherized} from "../../middlewares/isAutherized";
import {upload} from "../../middlewares/upload";

const router = Router();
const transactionsController = new TransactionsController();

router
  .route("/transactions")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    transactionsController.getAllTransactions,
  )
  .post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    transactionsController.createTransaction,
  );

// --- specific/static paths BEFORE the :transactionID param route ---

router
  .route("/transactions/statistics")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    transactionsController.getStatistics,
  );

router
  .route("/transactions/daily-statistics")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    transactionsController.getDailyStatistics,
  );

router
  .route("/transactions/profits")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    transactionsController.getBranchrofit,
  );

router
  .route("/transactions/approve-all")
  .patch(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    transactionsController.approveAllBranchTransactions,
  );

// --- parameterized routes AFTER ---

router
  .route("/transactions/:transactionID")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    transactionsController.getTransaction,
  )
  .patch(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    transactionsController.updateTransaction,
  )
  .delete(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    transactionsController.deleteTransaction,
  );

router
  .route("/transactions/:transactionID/approve")
  .patch(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    transactionsController.approveAllBranchTransactions === undefined
      ? transactionsController.approveTransaction
      : transactionsController.approveTransaction,
  );

export default router;
