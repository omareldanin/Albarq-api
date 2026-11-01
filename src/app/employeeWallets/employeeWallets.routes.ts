import { EmployeeRole } from "@prisma/client";
import { Router } from "express";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { upload } from "../../middlewares/upload";
import { EmployeeWalletsController } from "./employeeWallets.controller";

const router = Router();
const controller = new EmployeeWalletsController();
const authorize = isAutherized([EmployeeRole.COMPANY_MANAGER, EmployeeRole.BRANCH_MANAGER]);

router.get(
    "/employee-wallets/mine/:walletID/targets",
    isLoggedIn,
    controller.getOwnWalletTargets
    /* #swagger.tags = ['Employee Wallets']
       #swagger.description = 'Search names of eligible transaction targets in the wallet company.'
       #swagger.parameters['kind'] = {in: 'query', type: 'string', enum: ['branch', 'client'], required: true}
       #swagger.parameters['search'] = {in: 'query', type: 'string'}
       #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
       #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100} */
);
router.post(
    "/employee-wallets/mine/:walletID/transactions",
    isLoggedIn,
    upload.none(),
    controller.createOwnTransaction
    /* #swagger.tags = ['Employee Wallets']
       #swagger.description = 'Record an unapproved transaction in the authenticated employee wallet. FROM_BRANCH/TO_BRANCH require only targetBranchId; FROM_CLIENT/TO_CLIENT require only targetClientId. DEPOSIT/WITHDRAW accept neither target. Wallet balances are not recalculated.'
       #swagger.requestBody = {required: true, content: {'application/json': {schema: {$ref: '#/components/schemas/EmployeeWalletTransactionCreateSchema'}}}}
       #swagger.responses[201] = {description: 'Wallet transaction created'} */
);

// Personal access is scoped to the authenticated employee in the repository.
router.get(
    "/employee-wallets/mine",
    isLoggedIn,
    controller.getOwnWallets
    /* #swagger.tags = ['Employee Wallets']
       #swagger.description = 'Wallets assigned to the authenticated employee.' */
);
router.get(
    "/employee-wallets/mine/:walletID/filters",
    isLoggedIn,
    controller.getOwnWalletFilters
    /* #swagger.tags = ['Employee Wallets']
       #swagger.description = 'Destination options from this employee-owned wallet only.' */
);
router.get(
    "/employee-wallets/mine/:walletID/transactions",
    isLoggedIn,
    controller.getOwnTransactions
    /* #swagger.tags = ['Employee Wallets']
       #swagger.description = 'Filtered transactions for a wallet assigned to the authenticated employee.'
       #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
       #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100}
       #swagger.parameters['start_date'] = {in: 'query', type: 'string', format: 'date'}
       #swagger.parameters['end_date'] = {in: 'query', type: 'string', format: 'date'}
       #swagger.parameters['target_branch_id'] = {in: 'query', type: 'integer'}
       #swagger.parameters['target_client_id'] = {in: 'query', type: 'integer'}
       #swagger.parameters['type'] = {in: 'query', type: 'string'}
       #swagger.parameters['approved'] = {in: 'query', type: 'boolean'} */
);
router.get(
    "/employee-wallets/mine/:walletID/transactions/pdf",
    isLoggedIn,
    controller.exportOwnTransactionsPDF
    /* #swagger.tags = ['Employee Wallets']
       #swagger.description = 'PDF of all matching transactions for an employee-owned wallet.'
       #swagger.responses[200] = {description: 'PDF download', content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}}}
       #swagger.parameters['start_date'] = {in: 'query', type: 'string', format: 'date'}
       #swagger.parameters['end_date'] = {in: 'query', type: 'string', format: 'date'}
       #swagger.parameters['target_branch_id'] = {in: 'query', type: 'integer'}
       #swagger.parameters['target_client_id'] = {in: 'query', type: 'integer'}
       #swagger.parameters['type'] = {in: 'query', type: 'string'}
       #swagger.parameters['approved'] = {in: 'query', type: 'boolean'} */
);

router
    .route("/employee-wallets")
    .get(
        isLoggedIn,
        authorize,
        controller.getWallets
        /* #swagger.tags = ['Employee Wallets'] */
    )
    .post(
        isLoggedIn,
        authorize,
        upload.none(),
        controller.createWallet
        /*
      #swagger.tags = ['Employee Wallets']
      #swagger.requestBody = {required: true, content: {"application/json": {
        schema: {$ref: "#/components/schemas/EmployeeWalletCreateSchema"}
      }}}
    */
    );

router.route("/employee-wallets/:walletID/transactions/pdf").get(
    isLoggedIn,
    authorize,
    controller.exportTransactionsPDF
    /*
      #swagger.tags = ['Employee Wallets']
      #swagger.description = 'Download all matching wallet transactions as an Arabic PDF.'
      #swagger.responses[200] = {description: 'PDF download', content: {'application/pdf': {schema: {type: 'string', format: 'binary'}}}}
      #swagger.parameters['start_date'] = {in: 'query', type: 'string', format: 'date', description: 'Inclusive start date in Baghdad time'}
      #swagger.parameters['end_date'] = {in: 'query', type: 'string', format: 'date', description: 'Inclusive end date in Baghdad time'}
      #swagger.parameters['target_branch_id'] = {in: 'query', type: 'integer'}
      #swagger.parameters['target_client_id'] = {in: 'query', type: 'integer'}
      #swagger.parameters['type'] = {in: 'query', type: 'string'}
      #swagger.parameters['approved'] = {in: 'query', type: 'boolean'}
    */
);

router.route("/employee-wallets/:walletID/transactions").get(
    isLoggedIn,
    authorize,
    controller.getTransactions
    /*
      #swagger.tags = ['Employee Wallets']
      #swagger.parameters['page'] = {in: 'query', type: 'integer', default: 1}
      #swagger.parameters['size'] = {in: 'query', type: 'integer', default: 10, maximum: 100}
      #swagger.parameters['start_date'] = {in: 'query', type: 'string', format: 'date', description: 'Inclusive start date in Baghdad time'}
      #swagger.parameters['end_date'] = {in: 'query', type: 'string', format: 'date', description: 'Inclusive end date in Baghdad time'}
      #swagger.parameters['target_branch_id'] = {in: 'query', type: 'integer'}
      #swagger.parameters['target_client_id'] = {in: 'query', type: 'integer'}
      #swagger.parameters['type'] = {in: 'query', type: 'string'}
      #swagger.parameters['approved'] = {in: 'query', type: 'boolean'}
    */
);

router
    .route("/employee-wallets/:walletID")
    .get(
        isLoggedIn,
        authorize,
        controller.getWallet
        /* #swagger.tags = ['Employee Wallets'] */
    )
    .patch(
        isLoggedIn,
        authorize,
        upload.none(),
        controller.updateWallet
        /*
      #swagger.tags = ['Employee Wallets']
      #swagger.requestBody = {required: true, content: {"application/json": {
        schema: {$ref: "#/components/schemas/EmployeeWalletUpdateSchema"}
      }}}
    */
    )
    .delete(
        isLoggedIn,
        authorize,
        controller.deleteWallet
        /* #swagger.tags = ['Employee Wallets'] */
    );

export default router;
