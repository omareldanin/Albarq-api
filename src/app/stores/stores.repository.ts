import type {Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import type {StoreCreateType, StoreUpdateType} from "./stores.dto";
import {storeSelect, storeSelectReform} from "./stores.responses";
import {redis} from "../../lib/redis";

export class StoresRepository {
  clientStoresCacheKey(filters: {
    page?: number;
    size?: number;
    deleted?: string;
    clientID?: number;
    clientAssistantID?: number;
    companyID?: number;
    minified?: boolean;
    branchID?: number;
    name?: string;
    inquiryStoresIDs?: number[];
  }) {
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

  async createStore(companyID: number, data: StoreCreateType) {
    const createdStore = await prisma.store.create({
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
      select: storeSelect,
    });
    const keys = await redis.keys("client-stores:*");
    if (keys.length) {
      await redis.del(keys);
    }

    return storeSelectReform(createdStore);
  }

  async getAllStoresPaginated(filters: {
    page: number;
    size: number;
    deleted?: string;
    clientID?: number;
    clientAssistantID?: number;
    companyID?: number;
    minified?: boolean;
    branchID?: number;
    name?: string;
    inquiryStoresIDs?: number[];
  }) {
    const cacheKey = this.clientStoresCacheKey(filters);

    // 1️⃣ Try Redis first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as {
        stores: any[];
        pagesCount: number;
      };
    }

    const where = {
      AND: [
        {
          id: filters.inquiryStoresIDs
            ? {in: filters.inquiryStoresIDs}
            : undefined,
        },
        {deleted: filters.deleted === "true"},
        {companyId: filters.companyID},
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
            ? {id: filters.clientAssistantID}
            : undefined,
        },
        {
          client: filters.branchID
            ? {branch: {id: filters.branchID}}
            : undefined,
        },
      ],
    } as Prisma.StoreWhereInput;

    if (filters.minified === true) {
      const paginatedStores = await prisma.store.findManyPaginated(
        {
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
        },
        {
          page: 1,
          size: 10000,
        },
      );
      return {
        stores: paginatedStores.data,
        pagesCount: paginatedStores.pagesCount,
      };
    }

    const paginatedStores = await prisma.store.findManyPaginated(
      {
        where: where,
        orderBy: {
          id: "desc",
        },
        select: storeSelect,
      },
      {
        page: filters.page,
        size: filters.size,
        withCount: true,
      },
    );

    const result = {
      stores: paginatedStores.data.map(storeSelectReform),
      pagesCount: paginatedStores.pagesCount,
    };

    await redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24 * 2);

    return result;
  }

  async getAllClientStoresPaginated(filters: {
    deleted?: string;
    clientID?: number;
    companyID?: number;
    name?: string;
  }) {
    const cacheKey = this.clientStoresCacheKey(filters);

    // 1️⃣ Try Redis first
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as {
        stores: any[];
      };
    }

    const where = {
      AND: [
        {deleted: filters.deleted === "true"},
        {companyId: filters.companyID},
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
    } as Prisma.StoreWhereInput;

    const paginatedStores = await prisma.store.findManyPaginated(
      {
        where,
        select: {
          id: true,
          name: true,
        },
      },
      {
        page: 1,
        size: 10000,
      },
    );

    const result = {
      stores: paginatedStores.data,
      pagesCount: paginatedStores.pagesCount,
    };

    // 4️⃣ Save to Redis (TTL = 10 minutes)
    await redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24 * 2);

    return result;
  }

  async getStore(data: {storeID: number}) {
    const store = await prisma.store.findUnique({
      where: {
        id: data.storeID,
      },
      select: storeSelect,
    });
    return storeSelectReform(store);
  }

  async getStoreByClientAssistantId(clientAssistantId: number) {
    const store = await prisma.store.findFirst({
      where: {
        clientAssistantId: clientAssistantId,
      },
      select: storeSelect,
    });
    return storeSelectReform(store);
  }

  async updateStore(data: {storeID: number; storeData: StoreUpdateType}) {
    const keys = await redis.keys("client-stores:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const store = await prisma.store.update({
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
      select: storeSelect,
    });
    return storeSelectReform(store);
  }

  async deleteStore(data: {storeID: number}) {
    const keys = await redis.keys("client-stores:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const deletedStore = await prisma.store.delete({
      where: {
        id: data.storeID,
      },
    });
    return deletedStore;
  }

  async deactivateStore(data: {storeID: number; deletedByID: number}) {
    const keys = await redis.keys("client-stores:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const deletedStore = await prisma.store.update({
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

  async reactivateStore(data: {storeID: number}) {
    const keys = await redis.keys("client-stores:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const deletedStore = await prisma.store.update({
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
