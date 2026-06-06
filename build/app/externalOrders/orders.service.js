"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const orders_repository_1 = require("./orders.repository");
const branches_repository_1 = require("../branches/branches.repository");
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const ordersRepository = new orders_repository_1.OrdersRepository();
const branchesRepository = new branches_repository_1.BranchesRepository();
class OrdersService {
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
                            username: order.clientPhone,
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
                const branch = await branchesRepository.getBranchByLocation({
                    locationID: order.locationID,
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
    getOrderByIdApiKey = async (data) => {
        const order = await ordersRepository.getOrderByIdApiKey({
            orderID: data.params.orderID,
            forwardedFrom: data.params.forwardedFrom,
        });
        return order;
    };
}
exports.OrdersService = OrdersService;
//# sourceMappingURL=orders.service.js.map