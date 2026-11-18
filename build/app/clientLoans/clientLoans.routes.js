"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const isAutherized_1 = require("../../middlewares/isAutherized");
const isLoggedIn_1 = require("../../middlewares/isLoggedIn");
const upload_1 = require("../../middlewares/upload");
const clientLoans_controller_1 = require("./clientLoans.controller");
const router = (0, express_1.Router)();
const controller = new clientLoans_controller_1.ClientLoansController();
const managers = (0, isAutherized_1.isAutherized)([client_1.EmployeeRole.COMPANY_MANAGER, client_1.EmployeeRole.BRANCH_MANAGER]);
router
    .route("/client-loans")
    .post(isLoggedIn_1.isLoggedIn, managers, upload_1.upload.none(), controller.createLoan
/*
  #swagger.tags = ['Client Loans']
  #swagger.summary = 'Pay a loan (سلفة) to a client'
  #swagger.description = 'Creates a WITHDRAW treasury transaction for the amount and an open loan. Open loans are deducted from the client\'s next delivered client report; creating that report is refused while open loans exceed its net. Deleting the transaction cancels an open loan.'
  #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['clientID', 'amount'], properties: {clientID: {type: 'integer'}, amount: {type: 'number'}, note: {type: 'string', maxLength: 300}, approved: {type: 'boolean', description: 'true from the main treasury'}}}}}}
*/
)
    .get(isLoggedIn_1.isLoggedIn, managers, controller.getLoans
/*
  #swagger.tags = ['Client Loans']
  #swagger.description = 'Loans of the company (branch managers: their branch clients). openTotal/openCount sum open loans for the same client filter.'
  #swagger.parameters['client_id'] = {in: 'query', type: 'integer'}
  #swagger.parameters['status'] = {in: 'query', type: 'string', enum: ['open', 'settled', 'all'], default: 'all'}
  #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
  #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100}
*/
);
exports.default = router;
//# sourceMappingURL=clientLoans.routes.js.map