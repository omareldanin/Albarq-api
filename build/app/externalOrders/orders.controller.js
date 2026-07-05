"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const catchAsync_1 = require("../../lib/catchAsync");
const orders_dto_1 = require("../orders/orders.dto");
const orders_dto_2 = require("./orders.dto");
const orders_service_1 = require("./orders.service");
const db_1 = require("../../database/db");
const zod_1 = __importDefault(require("zod"));
const ordersService = new orders_service_1.OrdersService();
class OrdersController {
    createOrder = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        let orderOrOrders;
        if (Array.isArray(req.body)) {
            orderOrOrders = req.body.map((order) => orders_dto_2.OrderCreateSchema.parse(order));
        }
        else {
            orderOrOrders = orders_dto_2.OrderCreateSchema.parse(req.body);
        }
        const createdOrderOrOrders = await ordersService.createOrder({
            loggedInUser: loggedInUser,
            orderOrOrdersData: orderOrOrders,
        });
        res.status(200).json({
            status: "success",
            data: createdOrderOrOrders,
        });
    });
    createOrderV2 = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        console.log("---------------------------------------------//");
        console.log("req.body", req.body);
        console.log("---------------------------------------------//");
        const orders = zod_1.default
            .array(orders_dto_2.ShipmentSchema)
            .parse(req.body.shipments);
        const { acceptedShipments, rejectedShipments } = await ordersService.createOrderV2({
            loggedInUser: loggedInUser,
            orderOrOrdersData: orders,
        });
        res.status(200).json({
            success: acceptedShipments.length > 0,
            message: acceptedShipments.length > 0
                ? `${acceptedShipments.length} shipment(s) processed successfully`
                : "All shipments failed to process",
            timestamp: new Date().toISOString(),
            accepted_shipments: acceptedShipments,
            rejected_shipments: rejectedShipments,
            summary: {
                total_requested: orders.length,
                accepted_count: acceptedShipments.length,
                rejected_count: rejectedShipments.length,
            },
        });
    });
    getAllOrdersApiKey = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const filters = orders_dto_1.OrdersFiltersSchema.parse({
            search: req.query.search,
            sort: req.query.sort,
            page: req.query.page,
            size: req.query.size,
            confirmed: req.query.confirmed,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            startDeliveryDate: req.query.delivery_start_date,
            endDeliveryDate: req.query.delivery_end_date,
            deliveryDate: req.query.delivery_date,
            governorate: req.query.governorate,
            statuses: req.query.statuses,
            status: req.query.status,
            deliveryType: req.query.delivery_type,
            storeID: req.query.store_id,
            locationID: req.query.location_id,
            receiptNumber: req.query.receipt_number,
            receiptNumbers: req.query.receipt_numbers,
            recipientName: req.query.recipient_name,
            recipientPhone: req.query.recipient_phone,
            recipientAddress: req.query.recipient_address,
            clientReport: req.query.client_report,
            orderID: req.query.order_id,
            printed: req.query.printed,
        });
        const { orders, page, pagesCount, count } = await ordersService.getAllOrders({
            loggedInUser: loggedInUser,
            filters: filters,
        });
        res.status(200).json({
            status: "success",
            count,
            page: page,
            pagesCount: pagesCount,
            data: {
                orders: orders,
            },
        });
    });
    getOrderByIdApiKey = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const order = await ordersService.getOrderByIdApiKey({
            params: {
                orderID: req.params.orderID,
                forwardedFrom: loggedInUser.id,
            },
        });
        res.status(200).json({
            status: "success",
            data: order,
        });
    });
    publicGetAllLocations = (0, catchAsync_1.catchAsync)(async (req, res) => {
        const loggedInUser = res.locals.user;
        const governorate = req.query.governorate?.toString().toUpperCase();
        const locations = await db_1.prisma.location.findMany({
            where: {
                governorate: governorate || undefined,
                companyId: loggedInUser.companyID,
            },
            select: {
                id: true,
                name: true,
            },
        });
        res.status(200).json(locations);
    });
    getOrderStatues = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const statuses = [
            {
                value: "REGISTERED",
                name: "تم الطلب",
            },
            {
                value: "READY_TO_SEND",
                name: "جاهز للأرسال",
            },
            {
                value: "WITH_DELIVERY_AGENT",
                name: "بالطريق مع المندوب",
            },
            {
                value: "DELIVERED",
                name: "تم التوصيل",
            },
            {
                value: "REPLACED",
                name: "تم الاستبدال",
            },
            {
                value: "PARTIALLY_RETURNED",
                name: "مرتجع جزئي",
            },
            {
                value: "RETURNED",
                name: "راجع كلي",
            },
            {
                value: "POSTPONED",
                name: "مؤجل",
            },
            {
                value: "CHANGE_ADDRESS",
                name: "تغيير عنوان",
            },
            {
                value: "RESEND",
                name: "إعادة إرسال",
            },
            {
                value: "WITH_RECEIVING_AGENT",
                name: "مع مندوب الاستلام",
            },
            {
                value: "IN_MAIN_REPOSITORY",
                name: "مخزن الفرز الرئيسي",
            },
            {
                value: "IN_GOV_REPOSITORY",
                name: "مخزن فرز المحافظه",
            },
            {
                value: "PROCESSING",
                name: "قيد المعالجه",
            },
        ];
        res.status(200).json(statuses);
    });
    getOrderGovernments = (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const governorates = [
            { name: "الأنبار", value: "AL_ANBAR" },
            { name: "بابل", value: "BABIL" },
            { name: "بغداد", value: "BAGHDAD" },
            { name: "البصرة", value: "BASRA" },
            { name: "ذي قار", value: "DHI_QAR" },
            { name: "القادسية", value: "AL_QADISIYYAH" },
            { name: "ديالى", value: "DIYALA" },
            { name: "دهوك", value: "DUHOK" },
            { name: "أربيل", value: "ERBIL" },
            { name: "كربلاء", value: "KARBALA" },
            { name: "كركوك", value: "KIRKUK" },
            { name: "ميسان", value: "MAYSAN" },
            { name: "المثنى", value: "MUTHANNA" },
            { name: "النجف", value: "NAJAF" },
            { name: "نينوى", value: "NINAWA" },
            { name: "صلاح الدين", value: "SALAH_AL_DIN" },
            { name: "السليمانية", value: "SULAYMANIYAH" },
            { name: "واسط", value: "WASIT" },
            { name: "شركات بابل", value: "BABIL_COMPANIES" },
        ];
        res.status(200).json(governorates);
    });
}
exports.OrdersController = OrdersController;
//# sourceMappingURL=orders.controller.js.map