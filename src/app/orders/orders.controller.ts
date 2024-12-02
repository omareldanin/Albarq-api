import { catchAsync } from "../../lib/catchAsync";
import type { loggedInUserType } from "../../types/user";
import {
    OrderChatNotificationCreateSchema,
    OrderCreateSchema,
    type OrderCreateType,
    OrderRepositoryConfirmByReceiptNumberSchema,
    OrderTimelineFiltersSchema,
    OrderUpdateSchema,
    OrdersFiltersSchema,
    OrdersReceiptsCreateSchema,
    OrdersReportPDFCreateSchema,
    // OrdersReceiptsCreateSchema,
    OrdersStatisticsFiltersSchema
} from "./orders.dto";
import { OrdersService } from "./orders.service";

const ordersService = new OrdersService();

export class OrdersController {
    createOrder = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;
        let orderOrOrders: OrderCreateType | OrderCreateType[];
        if (Array.isArray(req.body)) {
            orderOrOrders = req.body.map((order) => OrderCreateSchema.parse(order));
        } else {
            orderOrOrders = OrderCreateSchema.parse(req.body);
        }

        const createdOrderOrOrders = await ordersService.createOrder({
            loggedInUser: loggedInUser,
            orderOrOrdersData: orderOrOrders
        });

        res.status(200).json({
            status: "success",
            data: createdOrderOrOrders
        });
    });

    getAllOrders = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;

        const filters = OrdersFiltersSchema.parse({
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            automaticUpdateID: req.query.automatic_update_id,
            search: req.query.search,
            sort: req.query.sort,
            page: req.query.page,
            size: req.query.size,
            confirmed: req.query.confirmed,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            deliveryDate: req.query.delivery_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            status: req.query.status,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            productID: req.query.product_id,
            locationID: req.query.location_id,
            receiptNumber: req.query.receipt_number,
            receiptNumbers: req.query.receipt_numbers,
            recipientName: req.query.recipient_name,
            recipientPhone: req.query.recipient_phone,
            recipientAddress: req.query.recipient_address,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report,
            notes: req.query.notes,
            deleted: req.query.deleted,
            orderID: req.query.order_id,
            minified: req.query.minified,
            forwarded: req.query.forwarded,
            forwardedByID: req.query.forwarded_by_id,
            forwardedFromID: req.query.forwarded_from_id,
            processed: req.query.processed
        });

        const { orders, ordersMetaData, page, pagesCount } = await ordersService.getAllOrders({
            loggedInUser: loggedInUser,
            filters: filters
        });

        res.status(200).json({
            status: "success",
            page: page,
            pagesCount: pagesCount,
            data: {
                orders: orders,
                ordersMetaData: ordersMetaData
            }
        });
    });

    getOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };

        const order = await ordersService.getOrder({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    });

    updateOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;
        const orderData = OrderUpdateSchema.parse(req.body);

        const order = await ordersService.updateOrder({
            params: params,
            orderData: orderData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    });

    repositoryConfirmOrderByReceiptNumber = catchAsync(async (req, res) => {
        const params = {
            orderReceiptNumber: +req.params.orderReceiptNumber
        };
        const loggedInUser = res.locals.user as loggedInUserType;
        const orderData = OrderRepositoryConfirmByReceiptNumberSchema.parse(req.body);

        const order = await ordersService.repositoryConfirmOrderByReceiptNumber({
            params: params,
            orderData: orderData,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success",
            data: order
        });
    });

    deleteOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };

        await ordersService.deleteOrder({
            params: params
        });

        res.status(200).json({
            status: "success"
        });
    });

    createOrdersReceipts = catchAsync(async (req, res) => {
        const ordersIDs = OrdersReceiptsCreateSchema.parse(req.body);

        const pdf = await ordersService.createOrdersReceipts({ ordersIDs });

        res.contentType("application/pdf");
        res.send(pdf);
    });

    getOrdersReportPDF = catchAsync(async (req, res) => {
        const ordersData = OrdersReportPDFCreateSchema.parse(req.body);

        const filters = OrdersFiltersSchema.parse({
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            sort: "receiptNumber:asc",
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            status: req.query.status,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            repositoryID: req.query.repository_id,
            branchID: req.query.branch_id,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report,
            minified: false
        });

        const pdf = await ordersService.getOrdersReportPDF({
            ordersData: ordersData,
            ordersFilters: filters
        });

        res.contentType("application/pdf");
        res.send(pdf);
    });

    getOrdersStatistics = catchAsync(async (req, res) => {
        const loggedInUser = res.locals.user as loggedInUserType;

        const filters = OrdersStatisticsFiltersSchema.parse({
            clientID: req.query.client_id,
            deliveryAgentID: req.query.delivery_agent_id,
            companyID: req.query.company_id,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            locationID: req.query.location_id,
            clientReport: req.query.client_report,
            repositoryReport: req.query.repository_report,
            branchReport: req.query.branch_report,
            deliveryAgentReport: req.query.delivery_agent_report,
            governorateReport: req.query.governorate_report,
            companyReport: req.query.company_report
        });

        const statistics = await ordersService.getOrdersStatistics({
            loggedInUser: loggedInUser,
            filters: filters
        });

        res.status(200).json({
            status: "success",
            data: statistics
        });
    });

    getOrderTimeline = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };

        const filters = OrderTimelineFiltersSchema.parse({
            type: req.query.type,
            types: req.query.types
        });

        const orderTimeline = await ordersService.getOrderTimeline({
            params: params,
            filters: filters
        });

        res.status(200).json({
            status: "success",
            data: orderTimeline
        });
    });

    getOrderChatMembers = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };

        const orderChatMembers = await ordersService.getOrderChatMembers({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: orderChatMembers
        });
    });

    getOrderInquiryEmployees = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };

        const orderInquiryEmployees = await ordersService.getOrderInquiryEmployees({
            params: params
        });

        res.status(200).json({
            status: "success",
            data: orderInquiryEmployees
        });
    });

    deactivateOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;

        await ordersService.deactivateOrder({
            params: params,
            loggedInUser: loggedInUser
        });

        res.status(200).json({
            status: "success"
        });
    });

    reactivateOrder = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };

        await ordersService.reactivateOrder({
            params: params
        });

        res.status(200).json({
            status: "success"
        });
    });

    sendNotificationToOrderChatMembers = catchAsync(async (req, res) => {
        const params = {
            orderID: +req.params.orderID
        };
        const loggedInUser = res.locals.user as loggedInUserType;
        const notificationData = OrderChatNotificationCreateSchema.parse(req.body);

        await ordersService.sendNotificationToOrderChatMembers({
            params: params,
            loggedInUser: loggedInUser,
            notificationData: notificationData
        });

        res.status(200).json({
            status: "success"
        });
    });
}
