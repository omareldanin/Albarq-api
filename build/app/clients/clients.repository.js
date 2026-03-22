"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientsRepository = void 0;
const db_1 = require("../../database/db");
const clients_responses_1 = require("./clients.responses");
const redis_1 = require("../../lib/redis");
class ClientsRepository {
    clientsCacheKey(filters) {
        return `clients:${JSON.stringify({
            page: filters.page,
            size: filters.size,
            deleted: filters.deleted ?? null,
            companyID: filters.companyID ?? null,
            storeID: filters.storeID ?? null,
            branchID: filters.branchID ?? null,
            governorate: filters.governorate ?? null,
            phone: filters.phone ?? null,
            name: filters.name ?? null,
            minified: filters.minified ?? false,
            role: filters.loggedInUser?.role ?? null,
            userID: filters.loggedInUser?.id ?? null, // VERY IMPORTANT
        })}`;
    }
    async createClient(companyID, data) {
        const keys = await redis_1.redis.keys("clients:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const createdUser = await db_1.prisma.user.create({
            data: {
                name: data.name,
                username: data.username,
                password: data.password,
                phone: data.phone,
                fcm: data.fcm,
                avatar: data.avatar,
            },
            select: {
                id: true,
            },
        });
        const createdClient = await db_1.prisma.client.create({
            data: {
                // id: createdUser.id,
                user: {
                    connect: {
                        id: createdUser.id,
                    },
                },
                company: {
                    connect: {
                        id: companyID,
                    },
                },
                role: data.role,
                token: data.token,
                showNumbers: data.showNumbers,
                showDeliveryNumber: data.showDeliveryNumber,
                isExternal: data.isExternal,
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
                createdBy: {
                    connect: {
                        id: data.userID,
                    },
                },
                governoratesDeliveryCosts: data.governoratesDeliveryCosts,
            },
            select: clients_responses_1.clientSelect,
        });
        return (0, clients_responses_1.clientReform)(createdClient);
    }
    async getAllClientsPaginated(filters) {
        const cacheKey = this.clientsCacheKey(filters);
        // 1️⃣ FAST PATH – Redis
        // const cached = await redis.get(cacheKey);
        // if (cached) {
        //   return JSON.parse(cached) as {
        //     clients: any[];
        //     pagesCount: number;
        //   };
        // }
        let clientIDs = [];
        if (filters.loggedInUser?.role === "CLIENT_ASSISTANT") {
            const stores = await db_1.prisma.employee.findMany({
                where: { id: filters.loggedInUser.id },
                select: {
                    managedStores: {
                        select: { clientId: true },
                    },
                },
            });
            stores.forEach((store) => {
                store.managedStores.forEach((e) => {
                    clientIDs.push(e.clientId);
                });
            });
        }
        const where = {
            AND: [
                { deleted: filters.deleted === "true" },
                { company: { id: filters.companyID } },
                {
                    OR: [
                        { branch: filters.branchID ? { id: filters.branchID } : undefined },
                        {
                            branch: {
                                parentBranchId: filters.branchID,
                            },
                        },
                    ],
                },
                { user: { phone: filters.phone } },
                { user: { name: { contains: filters.name } } },
                {
                    stores: filters.storeID ? { some: { id: filters.storeID } } : undefined,
                },
                {
                    AND: filters.loggedInUser?.role === "CLIENT"
                        ? { id: filters.loggedInUser.id }
                        : undefined,
                },
                {
                    AND: filters.loggedInUser?.role === "CLIENT_ASSISTANT"
                        ? { id: { in: clientIDs } }
                        : undefined,
                },
            ],
        };
        let result;
        if (filters.minified === true) {
            const paginatedClients = await db_1.prisma.client.findManyPaginated({
                where,
                select: {
                    id: true,
                    user: {
                        select: { name: true },
                    },
                },
            }, {
                page: 1,
                size: 10000,
            });
            result = {
                clients: paginatedClients.data.map((c) => ({
                    id: c.id,
                    name: c.user.name,
                })),
                pagesCount: paginatedClients.pagesCount,
            };
        }
        else {
            const paginatedClients = await db_1.prisma.client.findManyPaginated({
                orderBy: { id: "desc" },
                where,
                select: clients_responses_1.clientSelect,
            }, {
                page: filters.page,
                size: filters.size,
            });
            result = {
                clients: paginatedClients.data.map(clients_responses_1.clientReform),
                pagesCount: paginatedClients.pagesCount,
            };
        }
        // 3️⃣ Save to Redis (TTL = 10 minutes)
        await redis_1.redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24);
        return result;
    }
    async getClient(data) {
        const client = await db_1.prisma.client.findUnique({
            where: {
                id: data.clientID,
            },
            select: clients_responses_1.clientSelect,
        });
        return (0, clients_responses_1.clientReform)(client);
    }
    async updateClient(data) {
        const keys = await redis_1.redis.keys("clients:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const client = await db_1.prisma.client.update({
            where: {
                id: data.clientID,
            },
            data: {
                user: {
                    update: {
                        name: data.clientData.name,
                        username: data.clientData.username,
                        password: data.clientData.password,
                        phone: data.clientData.phone,
                        fcm: data.clientData.fcm,
                        avatar: data.clientData.avatar,
                    },
                },
                role: data.clientData.role,
                token: data.clientData.token,
                showNumbers: data.clientData.showNumbers,
                isExternal: data.clientData.isExternal,
                showDeliveryNumber: data.clientData.showDeliveryNumber,
                branch: data.clientData.branchID
                    ? {
                        connect: {
                            id: data.clientData.branchID,
                        },
                    }
                    : undefined,
                repository: data.clientData.repositoryID
                    ? {
                        connect: {
                            id: data.clientData.repositoryID,
                        },
                    }
                    : undefined,
                governoratesDeliveryCosts: data.clientData.governoratesDeliveryCosts,
            },
            select: clients_responses_1.clientSelect,
        });
        return (0, clients_responses_1.clientReform)(client);
    }
    async deleteClient(data) {
        const keys = await redis_1.redis.keys("clients:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        await db_1.prisma.$transaction([
            db_1.prisma.client.delete({
                where: {
                    id: data.clientID,
                },
            }),
            db_1.prisma.user.delete({
                where: {
                    id: data.clientID,
                },
            }),
        ]);
        return true;
    }
    async deactivateClient(data) {
        const keys = await redis_1.redis.keys("clients:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const deletedClient = await db_1.prisma.client.update({
            where: {
                id: data.clientID,
            },
            data: {
                deleted: true,
                deletedAt: new Date(),
                deletedBy: {
                    connect: {
                        id: data.deletedByID,
                    },
                },
            },
        });
        return deletedClient;
    }
    async reactivateClient(data) {
        const keys = await redis_1.redis.keys("clients:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const deletedClient = await db_1.prisma.client.update({
            where: {
                id: data.clientID,
            },
            data: {
                deleted: false,
            },
        });
        return deletedClient;
    }
    async getClientIDByStoreID(data) {
        const store = await db_1.prisma.store.findUnique({
            where: {
                id: data.storeID,
            },
            select: {
                clientId: true,
            },
        });
        return store?.clientId;
    }
}
exports.ClientsRepository = ClientsRepository;
//# sourceMappingURL=clients.repository.js.map