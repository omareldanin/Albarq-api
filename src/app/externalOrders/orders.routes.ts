import {OrdersController} from "./orders.controller";

import {Router} from "express";
import {preventDuplicateRequests} from "../../middlewares/preventDuplicateRequests";

import {isApiCompany} from "../../middlewares/isApiCompany";
const router = Router();

const ordersController = new OrdersController();

router
  .route("/company/forward-orders")
  .post(isApiCompany, preventDuplicateRequests, ordersController.createOrder);

router
  .route("/shipments/create")
  .post(isApiCompany, preventDuplicateRequests, ordersController.createOrderV2);

router
  .route("/company/forward-orders")
  .get(
    isApiCompany,
    preventDuplicateRequests,
    ordersController.getAllOrdersApiKey,
  );

router
  .route("/company/locations")
  .get(
    isApiCompany,
    preventDuplicateRequests,
    ordersController.publicGetAllLocations,
  );

router
  .route("/company/statues")
  .get(preventDuplicateRequests, ordersController.getOrderStatues);

router
  .route("/company/governorates")
  .get(preventDuplicateRequests, ordersController.getOrderGovernments);

router
  .route("/company/forward-orders/:orderID")
  .get(
    isApiCompany,
    preventDuplicateRequests,
    ordersController.getOrderByIdApiKey,
  );
export default router;
