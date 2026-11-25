import {AdminRole, ClientRole, EmployeeRole} from "@prisma/client";
import {Router} from "express";
import {isAutherized} from "../../middlewares/isAutherized";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {CustomersController} from "./customers.controller";

const router = Router();
const controller = new CustomersController();

router.get(
  "/customers/lookup",
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  controller.lookup,
  /*
    #swagger.tags = ['Customers']
    #swagger.summary = 'Customer history by phone (used while adding an order)'
    #swagger.description = 'stats: delivered / returned / in-progress counts and rates over all of the company\'s orders for this phone (counts only). lastOrder: recipient name and address from the caller\'s own orders (client: their orders; staff: the company), or null.'
    #swagger.parameters['phone'] = {in: 'query', required: true, type: 'string', example: '07721234567', description: 'Any format: 0772…, +964 772…, 00964…'}
  */
);

export default router;
