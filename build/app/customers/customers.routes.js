"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const customers_controller_1 = require("./customers.controller");
const router = (0, express_1.Router)();
const controller = new customers_controller_1.CustomersController();
router.get("/customers/lookup", isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([
    ...Object.values(client_1.AdminRole),
    ...Object.values(client_1.EmployeeRole),
    ...Object.values(client_1.ClientRole),
]), controller.lookup);
exports.default = router;
//# sourceMappingURL=customers.routes.js.map