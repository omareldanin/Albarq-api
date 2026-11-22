import { EmployeeRole } from "@prisma/client";
import { Router } from "express";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { upload } from "../../middlewares/upload";
import { ClientLoansController } from "./clientLoans.controller";

const router = Router();
const controller = new ClientLoansController();
const managers = isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]);

router
    .route("/client-loans")
    .post(
        isLoggedIn,
        managers,
        upload.none(),
        controller.createLoan
        /*
          #swagger.tags = ['Client Loans']
          #swagger.summary = 'Pay a loan (سلفة) to a client'
          #swagger.description = 'Creates a WITHDRAW treasury transaction for the amount and an open loan. Open loans are deducted from the client\'s next delivered client report; creating that report is refused while open loans exceed its net. Deleting the transaction cancels an open loan.'
          #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', required: ['clientID', 'amount'], properties: {clientID: {type: 'integer'}, amount: {type: 'number'}, note: {type: 'string', maxLength: 300}, approved: {type: 'boolean', description: 'true from the main treasury'}}}}}}
        */
    )
    .get(
        isLoggedIn,
        managers,
        controller.getLoans
        /*
          #swagger.tags = ['Client Loans']
          #swagger.description = 'Loans of the company (branch managers: their branch clients). openTotal/openCount sum open loans for the same client filter.'
          #swagger.parameters['client_id'] = {in: 'query', type: 'integer'}
          #swagger.parameters['status'] = {in: 'query', type: 'string', enum: ['open', 'settled', 'all'], default: 'all'}
          #swagger.parameters['deleted'] = {in: 'query', type: 'boolean', default: false, description: 'true: deleted loans (with deletedAt and deletedBy)'}
          #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
          #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100}
        */
    );

router
    .route("/client-loans/:loanID")
    .patch(
        isLoggedIn,
        managers,
        upload.none(),
        controller.updateLoan
        /*
          #swagger.tags = ['Client Loans']
          #swagger.summary = 'Edit an open loan'
          #swagger.description = 'Only loans not deducted in a report. Updates the loan and its treasury withdrawal (amount and description). A loan released by a deleted report: note only.'
          #swagger.requestBody = {required: true, content: {"application/json": {schema: {type: 'object', properties: {clientID: {type: 'integer'}, amount: {type: 'number'}, note: {type: 'string', maxLength: 300}}}}}}
        */
    )
    .delete(
        isLoggedIn,
        managers,
        controller.deleteLoan
        /*
          #swagger.tags = ['Client Loans']
          #swagger.summary = 'Delete an open loan'
          #swagger.description = 'Only loans not deducted in a report. Deletes its treasury withdrawal; the loan is kept with deletedAt/deletedBy for deleted items (GET /client-loans?deleted=true).'
        */
    );

export default router;
