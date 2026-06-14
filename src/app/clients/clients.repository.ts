import {Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import type {ClientCreateTypeWithUserID, ClientUpdateType} from "./clients.dto";
import {clientReform, clientSelect} from "./clients.responses";
import {loggedInUserType} from "../../types/user";
import {redis} from "../../lib/redis";

export class ClientsRepository {
  clientsCacheKey(filters: {
    page: number;
    size: number;
    deleted?: string;
    companyID?: number;
    minified?: boolean;
    storeID?: number;
    branchID?: number;
    governorate?: string;
    phone?: string;
    name?: string;
    loggedInUser?: loggedInUserType;
  }) {
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

  async createClient(companyID: number, data: ClientCreateTypeWithUserID) {
    const keys = await redis.keys("clients:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const createdUser = await prisma.user.create({
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

    const createdClient = await prisma.client.create({
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
        deliveryAgentProfit: data.deliveryAgentProfit,
        mainBranchProfit: data.mainBranchProfit,
        forwardedBranchProfit: data.forwardedBranchProfit,
        receivingBranchProfit: data.receivingBranchProfit,
        activeProfit: data.activeProfit,
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
      select: clientSelect,
    });
    return clientReform(createdClient);
  }

  async getAllClientsPaginated(filters: {
    page: number;
    size: number;
    deleted?: string;
    companyID?: number;
    minified?: boolean;
    storeID?: number;
    branchID?: number;
    governorate?: string;
    phone?: string;
    name?: string;
    loggedInUser?: loggedInUserType;
  }) {
    const cacheKey = this.clientsCacheKey(filters);

    // 1️⃣ FAST PATH – Redis
    // const cached = await redis.get(cacheKey);
    // if (cached) {
    //   return JSON.parse(cached) as {
    //     clients: any[];
    //     pagesCount: number;
    //   };
    // }

    let clientIDs: number[] = [];

    if (filters.loggedInUser?.role === "CLIENT_ASSISTANT") {
      const stores = await prisma.employee.findMany({
        where: {id: filters.loggedInUser.id},
        select: {
          managedStores: {
            select: {clientId: true},
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
        {deleted: filters.deleted === "true"},
        {company: {id: filters.companyID}},
        {
          OR: [
            {branch: filters.branchID ? {id: filters.branchID} : undefined},
            {
              branch: {
                parentBranchId: filters.branchID,
              },
            },
          ],
        },
        {user: {phone: filters.phone}},
        {user: {name: {contains: filters.name}}},
        {
          stores: filters.storeID ? {some: {id: filters.storeID}} : undefined,
        },
        {
          AND:
            filters.loggedInUser?.role === "CLIENT"
              ? {id: filters.loggedInUser.id}
              : undefined,
        },
        {
          AND:
            filters.loggedInUser?.role === "CLIENT_ASSISTANT"
              ? {id: {in: clientIDs}}
              : undefined,
        },
      ],
    } as Prisma.ClientWhereInput;

    let result;

    if (filters.minified === true) {
      const paginatedClients = await prisma.client.findManyPaginated(
        {
          where,
          select: {
            id: true,
            user: {
              select: {name: true},
            },
          },
        },
        {
          page: 1,
          size: 10000,
        },
      );

      result = {
        clients: paginatedClients.data.map((c) => ({
          id: c.id,
          name: c.user.name,
        })),
        pagesCount: paginatedClients.pagesCount,
      };
    } else {
      const paginatedClients = await prisma.client.findManyPaginated(
        {
          orderBy: {id: "desc"},
          where,
          select: clientSelect,
        },
        {
          page: filters.page,
          size: filters.size,
        },
      );

      result = {
        clients: paginatedClients.data.map(clientReform),
        pagesCount: paginatedClients.pagesCount,
      };
    }

    // 3️⃣ Save to Redis (TTL = 10 minutes)
    await redis.set(cacheKey, JSON.stringify(result), "EX", 60 * 60 * 24);

    return result;
  }

  async getClient(data: {clientID: number}) {
    const client = await prisma.client.findUnique({
      where: {
        id: data.clientID,
      },
      select: clientSelect,
    });
    return clientReform(client);
  }

  async updateClient(data: {
    clientID: number;
    // companyID: number;
    clientData: ClientUpdateType;
  }) {
    const keys = await redis.keys("clients:*");
    if (keys.length) {
      await redis.del(keys);
    }
    const client = await prisma.client.update({
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
        deliveryAgentProfit: data.clientData.deliveryAgentProfit,
        mainBranchProfit: data.clientData.mainBranchProfit,
        forwardedBranchProfit: data.clientData.forwardedBranchProfit,
        receivingBranchProfit: data.clientData.receivingBranchProfit,
        activeProfit: data.clientData.activeProfit,
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
      select: clientSelect,
    });
    return clientReform(client);
  }

  async deleteClient(data: {clientID: number}) {
    const keys = await redis.keys("clients:*");
    if (keys.length) {
      await redis.del(keys);
    }
    await prisma.$transaction([
      prisma.client.delete({
        where: {
          id: data.clientID,
        },
      }),
      prisma.user.delete({
        where: {
          id: data.clientID,
        },
      }),
    ]);
    return true;
  }

  async deactivateClient(data: {clientID: number; deletedByID: number}) {
    const keys = await redis.keys("clients:*");
    if (keys.length) {
      await redis.del(keys);
    }
    const deletedClient = await prisma.client.update({
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

  async reactivateClient(data: {clientID: number}) {
    const keys = await redis.keys("clients:*");
    if (keys.length) {
      await redis.del(keys);
    }
    const deletedClient = await prisma.client.update({
      where: {
        id: data.clientID,
      },
      data: {
        deleted: false,
      },
    });
    return deletedClient;
  }

  async getClientIDByStoreID(data: {storeID: number}) {
    const store = await prisma.store.findUnique({
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
