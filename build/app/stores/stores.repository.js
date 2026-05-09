"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoresRepository = void 0;
const db_1 = require("../../database/db");
const stores_responses_1 = require("./stores.responses");
const redis_1 = require("../../lib/redis");
class StoresRepository {
    clientStoresCacheKey(filters) {
        return `client-stores:${JSON.stringify({
            deleted: filters.deleted ?? null,
            clientID: filters.clientID ?? null,
            companyID: filters.companyID ?? null,
            name: filters.name ?? null,
            size: filters.size ?? null,
            page: filters.page ?? null,
            minified: filters.minified ?? null,
            branchID: filters.branchID ?? null,
            clientAssistantID: filters.clientAssistantID ?? null,
            inquiryStoresIDs: filters.inquiryStoresIDs ?? null,
        })}`;
    }
    async createStore(companyID, data) {
        const createdStore = await db_1.prisma.store.create({
            data: {
                name: data.name,
                notes: data.notes,
                logo: data.logo,
                company: {
                    connect: {
                        id: companyID,
                    },
                },
                client: {
                    connect: {
                        id: data.clientID,
                    },
                },
                clientAssistant: data.clientAssistantID
                    ? {
                        connect: {
                            id: data.clientAssistantID,
                        },
                    }
                    : undefined,
            },
            select: stores_responses_1.storeSelect,
        });
        const keys = await redis_1.redis.keys("client-stores:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        return (0, stores_responses_1.storeSelectReform)(createdStore);
    }
    async getAllStoresPaginated(filters) {
        const cacheKey = this.clientStoresCacheKey(filters);
        // 1️⃣ Try Redis first
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const where = {
            AND: [
                {
                    id: filters.inquiryStoresIDs
                        ? { in: filters.inquiryStoresIDs }
                        : undefined,
                },
                { deleted: filters.deleted === "true" },
                { companyId: filters.companyID },
                {
                    clientId: filters.clientID ? filters.clientID : undefined,
                },
                {
                    name: filters.name
                        ? {
                            contains: filters.name,
                            mode: "insensitive",
                        }
                        : undefined,
                },
                {
                    clientAssistant: filters.clientAssistantID
                        ? { id: filters.clientAssistantID }
                        : undefined,
                },
                {
                    client: filters.branchID
                        ? { branch: { id: filters.branchID } }
                        : undefined,
                },
            ],
        };
        if (filters.minified === true) {
            const paginatedStores = await db_1.prisma.store.findManyPaginated({
                where: where,
                select: {
                    id: true,
                    name: true,
                    clientId: true,
                    client: {
                        select: {
                            branchId: true,
                        },
                    },
                },
            }, {
                page: 1,
                size: 10000,
            });
            return {
                stores: paginatedStores.data,
                pagesCount: paginatedStores.pagesCount,
            };
        }
        const paginatedStores = await db_1.prisma.store.findManyPaginated({
            where: where,
            orderBy: {
                id: "desc",
            },
            select: stores_responses_1.storeSelect,
        }, {
            page: filters.page,
            size: filters.size,
            withCount: true,
        });
        const result = {
            stores: paginatedStores.data.map(stores_responses_1.storeSelectReform),
            pagesCount: paginatedStores.pagesCount,
        };
        await redis_1.redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24 * 2);
        return result;
    }
    async getAllClientStoresPaginated(filters) {
        const cacheKey = this.clientStoresCacheKey(filters);
        // 1️⃣ Try Redis first
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        const where = {
            AND: [
                { deleted: filters.deleted === "true" },
                { companyId: filters.companyID },
                {
                    clientId: filters.clientID ? filters.clientID : undefined,
                },
                {
                    name: filters.name
                        ? {
                            contains: filters.name,
                            mode: "insensitive",
                        }
                        : undefined,
                },
            ],
        };
        const paginatedStores = await db_1.prisma.store.findManyPaginated({
            where,
            select: {
                id: true,
                name: true,
            },
        }, {
            page: 1,
            size: 10000,
        });
        const result = {
            stores: paginatedStores.data,
            pagesCount: paginatedStores.pagesCount,
        };
        // 4️⃣ Save to Redis (TTL = 10 minutes)
        await redis_1.redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24 * 2);
        return result;
    }
    async getStore(data) {
        const store = await db_1.prisma.store.findUnique({
            where: {
                id: data.storeID,
            },
            select: stores_responses_1.storeSelect,
        });
        return (0, stores_responses_1.storeSelectReform)(store);
    }
    async getStoreByClientAssistantId(clientAssistantId) {
        const store = await db_1.prisma.store.findFirst({
            where: {
                clientAssistantId: clientAssistantId,
            },
            select: stores_responses_1.storeSelect,
        });
        return (0, stores_responses_1.storeSelectReform)(store);
    }
    async updateStore(data) {
        const keys = await redis_1.redis.keys("client-stores:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const store = await db_1.prisma.store.update({
            where: {
                id: data.storeID,
            },
            data: {
                name: data.storeData.name,
                logo: data.storeData.logo,
                notes: data.storeData.notes,
                client: data.storeData.clientID
                    ? {
                        connect: {
                            id: data.storeData.clientID,
                        },
                    }
                    : undefined,
                clientAssistant: data.storeData.clientAssistantID
                    ? {
                        connect: {
                            id: data.storeData.clientAssistantID,
                        },
                    }
                    : undefined,
            },
            select: stores_responses_1.storeSelect,
        });
        return (0, stores_responses_1.storeSelectReform)(store);
    }
    async deleteStore(data) {
        const keys = await redis_1.redis.keys("client-stores:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const deletedStore = await db_1.prisma.store.delete({
            where: {
                id: data.storeID,
            },
        });
        return deletedStore;
    }
    async deactivateStore(data) {
        const keys = await redis_1.redis.keys("client-stores:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const deletedStore = await db_1.prisma.store.update({
            where: {
                id: data.storeID,
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
        return deletedStore;
    }
    async reactivateStore(data) {
        const keys = await redis_1.redis.keys("client-stores:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const deletedStore = await db_1.prisma.store.update({
            where: {
                id: data.storeID,
            },
            data: {
                deleted: false,
            },
        });
        return deletedStore;
    }
}
exports.StoresRepository = StoresRepository;
//# sourceMappingURL=stores.repository.js.map