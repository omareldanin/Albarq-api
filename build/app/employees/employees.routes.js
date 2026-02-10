"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// import { upload } from "../../middlewares/upload.middleware";
const client_1 = require("@prisma/client");
const isAutherized_1 = require("../../middlewares/isAutherized");
// import { EmployeeRole } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const upload_1 = require("../../middlewares/upload");
const employees_controller_1 = require("./employees.controller");
const router = (0, express_1.Router)();
const employeesController = new employees_controller_1.EmployeesController();
router.route("/employees").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.BRANCH_MANAGER,
    client_1.EmployeeRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
], [client_1.Permission.ADD_DELIVERY_AGENT, client_1.Permission.MANAGE_EMPLOYEES]), upload_1.upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "idCard", maxCount: 1 },
    { name: "residencyCard", maxCount: 1 },
]), 
// upload.none(),
employeesController.createEmployee);
router.route("/employees").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    //TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), employeesController.getAllEmployees);
router.route("/employees/:employeeID").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    // TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), employeesController.getEmployee);
router.route("/employees/:employeeID").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    client_1.EmployeeRole.BRANCH_MANAGER,
]), 
// upload.single("avatar"),
// upload.single("idCard"),
// upload.single("residencyCard"),
upload_1.upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "idCard", maxCount: 1 },
    { name: "residencyCard", maxCount: 1 },
]), 
// upload.none(),
employeesController.updateEmployee);
router.route("/employees/:employeeID").delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
]), employeesController.deleteEmployee);
router.route("/employees/:employeeID/deactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
]), employeesController.deactivateEmployee);
router.route("/employees/:employeeID/reactivate").patch(isLoggedIn_1.isLoggedIn, 
//TODO: Maybe add All Employee Roles for profile update
(0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.AdminRole.ADMIN, client_1.AdminRole.ADMIN_ASSISTANT], [client_1.Permission.REACTIVE_EMPLOYEE]), employeesController.reactivateEmployee);
exports.default = router;
//# sourceMappingURL=employees.routes.js.map