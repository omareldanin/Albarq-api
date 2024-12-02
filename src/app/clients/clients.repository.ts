import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/db";
import type { ClientCreateTypeWithUserID, ClientUpdateType } from "./clients.dto";
import { clientReform, clientSelect } from "./clients.responses";

export class ClientsRepository {
    async createClient(companyID: number, data: ClientCreateTypeWithUserID) {
        const createdUser = await prisma.user.create({
            data: {
                name: data.name,
                username: data.username,
                password: data.password,
                phone: data.phone,
                fcm: data.fcm,
                avatar: data.avatar
            },
            select: {
                id: true
            }
        });

        const createdClient = await prisma.client.create({
            data: {
                // id: createdUser.id,
                user: {
                    connect: {
                        id: createdUser.id
                    }
                },
                company: {
                    connect: {
                        id: companyID
                    }
                },
                role: data.role,
                token: data.token,
                branch: data.branchID
                    ? {
                          connect: {
                              id: data.branchID
                          }
                      }
                    : undefined,
                repository: data.repositoryID
                    ? {
                          connect: {
                              id: data.repositoryID
                          }
                      }
                    : undefined,
                createdBy: {
                    connect: {
                        id: data.userID
                    }
                },
                governoratesDeliveryCosts: data.governoratesDeliveryCosts
            },
            select: clientSelect
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
    }) {
        const where = {
            AND: [
                { deleted: filters.deleted === "true" },
                { company: { id: filters.companyID } },
                { branch: filters.branchID ? { id: filters.branchID } : undefined },
                { user: { phone: filters.phone } },
                { user: { name: { contains: filters.name } } },
                // TODO
                { stores: filters.storeID ? { some: { id: filters.storeID } } : undefined }
            ]
        } as Prisma.ClientWhereInput;

        if (filters.minified === true) {
            const paginatedClients = await prisma.client.findManyPaginated(
                {
                    where: where,
                    select: {
                        id: true,
                        user: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                {
                    page: filters.page,
                    size: filters.size
                }
            );
            return {
                clients: paginatedClients.data.map((client) => {
                    return {
                        id: client.id,
                        name: client.user.name
                    };
                }),
                pagesCount: paginatedClients.pagesCount
            };
        }

        const paginatedClients = await prisma.client.findManyPaginated(
            {
                orderBy: {
                    id: "desc"
                },
                where: where,
                select: clientSelect
            },
            {
                page: filters.page,
                size: filters.size
            }
        );

        return {
            clients: paginatedClients.data.map(clientReform),
            pagesCount: paginatedClients.pagesCount
        };
    }

    async getClient(data: { clientID: number }) {
        const client = await prisma.client.findUnique({
            where: {
                id: data.clientID
            },
            select: clientSelect
        });
        return clientReform(client);
    }

    async updateClient(data: {
        clientID: number;
        // companyID: number;
        clientData: ClientUpdateType;
    }) {
        const client = await prisma.client.update({
            where: {
                id: data.clientID
            },
            data: {
                user: {
                    update: {
                        name: data.clientData.name,
                        username: data.clientData.username,
                        password: data.clientData.password,
                        // phone: data.clientData.phone,
                        fcm: data.clientData.fcm,
                        avatar: data.clientData.avatar
                    }
                },
                // company: data.clientData.companyID
                //     ? {
                //           connect: {
                //               id: data.clientData.companyID
                //           }
                //       }
                //     : undefined,
                role: data.clientData.role,
                token: data.clientData.token,
                branch: data.clientData.branchID
                    ? {
                          connect: {
                              id: data.clientData.branchID
                          }
                      }
                    : undefined,
                repository: data.clientData.repositoryID
                    ? {
                          connect: {
                              id: data.clientData.repositoryID
                          }
                      }
                    : undefined,
                governoratesDeliveryCosts: data.clientData.governoratesDeliveryCosts
            },
            select: clientSelect
        });
        return clientReform(client);
    }

    async deleteClient(data: { clientID: number }) {
        await prisma.$transaction([
            prisma.client.delete({
                where: {
                    id: data.clientID
                }
            }),
            prisma.user.delete({
                where: {
                    id: data.clientID
                }
            })
        ]);
        return true;
    }

    async deactivateClient(data: { clientID: number; deletedByID: number }) {
        const deletedClient = await prisma.client.update({
            where: {
                id: data.clientID
            },
            data: {
                deleted: true,
                deletedAt: new Date(),
                deletedBy: {
                    connect: {
                        id: data.deletedByID
                    }
                }
            }
        });
        return deletedClient;
    }

    async reactivateClient(data: { clientID: number }) {
        const deletedClient = await prisma.client.update({
            where: {
                id: data.clientID
            },
            data: {
                deleted: false
            }
        });
        return deletedClient;
    }

    async getClientIDByStoreID(data: { storeID: number }) {
        const store = await prisma.store.findUnique({
            where: {
                id: data.storeID
            },
            select: {
                clientId: true
            }
        });
        return store?.clientId;
    }
}
