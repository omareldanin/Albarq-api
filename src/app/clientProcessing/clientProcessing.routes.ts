import { ClientRole } from "@prisma/client";
import { Router } from "express";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { ClientProcessingController } from "./clientProcessing.controller";

const router = Router();
const controller = new ClientProcessingController();

// Separate from PATCH /orders/:id so client processing never runs the shared order update.
router.get(
    "/client-processing/orders",
    isLoggedIn,
    isAutherized([ClientRole.CLIENT]),
    controller.getOrders
    /*
      #swagger.tags = ['Client Processing']
      #swagger.description = 'The client\'s orders with status PROCESSING. state=pending lists not processed orders, state=processed lists processed or confirmed ones (with the latest client processing). counts has both totals.'
      #swagger.parameters['state'] = {in: 'query', type: 'string', enum: ['pending', 'processed'], default: 'pending'}
      #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
      #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 50}
    */
);

router.patch(
    "/client-processing/orders/:orderID",
    isLoggedIn,
    isAutherized([ClientRole.CLIENT]),
    controller.processOrder
    /*
      #swagger.tags = ['Client Processing']
      #swagger.description = 'Client processes an order in PROCESSING: sets processingStatus=processed, clientNotes, and a new first phone for CHANGE_PHONE, then adds an ORDER_PROCESS timeline entry and notifies the delivery agent and inquiry employees. The order status is not changed.'
      #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['action'], properties: {action: {type: 'string', enum: ['CONTACTED_REDELIVER', 'CONTACT_WHATSAPP', 'SEND_SMS', 'CHANGE_PHONE', 'OTHER']}, note: {type: 'string', maxLength: 300, description: 'Required for OTHER'}, phone: {type: 'string', description: 'Required for CHANGE_PHONE, 07XXXXXXXXX'}}}}}}
      #swagger.responses[400] = {description: 'Order is not in PROCESSING, or invalid phone'}
      #swagger.responses[409] = {description: 'Order status changed meanwhile'}
    */
);

export default router;
