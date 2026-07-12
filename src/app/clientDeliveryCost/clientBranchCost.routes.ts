import {Router} from "express";
import {ClientBranchCostController} from "./clientBranchCost.controller";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {isAutherized} from "../../middlewares/isAutherized";
import {AdminRole, EmployeeRole} from "@prisma/client";
import {upload} from "../../middlewares/upload";

const router = Router();
const clientBranchCostController = new ClientBranchCostController();

// ---------- CLIENT ----------
router
  .route("/clients/:clientID/branch-costs")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    clientBranchCostController.getClientBranchCosts,
  )
  .post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    upload.none(),
    clientBranchCostController.upsertClientBranchCost,
  );

router
  .route("/clients/:clientID/branch-costs/:branchID")
  .delete(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    upload.none(),
    clientBranchCostController.deleteClientBranchCost,
  );

router
  .route("/clients/:clientID/branch-costs/:branchID/resolve")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    clientBranchCostController.getResolvedCost,
  );

// ---------- COMPANY ----------
router
  .route("/companies/:companyID/branch-costs")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    clientBranchCostController.getCompanyBranchCosts,
  )
  .post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    upload.none(),
    clientBranchCostController.upsertCompanyBranchCost,
  );

router
  .route("/companies/:companyID/branch-costs/:branchID")
  .delete(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    upload.none(),
    clientBranchCostController.deleteCompanyBranchCost,
  );

router
  .route("/companies/:companyID/branch-costs/:branchID/resolve")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN]),
    clientBranchCostController.getCompanyResolvedCost,
  );

export default router;
