// import { ClientRole } from "@prisma/client";
// import { isAutherized } from "../../middlewares/isAutherized.middleware";
import { AdminRole, ClientRole, EmployeeRole, Permission } from "@prisma/client";
import { Router } from "express";
import { isAutherized } from "../../middlewares/isAutherized";
import { isLoggedIn } from "../../middlewares/isLoggedIn";
import { OrdersController } from "./orders.controller";

const router = Router();
const ordersController = new OrdersController();

router.route("/orders").post(
    isLoggedIn,
    isAutherized(
        [
            EmployeeRole.COMPANY_MANAGER,
            EmployeeRole.DATA_ENTRY,
            EmployeeRole.ACCOUNTANT,
            ClientRole.CLIENT,
            EmployeeRole.CLIENT_ASSISTANT
        ],
        [Permission.ADD_ORDER]
    ),
    ordersController.createOrder
    /*
        #swagger.tags = ['Orders Routes']

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    "schema": { $ref: "#/components/schemas/OrderCreateSchema" },
                    "examples": {
                        "OrderCreateExample": { $ref: "#/components/examples/OrderCreateExample" }
                    }
                }
            }
        }
    */
);

router.route("/orders").get(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.getAllOrders
    /*
        #swagger.tags = ['Orders Routes']

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

        #swagger.parameters['search'] = {
            in: 'query',
            description: 'Search Query',
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

        #swagger.parameters['delivery_date'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['governorate'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['statuses'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['delivery_type'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['delivery_agent_id'] = {
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

        #swagger.parameters['product_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['location_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['receipt_number'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['recipient_name'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['recipient_phone'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['recipient_address'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['notes'] = {
            in: 'query',
            description: '',
            required: false
        }
    */
);

// TODO: Remove this route
// router.route("/orders/statuses").get(
//     isLoggedIn,
//     // isAutherized([Role.ADMIN]),
//     getAllOrdersStatuses
//     /*
//         #swagger.tags = ['Orders Routes']
//     */
// );

// TODO: Remove this route
// router.route("/orders/today").get(
//     isLoggedIn,
//     // isAutherized([Role.ADMIN]),
//     getTodayOrdersCountAndEarnings
//     /*
//         #swagger.tags = ['Orders Routes']
//     */
// );

router.route("/orders/statistics").get(
    isLoggedIn,
    isAutherized([
        AdminRole.ADMIN,
        AdminRole.ADMIN_ASSISTANT,
        EmployeeRole.COMPANY_MANAGER,
        ClientRole.CLIENT,
        EmployeeRole.CLIENT_ASSISTANT,
        // TODO: Remove later
        ...Object.values(EmployeeRole),
        ...Object.values(ClientRole)
    ]),
    ordersController.getOrdersStatistics
    /*
        #swagger.tags = ['Orders Routes']

        #swagger.parameters['statuseses'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['delivery_type'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['location_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['store_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['client_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['company_id'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['client_report'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['branch_report'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['repository_report'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['delivery_agent_report'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['governorate_report'] = {
            in: 'query',
            description: '',
            required: false
        }

        #swagger.parameters['company_report'] = {
            in: 'query',
            description: '',
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

        #swagger.parameters['governorate'] = {
            in: 'query',
            description: '',
            required: false
        }
    */
);

router.route("/orders/pdf").post(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.getOrdersReportPDF
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID").get(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.getOrder
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID/timeline").get(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.getOrderTimeline
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID/chat-members").get(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.getOrderChatMembers
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID/inquiry-employees").get(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.getOrderInquiryEmployees
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID/chat").post(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.sendNotificationToOrderChatMembers
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/receipts").post(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.createOrdersReceipts
    /*
        #swagger.tags = ['Orders Routes']

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    "schema": { $ref: "#/components/schemas/OrdersReceiptsCreateSchema" },
                    "examples": {
                        "OrderCreateExample": { $ref: "#/components/examples/OrdersReceiptsCreateExample" }
                    }
                }
            }
        }
    */
);

router.route("/orders/:orderID").patch(
    isLoggedIn,
    isAutherized(
        [...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)],
        [
            Permission.CHANGE_CLOSED_ORDER_STATUS,
            Permission.CHANGE_ORDER_BRANCH,
            Permission.CHANGE_ORDER_CLIENT,
            Permission.CHANGE_ORDER_COMPANY,
            Permission.CHANGE_ORDER_DELIVERY_AGENT,
            Permission.CHANGE_ORDER_STATUS,
            Permission.CHANGE_ORDER_TOTAL_AMOUNT,
            Permission.LOCK_ORDER_STATUS,
            Permission.CHANGE_ORDER_DATA,
            Permission.CHANGE_ORDER_PAID_AMOUNT,
            Permission.CHANGE_ORDER_RECEIPT_NUMBER,
            Permission.CHANGE_ORDER_RECEPIENT_NUMBER
        ]
    ),
    ordersController.updateOrder
    /*
        #swagger.tags = ['Orders Routes']

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    "schema": { $ref: "#/components/schemas/OrderUpdateSchema" },
                    "examples": {
                        "OrderUpdateExample": { $ref: "#/components/examples/OrderUpdateExample" }
                    }
                }
            }
        }
    */
);

//  تأكيد مباشر برقم الوصل في صفحة ادخال رواجع المخزن
router.route("/orders/repository-confirm-order-by-receipt-number/:orderReceiptNumber").patch(
    isLoggedIn,
    isAutherized([...Object.values(AdminRole), ...Object.values(EmployeeRole), ...Object.values(ClientRole)]),
    ordersController.repositoryConfirmOrderByReceiptNumber
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID").delete(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN, AdminRole.ADMIN_ASSISTANT]),
    ordersController.deleteOrder
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID/deactivate").patch(
    isLoggedIn,
    isAutherized(
        [
            EmployeeRole.COMPANY_MANAGER,
            AdminRole.ADMIN,
            AdminRole.ADMIN_ASSISTANT,
            ClientRole.CLIENT,
            EmployeeRole.CLIENT_ASSISTANT
        ],
        [Permission.DELETE_ORDER]
    ),
    ordersController.deactivateOrder
    /*
        #swagger.tags = ['Orders Routes']
    */
);

router.route("/orders/:orderID/reactivate").patch(
    isLoggedIn,
    isAutherized([EmployeeRole.COMPANY_MANAGER, AdminRole.ADMIN, AdminRole.ADMIN_ASSISTANT]),
    ordersController.reactivateOrder
    /*
        #swagger.tags = ['Orders Routes']
    */
);

export default router;
