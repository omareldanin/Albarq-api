import {Router} from "express";
import {ClientBranchCostController} from "./clientBranchCost.controller";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {isAutherized} from "../../middlewares/isAutherized";
import {EmployeeRole} from "@prisma/client";
import {upload} from "../../middlewares/upload";

const router = Router();
const clientBranchCostController = new ClientBranchCostController();

router
  .route("/clients/:clientID/branch-costs")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER]),
    clientBranchCostController.getClientBranchCosts,
  )
  .post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER]),
    upload.none(),
    clientBranchCostController.upsertClientBranchCost,
  );

router
  .route("/clients/:clientID/branch-costs/:branchID")
  .delete(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER]),
    upload.none(),
    clientBranchCostController.deleteClientBranchCost,
  );

router
  .route("/clients/:clientID/branch-costs/:branchID/resolve")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER]),
    clientBranchCostController.getResolvedCost,
  );

export default router;
