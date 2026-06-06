import { Router } from "express";

// import { upload } from "../../middlewares/upload.middleware";
import { AdminRole, ClientRole, EmployeeRole } from "@prisma/client";
import { isAutherized } from "../../middlewares/isAutherized";
// import { AdminRole } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { upload } from "../../middlewares/upload";
import { CompaniesController } from "./companies.controller";

const router = Router();
const companiesController = new CompaniesController();

router.route("/companies").post(
  isLoggedIn,
  isAutherized([AdminRole.ADMIN, AdminRole.ADMIN_ASSISTANT]),
  upload.single("logo"),
  // upload.none(),
  companiesController.createCompany,
);

router
  .route("/companies/api-key")
  .post(
    isLoggedIn,
    isAutherized([AdminRole.ADMIN, AdminRole.ADMIN_ASSISTANT]),
    upload.none(),
    companiesController.generateApikey,
  );

router.route("/companies").get(
  isLoggedIn,
  isAutherized([
    EmployeeRole.COMPANY_MANAGER,
    AdminRole.ADMIN,
    AdminRole.ADMIN_ASSISTANT,
    //TODO: Remove later
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  companiesController.getAllCompanies,
);

router.route("/companies/:companyID").get(
  isLoggedIn,
  isAutherized([
    EmployeeRole.COMPANY_MANAGER,
    AdminRole.ADMIN,
    AdminRole.ADMIN_ASSISTANT,
  ]),
  companiesController.getCompany,
  /*
        #swagger.tags = ['Companies Routes']
    */
);

router
  .route("/companies/:companyID")
  .patch(
    isLoggedIn,
    isAutherized([
      EmployeeRole.COMPANY_MANAGER,
      AdminRole.ADMIN,
      AdminRole.ADMIN_ASSISTANT,
    ]),
    upload.single("logo"),
    companiesController.updateCompany,
  );

router
  .route("/companies/:companyID")
  .delete(
    isLoggedIn,
    isAutherized([
      EmployeeRole.COMPANY_MANAGER,
      AdminRole.ADMIN,
      AdminRole.ADMIN_ASSISTANT,
    ]),
    companiesController.deleteCompany,
  );

export default router;
