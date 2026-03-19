import type {Governorate, Prisma} from "@prisma/client";
import {prisma} from "../../database/db";
import type {BranchCreateType, BranchUpdateType} from "./branches.dto";
import {branchSelect} from "./branches.responses";
import {redis} from "../../lib/redis";
import {loggedInUserType} from "../../types/user";
import {AppError} from "../../lib/AppError";

export class BranchesRepository {
  branchesCacheKey(filters: {
    page: number;
    size: number;
    companyID?: number;
    governorate?: Governorate;
    locationID?: number;
    minified?: boolean;
    getAll?: boolean;
    branchID?: number;
  }) {
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

  async createBranch(companyID: number, data: BranchCreateType) {
    const keys = await redis.keys("branches:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const createdBranch = await prisma.branch.create({
      data: {
        name: data.name,
        governorate: data.governorate,
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
      select: branchSelect,
    });
    return createdBranch;
  }

  async getAllBranchesPaginated(filters: {
    page: number;
    size: number;
    companyID?: number;
    governorate?: Governorate;
    locationID?: number;
    minified?: boolean;
    getAll?: boolean;
    getChilds?: boolean;
    branchID?: number;
  }) {
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
              company: {
                id: filters.companyID,
              },
            },
            {governorate: filters.governorate},
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
    } satisfies Prisma.BranchWhereInput;

    let result;

    // -----------------------------
    // MINIFIED
    // -----------------------------
    if (filters.minified === true) {
      const paginatedBranches = await prisma.branch.findManyPaginated(
        {
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
        },
        {
          page: 1,
          size: 10000,
        },
      );

      result = {
        branches: paginatedBranches.data,
        pagesCount: paginatedBranches.pagesCount,
      };
    } else {
      // -----------------------------
      // FULL
      // -----------------------------
      const paginatedBranches = await prisma.branch.findManyPaginated(
        {
          where,
          orderBy: {
            name: "asc",
          },
          select: branchSelect,
        },
        {
          page: filters.page,
          size: filters.size,
        },
      );

      result = {
        branches: paginatedBranches.data,
        pagesCount: paginatedBranches.pagesCount,
      };
    }

    // 3️⃣ Save to Redis (TTL = 2 day)
    const ONE_DAY = 60 * 60 * 48;

    await redis.set(cacheKey, JSON.stringify(result), "EX", ONE_DAY);

    return result;
  }

  async getBranch(data: {branchID: number}) {
    const branch = await prisma.branch.findUnique({
      where: {
        id: data.branchID,
      },
      select: branchSelect,
    });
    return branch;
  }

  async updateBranch(data: {
    branchID: number;
    branchData: BranchUpdateType;
    loggedInUser: loggedInUserType;
  }) {
    const keys = await redis.keys("branches:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const oldBranch = await prisma.branch.findUnique({
      where: {
        id: data.branchID,
      },
    });

    if (data.loggedInUser.role !== "COMPANY_MANAGER") {
      if (oldBranch?.parentBranchId !== data.loggedInUser.branchId) {
        throw new AppError("ليس مصرح لك التعديل علي هذا الفرع", 500);
      }
    }

    const branch = await prisma.branch.update({
      where: {
        id: data.branchID,
      },
      data: {
        name: data.branchData.name,
        governorate: data.branchData.governorate,
        parentBranch: data.branchData.parentBranchId
          ? {
              connect: {
                id: data.branchData.parentBranchId,
              },
            }
          : undefined,
      },
      select: branchSelect,
    });
    return branch;
  }

  async deleteBranch(data: {branchID: number; loggedInUser: loggedInUserType}) {
    const keys = await redis.keys("branches:*");
    if (keys.length) {
      await redis.del(keys);
    }

    const oldBranch = await prisma.branch.findUnique({
      where: {
        id: data.branchID,
      },
    });

    if (data.loggedInUser.role !== "COMPANY_MANAGER") {
      if (oldBranch?.parentBranchId !== data.loggedInUser.branchId) {
        throw new AppError("ليس مصرح لك حذف هذا الفرع", 500);
      }
    }

    await prisma.branch.delete({
      where: {
        id: data.branchID,
      },
    });
    return true;
  }

  async getBranchManagerBranch(data: {branchManagerID: number}) {
    const branch = await prisma.branch.findFirst({
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

  async getBranchByLocation(data: {locationID: number}) {
    const branch = await prisma.branch.findFirst({
      where: {
        locations: {
          some: {
            id: data.locationID,
          },
        },
      },
      select: branchSelect,
    });
    return branch;
  }
}
