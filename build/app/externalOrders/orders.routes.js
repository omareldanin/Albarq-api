"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const orders_controller_1 = require("./orders.controller");
const express_1 = require("express");
const preventDuplicateRequests_1 = require("../../middlewares/preventDuplicateRequests");
const isApiCompany_1 = require("../../middlewares/isApiCompany");
const router = (0, express_1.Router)();
const ordersController = new orders_controller_1.OrdersController();
router
    .route("/company/forward-orders")
    .post(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.createOrder);
router
    .route("/shipments/create")
    .post(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.createOrderV2);
router
    .route("/company/forward-orders")
    .get(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.getAllOrdersApiKey);
router
    .route("/company/reports")
    .get(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.getAllReportssApiKey);
router
    .route("/company/locations")
    .get(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.publicGetAllLocations);
router
    .route("/company/statues")
    .get(preventDuplicateRequests_1.preventDuplicateRequests, ordersController.getOrderStatues);
router
    .route("/company/governorates")
    .get(preventDuplicateRequests_1.preventDuplicateRequests, ordersController.getOrderGovernments);
router
    .route("/company/forward-orders/:orderID")
    .get(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.getOrderByIdApiKey);
router
    .route("/company/forward-orders/:orderID")
    .patch(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.updateOrder);
router
    .route("/company/forward-orders/:orderID")
    .delete(isApiCompany_1.isApiCompany, preventDuplicateRequests_1.preventDuplicateRequests, ordersController.deleteOrder);
exports.default = router;
//# sourceMappingURL=orders.routes.js.map