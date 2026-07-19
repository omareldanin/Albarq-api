import {Router} from "express";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {isAutherized} from "../../middlewares/isAutherized";
import {EmployeeRole} from "@prisma/client";
import {upload} from "../../middlewares/upload";
import {EmployeeClientCommissionController} from "./employeeCommission.controller";

const router = Router();
const controller = new EmployeeClientCommissionController();

router
  .route("/employees/:employeeID/commission")
  .post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    controller.createReport,
  );

router
  .route("/employees/:employeeID/clients")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    controller.getEmployeeClients,
  )
  .post(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    controller.upsertEmployeeClient,
  );

router
  .route("/employees/:employeeID/clients/:clientID")
  .delete(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    upload.none(),
    controller.deleteEmployeeClient,
  );

router
  .route("/employees/:employeeID/commission")
  .get(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]),
    controller.getEmployeeCommission,
  );

export default router;
