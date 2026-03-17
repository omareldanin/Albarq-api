"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoriesRepository = void 0;
const db_1 = require("../../database/db");
const repositories_responses_1 = require("./repositories.responses");
class RepositoriesRepository {
    async createRepository(companyID, data) {
        const createdRepository = await db_1.prisma.repository.create({
            data: {
                name: data.name,
                mainRepository: data.mainRepository ? true : false,
                type: data.type,
                branch: {
                    connect: {
                        id: data.branchID,
                    },
                },
                company: {
                    connect: {
                        id: companyID,
                    },
                },
            },
            select: repositories_responses_1.repositorySelect,
        });
        return createdRepository;
    }
    async getAllRepositoriesPaginated(filters) {
        const where = {
            OR: [
                {
                    AND: [
                        {
                            company: {
                                id: filters.companyID,
                            },
                        },
                        {
                            OR: [
                                {
                                    branch: filters.inquiryBranchesIDs?.length
                                        ? {
                                            id: { in: filters.inquiryBranchesIDs },
                                        }
                                        : filters.branchID && !filters.getChildBranchs
                                            ? { id: filters.branchID }
                                            : undefined,
                                },
                                {
                                    branch: filters.branchID && !filters.getChildBranchs
                                        ? {
                                            parentBranchId: filters.branchID,
                                        }
                                        : undefined,
                                },
                            ],
                        },
                        {
                            mainRepository: filters.mainRepository,
                        },
                        {
                            type: filters.type ? filters.type : undefined,
                        },
                    ],
                },
                filters.getChildBranchs && filters.type
                    ? {
                        type: filters.type ? filters.type : undefined,
                        branch: filters.branchID
                            ? {
                                parentBranchId: filters.branchID,
                            }
                            : undefined,
                    }
                    : {},
            ],
        };
        if (filters.minified === true) {
            const paginatedRepositories = await db_1.prisma.repository.findManyPaginated({
                where: where,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    mainRepository: true,
                    branchId: true,
                },
            }, {
                page: filters.page,
                size: filters.size,
            });
            return {
                repositories: paginatedRepositories.data,
                pagesCount: paginatedRepositories.pagesCount,
            };
        }
        const paginatedRepositories = await db_1.prisma.repository.findManyPaginated({
            where: where,
            orderBy: {
                name: "asc",
            },
            select: repositories_responses_1.repositorySelect,
        }, {
            page: filters.page,
            size: filters.size,
        });
        return {
            repositories: paginatedRepositories.data,
            pagesCount: paginatedRepositories.pagesCount,
        };
    }
    async getRepository(data) {
        const repository = await db_1.prisma.repository.findUnique({
            where: {
                id: data.repositoryID,
            },
            select: repositories_responses_1.repositorySelect,
        });
        return repository;
    }
    async updateRepository(data) {
        const repository = await db_1.prisma.repository.update({
            where: {
                id: data.repositoryID,
            },
            data: {
                name: data.repositoryData.name,
                type: data.repositoryData.type,
                mainRepository: data.repositoryData.mainRepository ? true : false,
            },
            select: repositories_responses_1.repositorySelect,
        });
        return repository;
    }
    async deleteRepository(data) {
        await db_1.prisma.repository.delete({
            where: {
                id: data.repositoryID,
            },
        });
        return true;
    }
}
exports.RepositoriesRepository = RepositoriesRepository;
//# sourceMappingURL=repositories.repository.js.map