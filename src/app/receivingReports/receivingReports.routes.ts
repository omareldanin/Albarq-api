import { ClientRole, EmployeeRole } from "@prisma/client";
import { Router } from "express";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { ReceivingReportsController } from "./receivingReports.controller";

const router = Router();
const controller = new ReceivingReportsController();

// The repository narrows each role to its own reports (client, agent, or company).
const viewers = isAutherized([
    ClientRole.CLIENT,
    EmployeeRole.CLIENT_ASSISTANT,
    EmployeeRole.RECEIVING_AGENT,
    EmployeeRole.COMPANY_MANAGER
]);

router
    .route("/receiving-reports")
    .post(
        isLoggedIn,
        isAutherized([EmployeeRole.RECEIVING_AGENT]),
        controller.createReports
        /*
          #swagger.tags = ['Receiving Reports']
          #swagger.summary = 'Save a receiving report (كشف استلام) of received orders'
          #swagger.description = 'Takes the agent\'s orders with status WITH_RECEIVING_AGENT that are not in a receiving report yet, limited to clientID and/or ordersIDs when given, and saves one report per client. Responds 400 when there are no new orders and 409 when another request reported the same orders first.'
          #swagger.requestBody = {required: false, content: {"application/json": {schema: {type: 'object', properties: {clientID: {type: 'integer'}, ordersIDs: {type: 'array', items: {type: 'string'}}}}}}}
          #swagger.responses[201] = {description: 'Created reports'}
        */
    )
    .get(
        isLoggedIn,
        viewers,
        controller.getReports
        /*
          #swagger.tags = ['Receiving Reports']
          #swagger.description = 'Clients (and client assistants with MANAGE_REPORTS) see reports of their orders, receiving agents see the reports they created, company managers see the company\'s reports.'
          #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
          #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100}
          #swagger.parameters['start_date'] = {in: 'query', type: 'string', format: 'date', description: 'Inclusive start date in Baghdad time'}
          #swagger.parameters['end_date'] = {in: 'query', type: 'string', format: 'date', description: 'Inclusive end date in Baghdad time'}
          #swagger.parameters['client_id'] = {in: 'query', type: 'integer', description: 'Receiving agent and company manager only'}
          #swagger.parameters['receiving_agent_id'] = {in: 'query', type: 'integer', description: 'Company manager only'}
        */
    );

router.route("/receiving-reports/:reportID/pdf").get(
    isLoggedIn,
    viewers,
    controller.getReportPDF
    /*
      #swagger.tags = ['Receiving Reports']
      #swagger.responses[200] = {description: 'PDF download', content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}}}
    */
);

export default router;
