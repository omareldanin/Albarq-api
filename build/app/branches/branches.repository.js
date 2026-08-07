"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchesRepository = void 0;
const db_1 = require("../../database/db");
const branches_responses_1 = require("./branches.responses");
const redis_1 = require("../../lib/redis");
const AppError_1 = require("../../lib/AppError");
class BranchesRepository {
    branchesCacheKey(filters) {
        return `branches:${JSON.stringify({
            page: filters.page,
            size: filters.size,
            companyID: filters.companyID ?? null,
            governorate: filters.governorate ?? null,
            locationID: filters.locationID ?? null,
            minified: filters.minified ?? false,
            getAll: filters.getAll ?? false,
            branchID: filters.branchID ?? null,
        })}`;
    }
    async createBranch(companyID, data) {
        const keys = await redis_1.redis.keys("branches:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const createdBranch = await db_1.prisma.branch.create({
            data: {
                name: data.name,
                governorate: data.governorate,
                receivingDeliveryCosts: data.receivingDeliveryCosts,
                forwardedDeliveryCosts: data.forwardedDeliveryCosts,
                parentBranch: data.parentBranchId
                    ? {
                        connect: {
                            id: data.parentBranchId,
                        },
                    }
                    : undefined,
                company: {
                    connect: {
                        id: companyID,
                    },
                },
            },
            select: branches_responses_1.branchSelect,
        });
        return createdBranch;
    }
    async getAllBranchesPaginated(filters) {
        const cacheKey = this.branchesCacheKey(filters);
        // 1️⃣ Redis first (FAST PATH)
        // const cached = await redis.get(cacheKey);
        // if (cached) {
        //   return JSON.parse(cached) as {
        //     branches: any[];
        //     pagesCount: number;
        //   };
        // }
        // -----------------------------
        // ORIGINAL LOGIC (unchanged)
        // -----------------------------
        const where = {
            OR: [
                {
                    AND: [
                        {
                            id: filters.getAll
                                ? undefined
                                : filters.branchID
                                    ? filters.branchID
                                    : undefined,
                        },
                        {
                            companyId: filters.companyID,
                        },
                        { governorate: filters.governorate },
                        {
                            locations: filters.locationID
                                ? {
                                    some: {
                                        id: filters.locationID,
                                    },
                                }
                                : undefined,
                        },
                    ],
                },
                {
                    parentBranchId: filters.branchID ? filters.branchID : undefined,
                },
            ],
        };
        let result;
        // -----------------------------
        // MINIFIED
        // -----------------------------
        if (filters.minified === true) {
            const paginatedBranches = await db_1.prisma.branch.findManyPaginated({
                where: filters.getChilds
                    ? {
                        parentBranchId: filters.branchID,
                    }
                    : where,
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    id: "desc",
                },
            }, {
                page: 1,
                size: 10000,
                withCount: true,
            });
            result = {
                branches: paginatedBranches.data,
                pagesCount: paginatedBranches.pagesCount,
            };
        }
        else {
            // -----------------------------
            // FULL
            // -----------------------------
            const paginatedBranches = await db_1.prisma.branch.findManyPaginated({
                where,
                orderBy: {
                    id: "asc",
                },
                select: branches_responses_1.branchSelect,
            }, {
                page: filters.page,
                size: filters.size,
                withCount: true,
            });
            result = {
                branches: paginatedBranches.data,
                pagesCount: paginatedBranches.pagesCount,
            };
        }
        // 3️⃣ Save to Redis (TTL = 2 day)
        const ONE_DAY = 60 * 60 * 48;
        await redis_1.redis.set(cacheKey, JSON.stringify(result), "EX", ONE_DAY);
        return result;
    }
    async getBranch(data) {
        const branch = await db_1.prisma.branch.findUnique({
            where: {
                id: data.branchID,
            },
            select: branches_responses_1.branchSelect,
        });
        return branch;
    }
    async updateBranch(data) {
        const keys = await redis_1.redis.keys("branches:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const oldBranch = await db_1.prisma.branch.findUnique({
            where: {
                id: data.branchID,
            },
        });
        if (data.loggedInUser.role !== "COMPANY_MANAGER") {
            if (oldBranch?.parentBranchId !== data.loggedInUser.branchId) {
                throw new AppError_1.AppError("ليس مصرح لك التعديل علي هذا الفرع", 500);
            }
        }
        const branch = await db_1.prisma.branch.update({
            where: {
                id: data.branchID,
            },
            data: {
                name: data.branchData.name,
                governorate: data.branchData.governorate,
                receivingDeliveryCosts: data.branchData.receivingDeliveryCosts,
                forwardedDeliveryCosts: data.branchData.forwardedDeliveryCosts,
                parentBranch: data.branchData.parentBranchId
                    ? {
                        connect: {
                            id: data.branchData.parentBranchId,
                        },
                    }
                    : undefined,
            },
            select: branches_responses_1.branchSelect,
        });
        return branch;
    }
    async deleteBranch(data) {
        const keys = await redis_1.redis.keys("branches:*");
        if (keys.length) {
            await redis_1.redis.del(keys);
        }
        const oldBranch = await db_1.prisma.branch.findUnique({
            where: {
                id: data.branchID,
            },
        });
        if (data.loggedInUser.role !== "COMPANY_MANAGER") {
            if (oldBranch?.parentBranchId !== data.loggedInUser.branchId) {
                throw new AppError_1.AppError("ليس مصرح لك حذف هذا الفرع", 500);
            }
        }
        await db_1.prisma.branch.delete({
            where: {
                id: data.branchID,
            },
        });
        return true;
    }
    async getBranchManagerBranch(data) {
        const branch = await db_1.prisma.branch.findFirst({
            where: {
                employees: {
                    some: {
                        id: data.branchManagerID,
                    },
                },
            },
            select: {
                id: true,
                governorate: true,
            },
        });
        return branch;
    }
    async getBranchByLocation(data) {
        const branch = await db_1.prisma.branch.findFirst({
            where: {
                locations: {
                    some: {
                        id: data.locationID,
                    },
                },
            },
            select: branches_responses_1.branchSelect,
        });
        return branch;
    }
}
exports.BranchesRepository = BranchesRepository;
//# sourceMappingURL=branches.repository.js.map