"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersRepository = void 0;
const db_1 = require("../../database/db");
const orders_responses_1 = require("../orders/orders.responses");
const orders_response_1 = require("./orders.response");
const governerates_1 = require("../../lib/governerates");
const AppError_1 = require("../../lib/AppError");
let counter = 0;
class OrdersRepository {
    generateRandomId() {
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const datePart = `${month}${day}`;
        // Use last 3 digits of timestamp → more space for counter
        const ts = Date.now().toString().slice(-3);
        // 2-digit counter (00–99)
        counter = (counter + 1) % 100;
        const ctr = String(counter).padStart(2, "0");
        // Final ID → same length as before
        return `${datePart}${ts}${ctr}`;
    }
    async generateUniqueOrderId() {
        while (true) {
            const id = this.generateRandomId();
            const exists = await db_1.prisma.order.findUnique({
                where: { id },
            });
            if (!exists)
                return id;
        }
    }
    async createOrder(data) {
        // Add Additional costs
        let randomId = await this.generateUniqueOrderId();
        // Create order
        const createdOrder = await db_1.prisma.order.create({
            data: {
                id: randomId,
                totalCost: data.orderData.totalCost,
                deliveryCost: data.deliveryCost,
                quantity: data.orderData.quantity,
                weight: 0,
                recipientName: data.orderData.recipientName,
                recipientPhones: data.orderData.recipientPhones
                    ? data.orderData.recipientPhones
                    : data.orderData.recipientPhone
                        ? [data.orderData.recipientPhone]
                        : undefined,
                receiptNumber: data.orderData.receiptNumber
                    ? data.orderData.receiptNumber
                    : randomId,
                recipientAddress: data.orderData.recipientAddress,
                clientNotes: data.orderData.notes,
                details: data.orderData.details,
                deliveryType: "NORMAL",
                printed: true,
                governorate: data.orderData.governorate,
                branch: data.branchID
                    ? {
                        connect: {
                            id: data.branchID,
                        },
                    }
                    : undefined,
                repository: data.repositoryID
                    ? {
                        connect: {
                            id: data.repositoryID,
                        },
                    }
                    : undefined,
                location: {
                    connect: {
                        id: data.orderData.locationID,
                    },
                },
                store: {
                    connect: {
                        id: data.storeID,
                    },
                },
                company: {
                    connect: {
                        id: data.loggedInUser.companyID,
                    },
                },
                forwardedFrom: {
                    connect: {
                        id: data.loggedInUser.id,
                    },
                },
                forwarded: true,
                client: {
                    connect: {
                        id: data.clientID,
                    },
                },
                confirmed: true,
                receivedAt: data.orderData.confirmed ? new Date() : undefined,
                secondaryStatus: "SEND_TO_COMPANY",
                forwardedAt: new Date(),
                status: "IN_MAIN_REPOSITORY",
                deliveryAgent: undefined,
                orderProducts: undefined,
            },
            select: orders_responses_1.orderSelect,
        });
        await db_1.prisma.chat.create({
            data: {
                orderId: createdOrder.id,
                numberOfMessages: 0,
            },
        });
        await this.updateOrderTimeline({
            orderID: createdOrder.id,
            data: {
                type: "COMPANY_CHANGE",
                date: new Date(),
                old: {
                    id: createdOrder.forwardedFrom?.id,
                    name: createdOrder.forwardedFrom?.name,
                },
                new: {
                    id: createdOrder.company?.id,
                    name: createdOrder.company?.name,
                },
                by: { id: data.loggedInUser.id, name: data.loggedInUser.name },
                message: `تم احاله الطلب من  ${createdOrder.forwardedFrom?.name} إلي ${createdOrder.company.name}`,
            },
        });
        return createdOrder;
    }
    async updateOrder(data) {
        // Add Additional costs
        // Create order
        const order = await db_1.prisma.order.update({
            where: {
                id: data.orderID,
            },
            data: {
                quantity: data.orderData.quantity,
                totalCost: data.orderData.totalCost,
                paidAmount: data.orderData.paidAmount,
                receiptNumber: data.orderData.receiptNumber,
                governorate: data.orderData.governorate
                    ? data.orderData.governorate
                    : undefined,
                location: data.orderData.locationID
                    ? {
                        connect: {
                            id: data.orderData.locationID,
                        },
                    }
                    : undefined,
                recipientName: data.orderData.recipientName,
                recipientPhones: data.orderData.recipientPhones
                    ? data.orderData.recipientPhones
                    : data.orderData.recipientPhone
                        ? [data.orderData.recipientPhone]
                        : undefined,
                recipientAddress: data.orderData.recipientAddress,
                notes: data.orderData.notes,
                details: data.orderData.details,
            },
            select: orders_response_1.orderSelectApiKey,
        });
        return order;
    }
    async createOrderv2(data) {
        // Add Additional costs
        let randomId = await this.generateUniqueOrderId();
        const governorate = (0, governerates_1.fromExternalCode)(data.orderData.governorate_code);
        if (!governorate) {
            throw new AppError_1.AppError(`كود المحافظة غير صالح: ${data.orderData.governorate_code}`, 400);
        }
        // Create order
        const createdOrder = await db_1.prisma.order.create({
            data: {
                id: randomId,
                totalCost: data.orderData.amount_iqd,
                deliveryCost: data.deliveryCost,
                quantity: data.orderData.quantity,
                weight: 0,
                recipientName: data.orderData.receiver_name || "افتراضي",
                recipientPhones: [data.orderData.receiver_phone_1],
                receiptNumber: data.orderData.shipment_number + "",
                shipment_number: data.orderData.shipment_id + "",
                recipientAddress: data.orderData.address,
                clientNotes: data.orderData.note || "",
                details: data.orderData.note || "",
                deliveryType: "NORMAL",
                printed: true,
                governorate: governorate,
                branch: data.branchID
                    ? {
                        connect: {
                            id: data.branchID,
                        },
                    }
                    : undefined,
                repository: data.repositoryID
                    ? {
                        connect: {
                            id: data.repositoryID,
                        },
                    }
                    : undefined,
                location: {
                    connect: {
                        id: data.locationID,
                    },
                },
                store: {
                    connect: {
                        id: data.storeID,
                    },
                },
                company: {
                    connect: {
                        id: data.loggedInUser.companyID,
                    },
                },
                forwardedFrom: {
                    connect: {
                        id: data.loggedInUser.id,
                    },
                },
                forwarded: true,
                client: {
                    connect: {
                        id: data.clientID,
                    },
                },
                confirmed: true,
                secondaryStatus: "SEND_TO_COMPANY",
                forwardedAt: new Date(),
                status: "IN_MAIN_REPOSITORY",
                deliveryAgent: undefined,
                orderProducts: undefined,
            },
            select: orders_responses_1.orderSelect,
        });
        await db_1.prisma.chat.create({
            data: {
                orderId: createdOrder.id,
                numberOfMessages: 0,
            },
        });
        await this.updateOrderTimeline({
            orderID: createdOrder.id,
            data: {
                type: "COMPANY_CHANGE",
                date: new Date(),
                old: {
                    id: createdOrder.forwardedFrom?.id,
                    name: createdOrder.forwardedFrom?.name,
                },
                new: {
                    id: createdOrder.company?.id,
                    name: createdOrder.company?.name,
                },
                by: { id: data.loggedInUser.id, name: data.loggedInUser.name },
                message: `تم احاله الطلب من  ${createdOrder.forwardedFrom?.name} إلي ${createdOrder.company.name}`,
            },
        });
        return createdOrder;
    }
    async getAllOrdersPaginatedApiKey(data) {
        let startDate = new Date();
        let endDate = new Date();
        if (data.filters.startDate) {
            startDate = new Date(data.filters.startDate);
            startDate.setUTCDate(startDate.getUTCDate() - 1);
            startDate.setHours(21, 0, 0, 0);
        }
        if (data.filters.endDate) {
            endDate = new Date(data.filters.endDate);
            endDate.setHours(21, 0, 0, 0);
        }
        const where = {
            AND: [
                {
                    OR: [
                        {
                            receiptNumber: data.filters.search
                                ? data.filters.search
                                : undefined,
                        },
                        {
                            branchReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                        ? undefined
                                        : +data.filters.search
                                : undefined,
                        },
                        {
                            clientReport: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                        ? undefined
                                        : {
                                            some: {
                                                id: +data.filters.search,
                                            },
                                        }
                                : undefined,
                        },
                        {
                            repositoryReport: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                        ? undefined
                                        : {
                                            some: {
                                                id: +data.filters.search,
                                            },
                                        }
                                : undefined,
                        },
                        {
                            companyReport: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                        ? undefined
                                        : {
                                            some: {
                                                id: +data.filters.search,
                                            },
                                        }
                                : undefined,
                        },
                        {
                            deliveryAgentReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                        ? undefined
                                        : +data.filters.search
                                : undefined,
                        },
                        {
                            governorateReportId: data.filters.search
                                ? Number.isNaN(+data.filters.search)
                                    ? undefined
                                    : data.filters.search.length > 9
                                        ? undefined
                                        : +data.filters.search
                                : undefined,
                        },
                        {
                            recipientName: {
                                contains: data.filters.search,
                                mode: "insensitive",
                            },
                        },
                        {
                            recipientPhones: data.filters.search
                                ? {
                                    has: data.filters.search,
                                }
                                : undefined,
                        },
                        {
                            recipientAddress: {
                                contains: data.filters.search,
                                mode: "insensitive",
                            },
                        },
                    ],
                },
                {
                    OR: [
                        {
                            companyId: data.loggedInUser?.id,
                        },
                        {
                            forwardedFromId: data.loggedInUser?.id,
                        },
                    ],
                },
                {
                    deleted: false,
                },
                // Filter by orderID
                {
                    id: data.filters.orderID,
                },
                // Filter by status
                {
                    status: data.filters.status,
                },
                {
                    clientId: data.filters.clientID,
                },
                // Filter by storeID
                {
                    storeId: data.filters.storeID,
                },
                // Filter by locationID
                {
                    locationId: data.filters.locationID,
                },
                {
                    receiptNumber: data.filters.receiptNumber,
                },
                {
                    receiptNumber: data.filters.receiptNumbers
                        ? { in: data.filters.receiptNumbers }
                        : undefined,
                },
                // Filter by recipientName
                {
                    recipientName: data.filters.recipientName,
                },
                // Filter by recipientPhone
                {
                    recipientPhones: data.filters.recipientPhone
                        ? {
                            has: data.filters.recipientPhone,
                        }
                        : undefined,
                },
                // Filter by recipientAddress
                {
                    recipientAddress: data.filters.recipientAddress,
                },
                // Filter by startDate
                {
                    createdAt: data.filters.startDate
                        ? {
                            gt: startDate,
                        }
                        : undefined,
                },
                // Filter by endDate
                {
                    createdAt: data.filters.endDate
                        ? {
                            lt: endDate,
                        }
                        : undefined,
                },
                {
                    governorate: data.filters.governorate,
                },
            ],
        };
        const paginatedOrders = await db_1.prisma.order.findManyPaginated({
            where: {
                ...where,
            },
            orderBy: {
                createdAt: "desc",
            },
            select: orders_response_1.orderSelectApiKey,
        }, {
            page: data.filters.page,
            size: data.filters.size,
            withCount: true,
        });
        const ordersReformed = paginatedOrders.data;
        return {
            orders: ordersReformed,
            pagesCount: paginatedOrders.pagesCount,
            count: paginatedOrders.dataCount,
        };
    }
    async getAllReportsPaginatedApiKey(data) {
        let startDate = new Date();
        let endDate = new Date();
        if (data.filters.startDate) {
            startDate = new Date(data.filters.startDate);
            startDate.setUTCDate(startDate.getUTCDate() - 1);
            startDate.setHours(21, 0, 0, 0);
        }
        if (data.filters.endDate) {
            endDate = new Date(data.filters.endDate);
            endDate.setHours(21, 0, 0, 0);
        }
        const paginatedReports = await db_1.prisma.report.findManyPaginated({
            where: {
                deleted: false,
                type: "COMPANY",
                companyReport: {
                    companyId: data.loggedInUser?.id,
                },
            },
            orderBy: {
                [data.filters.sort.split(":")[0]]: data.filters.sort.split(":")[1] === "desc" ? "desc" : "asc",
            },
            select: {
                id: true,
                status: true,
                baghdadOrdersCount: true,
                governoratesOrdersCount: true,
                totalCost: true,
                companyNet: true,
                url: true,
                createdAt: true,
            },
        }, {
            page: data.filters.page,
            withCount: true,
            size: data.filters.size,
        });
        const ordersReformed = paginatedReports.data;
        return {
            reports: ordersReformed,
            pagesCount: paginatedReports.pagesCount,
            count: paginatedReports.dataCount,
        };
    }
    async deleteOrder(data) {
        const deletedOrder = await db_1.prisma.order.update({
            where: {
                id: data.orderID,
            },
            data: {
                deleted: true,
                deletedAt: new Date(),
            },
        });
        return deletedOrder;
    }
    async updateOrderTimeline(data) {
        await db_1.prisma.orderTimeline.create({
            data: {
                order: {
                    connect: {
                        id: data.orderID,
                    },
                },
                type: data.data.type,
                by: data.data.by,
                old: JSON.stringify(data.data.old),
                new: JSON.stringify(data.data.new),
                message: data.data.message,
                createdAt: data.data.date,
            },
        });
    }
    async getOrderByIdApiKey(data) {
        const order = await db_1.prisma.order.findUnique({
            where: {
                forwardedFromId: data.forwardedFrom,
                id: data.orderID,
                deleted: false,
            },
            select: orders_response_1.orderSelectApiKey,
        });
        return order;
    }
}
exports.OrdersRepository = OrdersRepository;
//# sourceMappingURL=orders.repository.js.map