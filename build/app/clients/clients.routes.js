"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// import { upload } from "../../middlewares/upload.middleware";
const client_1 = require("@prisma/client");
const isAutherized_1 = require("../../middlewares/isAutherized");
// import { Role } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const upload_1 = require("../../middlewares/upload");
const clients_controller_1 = require("./clients.controller");
const router = (0, express_1.Router)();
const clientsController = new clients_controller_1.ClientsController();
router.route("/clients").post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.BRANCH_MANAGER,
], [client_1.Permission.ADD_CLIENT]), upload_1.upload.single("avatar"), 
// upload.none(),
clientsController.createClient);
router
    .route("/clients/api-key")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
]), upload_1.upload.none(), clientsController.generateApikey);
router.route("/clients").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.BRANCH_MANAGER,
    client_1.EmployeeRole.REPOSITORIY_EMPLOYEE,
    //TODO: Remove later
    ...Object.values(client_1.EmployeeRole),
]), clientsController.getAllClients);
router.route("/clients/:clientID").get(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.BRANCH_MANAGER,
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
]), clientsController.getClient);
router.route("/clients/:clientID").patch(isLoggedIn_1.isLoggedIn, 
//TODO: Maybe add All Clients Roles for profile update
(0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.BRANCH_MANAGER,
]), upload_1.upload.single("avatar"), 
// upload.none(),
clientsController.updateClient);
router.route("/clients/:clientID").delete(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
]), clientsController.deleteClient);
router.route("/clients/:clientID/deactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    client_1.AdminRole.ADMIN,
    client_1.AdminRole.ADMIN_ASSISTANT,
    client_1.EmployeeRole.COMPANY_MANAGER,
    client_1.EmployeeRole.ACCOUNTANT,
    client_1.EmployeeRole.DATA_ENTRY,
    client_1.EmployeeRole.BRANCH_MANAGER,
]), clientsController.deactivateClient);
router.route("/clients/:clientID/reactivate").patch(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.AdminRole.ADMIN, client_1.AdminRole.ADMIN_ASSISTANT, client_1.EmployeeRole.COMPANY_MANAGER], [client_1.Permission.REACTIVE_STORE]), clientsController.reactivateClient);
exports.default = router;
//# sourceMappingURL=clients.routes.js.map