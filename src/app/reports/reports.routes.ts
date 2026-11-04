import {Router} from "express";

// import { Role } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
import {AdminRole, ClientRole, EmployeeRole, Permission} from "@prisma/client";
import {isAutherized} from "../../middlewares/isAutherized";
import {isLoggedIn} from "../../middlewares/isLoggedIn";
import {ReportController} from "./reports.controller";

const router = Router();
const reportController = new ReportController();

router
  .route("/reports")
  .post(
    isLoggedIn,
    isAutherized(
      [
        EmployeeRole.COMPANY_MANAGER,
        EmployeeRole.REPOSITORIY_EMPLOYEE,
        EmployeeRole.ACCOUNTANT,
        EmployeeRole.BRANCH_MANAGER,
      ],
      [
        Permission.CREATE_BRANCH_REPORT,
        Permission.CREATE_REPOSITORY_REPORT,
        Permission.CREATE_COMPANY_REPORT,
        Permission.CREATE_DELIVERY_AGENT_REPORT,
        Permission.CREATE_CLIENT_REPORT,
        Permission.CREATE_GOVERNMENT_REPORT,
      ],
    ),
    reportController.createReport,
  );

router.route("/reports").get(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.getAllReports,
  /*
        #swagger.tags = ['Reports Routes']

        #swagger.parameters['page'] = {
            in: 'query',
            description: 'Page Number',
            required: false
        }

        #swagger.parameters['size'] = {
            in: 'query',
            description: 'Page Size (Number of Items per Page) (Default: 10)',
            required: false
        }

        #swagger.parameters['sort'] = {
            in: 'query',
            description: 'Sort Query (Default: id:asc)',
            required: false
        }

        #swagger.parameters['start_date'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['end_date'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['client_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['store_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['repository_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['branch_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['delivery_agent_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['governorate'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['status'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['type'] = {
            in: 'query',
            description: '',
            required: false
        }type
    */
);

router.route("/reports/:reportID").get(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.getReport,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

router.route("/reports/:reportID/receipt/pdf").get(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.getReportReceiptPDF,
  /*
        #swagger.tags = ['Reports Routes']
        #swagger.summary = 'Print an Arabic report receipt with a report-ID QR code'
        #swagger.parameters['reportID'] = { in: 'path', required: true, type: 'integer', minimum: 1 }
        #swagger.responses[200] = {
            description: 'A5 portrait receipt PDF. Supports CLIENT, BRANCH, DELIVERY_AGENT, COMPANY and REPOSITORY.',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } }
        }
        #swagger.responses[400] = { description: 'Invalid report ID or unsupported report type' }
        #swagger.responses[401] = { description: 'Authentication required' }
        #swagger.responses[403] = { description: 'Report access is not permitted' }
        #swagger.responses[404] = { description: 'Report not found, deleted or outside the user scope' }
    */
);

router.route("/reports/:reportID/pdf").get(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.getReportPDF,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

router.route("/reports/clients/:reportID/pdf").get(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.getReportClientsPDF,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

router.route("/reports/pdf").post(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.getReportsReportPDF,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

router.route("/reports/:reportID/deliver").patch(
  isLoggedIn,
  isAutherized([EmployeeRole.RECEIVING_AGENT]),
  reportController.deliverReport,
  /*
        #swagger.tags = ['Reports Routes']
        #swagger.summary = 'Record delivery and set the client report agent'
        #swagger.description = 'Requires an active RECEIVING_AGENT in the same company. The first delivery sets clientReport.agent to the authenticated employee; prior assignment is not required. No request body is required; only an empty object is accepted. Payment and confirmation are unchanged. Repeated calls preserve the first delivery time and agent.'
        #swagger.parameters['reportID'] = { in: 'path', required: true, type: 'integer', minimum: 1 }
        #swagger.responses[200] = {
            description: 'Delivery recorded, or the report was already delivered',
            schema: { status: 'success', data: { id: 123, status: 'UNPAID', confirmed: false, delivered: true, deliveredAt: '2026-11-04T12:00:00.000Z', clientReport: { receivingAgentId: 20, agent: { id: 20, name: 'مندوب الاستلام' } } } }
        }
        #swagger.responses[400] = { description: 'Invalid report ID or nonempty request body' }
        #swagger.responses[401] = { description: 'Authentication required' }
        #swagger.responses[403] = { description: 'Requires an active receiving agent with valid company context' }
        #swagger.responses[404] = { description: 'Report missing, deleted, not a client report, or outside the company' }
    */
);

router.route("/reports/:reportID").patch(
  isLoggedIn,
  isAutherized([
    ...Object.values(AdminRole),
    ...Object.values(EmployeeRole),
    ...Object.values(ClientRole),
  ]),
  reportController.updateReport,
  /*
        #swagger.tags = ['Reports Routes']

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    "schema": { $ref: "#/components/schemas/ReportUpdateSchema" },
                    "examples": {
                        "ReportUpdateExample": { $ref: "#/components/examples/ReportUpdateExample" }
                    }
                }
            }
        }
    */
);

router.route("/reports/:reportID").delete(
  isLoggedIn,
  isAutherized(
    [EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN, AdminRole.ADMIN_ASSISTANT],
    [Permission.DELETE_DELIVERY_AGENT_REPORT],
  ),
  reportController.deleteReport,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

router.route("/reports/:reportID/deactivate").patch(
  isLoggedIn,
  isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole)]),
  reportController.deactivateReport,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

router.route("/reports/:reportID/reactivate").patch(
  isLoggedIn,
  isAutherized(
    [EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN, AdminRole.ADMIN_ASSISTANT],
    [Permission.REACTIVE_REPORT],
  ),
  reportController.reactivateReport,
  /*
        #swagger.tags = ['Reports Routes']
    */
);

export default router;
