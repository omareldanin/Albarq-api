import {Router} from "express";
import externalOrders from "../../app/externalOrders/orders.routes";

const router = Router();

router.use("/", externalOrders);

export default router;
