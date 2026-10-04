"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const orders_repository_1 = require("./orders.repository");
const branches_repository_1 = require("../branches/branches.repository");
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const governerates_1 = require("../../lib/governerates");
const locations_repository_1 = require("../locations/locations.repository");
const ordersRepository = new orders_repository_1.OrdersRepository();
const branchesRepository = new branches_repository_1.BranchesRepository();
class OrdersService {
    normalizeArabic(text) {
        return text
            .normalize("NFKD") // decompose
            .replace(/[\u064B-\u065F\u0670]/g, "") // remove diacritics (tashkeel)
            .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // آأإٱ -> ا
            .replace(/\u0629/g, "\u0647") // ة -> ه
            .replace(/\u0649/g, "\u064A") // ى -> ي
            .replace(/\u0624/g, "\u0648") // ؤ -> و
            .replace(/\u0626/g, "\u064A") // ئ -> ي
            .replace(/\u0640/g, "") // remove tatweel ـ
            .replace(/\s+/g, " ") // collapse whitespace
            .trim();
    }
    createOrder = async (data) => {
        if (Array.isArray(data.orderOrOrdersData)) {
            const createdOrders = [];
            const company = await db_1.prisma.company.findUnique({
                where: {
                    id: data.loggedInUser.id,
                },
                select: {
                    id: true,
                    targetCompanyId: true,
                    governoratesDeliveryCosts: true,
                },
            });
            for (const order of data.orderOrOrdersData) {
                let locationID = order.locationID;
                let clientId = 0;
                let deliveryCost = 0;
                let storeId = 0;
                const checkClient = await db_1.prisma.client.findFirst({
                    where: {
                        companyId: data.loggedInUser.id,
                        user: {
                            name: order.clientName,
                            phone: order.clientPhone,
                        },
                    },
                });
                if (!checkClient) {
                    const createdUser = await db_1.prisma.user.create({
                        data: {
                            name: order.clientName,
                            username: order.clientPhone + order.receiptNumber,
                            password: "00000000000",
                            phone: order.clientPhone,
                            fcm: "",
                            avatar: "",
                        },
                        select: {
                            id: true,
                        },
                    });
                    const client = await db_1.prisma.client.create({
                        data: {
                            user: {
                                connect: {
                                    id: createdUser.id,
                                },
                            },
                            company: {
                                connect: {
                                    id: data.loggedInUser.id,
                                },
                            },
                            role: "CLIENT",
                            token: "",
                            showNumbers: false,
                            showDeliveryNumber: false,
                            isExternal: true,
                            governoratesDeliveryCosts: [],
                        },
                    });
                    clientId = client.id;
                }
                else {
                    clientId = checkClient.id;
                }
                const checkStore = await db_1.prisma.store.findFirst({
                    where: {
                        name: order.storeName,
                        clientId: clientId,
                    },
                });
                if (!checkStore) {
                    const createStore = await db_1.prisma.store.create({
                        data: {
                            name: order.storeName,
                            clientId: clientId,
                            companyId: data.loggedInUser.id,
                        },
                    });
                    storeId = createStore.id;
                }
                else {
                    storeId = checkStore.id;
                }
                let branchID = undefined;
                if (!locationID) {
                    const locations = await db_1.prisma.location.findMany({
                        where: {
                            governorate: order.governorate,
                            companyId: company?.targetCompanyId,
                        },
                    });
                    locationID =
                        locations.find((l) => l.name === locations_repository_1.governorateArabicNames[order.governorate])?.id ?? locations[0].id;
                }
                const branch = await branchesRepository.getBranchByLocation({
                    locationID: locationID,
                });
                if (!branch) {
                    throw new AppError_1.AppError("لا يوجد فرع مرتبط بالموقع", 500);
                }
                branchID = branch.id;
                const governoratesDeliveryCosts = company?.governoratesDeliveryCosts;
                if (governoratesDeliveryCosts) {
                    deliveryCost =
                        governoratesDeliveryCosts.find((governorateDeliveryCost) => {
                            return (governorateDeliveryCost.governorate === order.governorate);
                        })?.cost || 0;
                }
                const createdOrder = await ordersRepository.createOrder({
                    clientID: clientId,
                    branchID: branchID,
                    deliveryCost,
                    storeID: storeId,
                    loggedInUser: data.loggedInUser,
                    orderData: { ...order },
                });
                if (!createdOrder) {
                    throw new AppError_1.AppError("Failed to create order", 500);
                }
                createdOrders.push(createdOrder);
            }
            return createdOrders;
        }
        return {};
    };
    createOrderV2 = async (data) => {
        const acceptedShipments = [];
        const rejectedShipments = [];
        const company = await db_1.prisma.company.findUnique({
            where: {
                id: data.loggedInUser.id,
            },
            select: {
                id: true,
                targetCompanyId: true,
                governoratesDeliveryCosts: true,
            },
        });
        for (const order of data.orderOrOrdersData) {
            try {
                let clientId = 0;
                let deliveryCost = 0;
                let storeId = 0;
                const checkClient = await db_1.prisma.client.findFirst({
                    where: {
                        companyId: data.loggedInUser.id,
                        user: {
                            name: order.sender_name || "",
                            phone: order.sender_phone,
                        },
                    },
                });
                if (!checkClient) {
                    const createdUser = await db_1.prisma.user.create({
                        data: {
                            name: order.sender_name || "",
                            username: order.sender_phone,
                            password: "00000000000",
                            phone: order.sender_phone,
                            fcm: "",
                            avatar: "",
                        },
                        select: {
                            id: true,
                        },
                    });
                    const client = await db_1.prisma.client.create({
                        data: {
                            user: {
                                connect: {
                                    id: createdUser.id,
                                },
                            },
                            company: {
                                connect: {
                                    id: data.loggedInUser.id,
                                },
                            },
                            role: "CLIENT",
                            token: "",
                            showNumbers: false,
                            showDeliveryNumber: false,
                            isExternal: true,
                            governoratesDeliveryCosts: [],
                        },
                    });
                    clientId = client.id;
                }
                else {
                    clientId = checkClient.id;
                }
                const checkStore = await db_1.prisma.store.findFirst({
                    where: {
                        name: order.sender_name || "",
                        clientId: clientId,
                    },
                });
                if (!checkStore) {
                    const createStore = await db_1.prisma.store.create({
                        data: {
                            name: order.sender_name || "",
                            clientId: clientId,
                            companyId: data.loggedInUser.id,
                        },
                    });
                    storeId = createStore.id;
                }
                else {
                    storeId = checkStore.id;
                }
                const governoratesDeliveryCosts = company?.governoratesDeliveryCosts;
                const governorate = (0, governerates_1.fromExternalCode)(order.governorate_code);
                if (!governorate) {
                    throw new AppError_1.AppError(`كود المحافظة غير صالح: ${order.governorate_code}`, 400);
                }
                const target = this.normalizeArabic(order.city_name);
                const locations = await db_1.prisma.location.findMany({
                    where: { governorate, companyId: data.loggedInUser.companyID },
                });
                let match = locations.find((l) => this.normalizeArabic(l.name) === target);
                if (!match) {
                    match = locations[0];
                }
                let branchID = undefined;
                const branch = await branchesRepository.getBranchByLocation({
                    locationID: match?.id,
                });
                if (!branch) {
                    throw new AppError_1.AppError("لا يوجد فرع مرتبط بالموقع", 500);
                }
                branchID = branch.id;
                if (governoratesDeliveryCosts) {
                    deliveryCost =
                        governoratesDeliveryCosts.find((governorateDeliveryCost) => {
                            return governorateDeliveryCost.governorate === governorate;
                        })?.cost || 0;
                }
                const createdOrder = await ordersRepository.createOrderv2({
                    clientID: clientId,
                    branchID: branchID,
                    deliveryCost,
                    storeID: storeId,
                    loggedInUser: data.loggedInUser,
                    orderData: { ...order },
                    locationID: 2,
                });
                acceptedShipments.push({
                    shipment_number: order.shipment_number,
                    shipment_id: order.shipment_id,
                    external_id: createdOrder.id.toString(),
                    airway_bill_number: order.airway_bill_number || null,
                });
            }
            catch (error) {
                rejectedShipments.push({
                    shipment_number: order.shipment_number,
                    shipment_id: order.shipment_id || null,
                    airway_bill_number: order.airway_bill_number || null,
                    reason: error?.message ?? "Processing error",
                    error_code: error instanceof AppError_1.AppError ? "PROCESSING_ERROR" : "PROCESSING_ERROR",
                    field: null,
                });
            }
        }
        return { acceptedShipments, rejectedShipments };
    };
    getAllOrders = async (data) => {
        let governorate = data.filters.governorate;
        let size = data.filters.size || 200;
        const { orders, pagesCount, count } = await ordersRepository.getAllOrdersPaginatedApiKey({
            filters: {
                ...data.filters,
                governorate,
                size,
            },
            loggedInUser: data.loggedInUser,
        });
        return {
            count,
            page: data.filters.page,
            pagesCount: pagesCount,
            orders: orders,
        };
    };
    getAllReports = async (data) => {
        let size = data.filters.size || 200;
        const { reports, pagesCount, count } = await ordersRepository.getAllReportsPaginatedApiKey({
            filters: {
                ...data.filters,
                size,
            },
            loggedInUser: data.loggedInUser,
        });
        return {
            count,
            page: data.filters.page,
            pagesCount: pagesCount,
            reports: reports,
        };
    };
    getOrderByIdApiKey = async (data) => {
        const order = await ordersRepository.getOrderByIdApiKey({
            orderID: data.params.orderID,
            forwardedFrom: data.params.forwardedFrom,
        });
        return order;
    };
    updateOrderForClient = async (data) => {
        let oldOrderData = await ordersRepository.getOrderByIdApiKey({
            orderID: data.params.orderID,
            forwardedFrom: data.loggedInUser.id,
        });
        if (!oldOrderData) {
            throw new AppError_1.AppError("الطلب غير موجود", 404);
        }
        if (oldOrderData.secondaryStatus !== "SEND_TO_COMPANY") {
            throw new AppError_1.AppError("لا يمكنك مسح الطلب بعد تأكيده", 404);
        }
        const newOrder = await ordersRepository.updateOrder({
            orderID: oldOrderData.id,
            loggedInUser: data.loggedInUser,
            orderData: data.orderData,
        });
        if (!newOrder) {
            throw new AppError_1.AppError("فشل تحديث الطلب", 500);
        }
        return newOrder;
    };
    deleteOrder = async (data) => {
        const order = await db_1.prisma.order.findUnique({
            where: {
                id: data.params.orderID,
                forwardedFromId: data.params.loggedInUser.id,
            },
            select: {
                secondaryStatus: true,
                status: true,
            },
        });
        if (!order) {
            throw new AppError_1.AppError("الطلب غير موجود", 404);
        }
        if (order.secondaryStatus !== "SEND_TO_COMPANY") {
            throw new AppError_1.AppError("لا يمكنك مسح الطلب بعد تأكيده", 404);
        }
        await ordersRepository.deleteOrder({
            orderID: data.params.orderID,
        });
    };
}
exports.OrdersService = OrdersService;
//# sourceMappingURL=orders.service.js.map