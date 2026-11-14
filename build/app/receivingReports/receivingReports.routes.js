"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const receivingReports_controller_1 = require("./receivingReports.controller");
const router = (0, express_1.Router)();
const controller = new receivingReports_controller_1.ReceivingReportsController();
// The repository narrows each role to its own reports (client, agent, or company).
const viewers = (0, isAutherized_1.isAutherized)([
    client_1.ClientRole.CLIENT,
    client_1.EmployeeRole.CLIENT_ASSISTANT,
    client_1.EmployeeRole.RECEIVING_AGENT,
    client_1.EmployeeRole.COMPANY_MANAGER
]);
router
    .route("/receiving-reports")
    .post(isLoggedIn_1.isLoggedIn, (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.RECEIVING_AGENT]), controller.createReports
/*
  #swagger.tags = ['Receiving Reports']
  #swagger.summary = 'Save a receiving report (كشف استلام) of received orders'
  #swagger.description = 'Takes the agent\'s orders with status WITH_RECEIVING_AGENT that are not in a receiving report yet, limited to clientID and/or ordersIDs when given, and saves one report per client. Responds 400 when there are no new orders and 409 when another request reported the same orders first.'
  #swagger.requestBody = {required: false, content: {"application/json": {schema: {type: 'object', properties: {clientID: {type: 'integer'}, ordersIDs: {type: 'array', items: {type: 'string'}}}}}}}
  #swagger.responses[201] = {description: 'Created reports'}
*/
)
    .get(isLoggedIn_1.isLoggedIn, viewers, controller.getReports
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
router.route("/receiving-reports/:reportID/pdf").get(isLoggedIn_1.isLoggedIn, viewers, controller.getReportPDF
/*
  #swagger.tags = ['Receiving Reports']
  #swagger.responses[200] = {description: 'PDF download', content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}}}
*/
);
exports.default = router;
//# sourceMappingURL=receivingReports.routes.js.map