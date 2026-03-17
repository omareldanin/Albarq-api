import type {Prisma, RepositoryType} from "@prisma/client";
import {prisma} from "../../database/db";
import type {
  RepositoryCreateType,
  RepositoryUpdateType,
} from "./repositories.dto";
import {repositorySelect} from "./repositories.responses";

export class RepositoriesRepository {
  async createRepository(companyID: number, data: RepositoryCreateType) {
    const createdRepository = await prisma.repository.create({
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
      select: repositorySelect,
    });
    return createdRepository;
  }

  async getAllRepositoriesPaginated(filters: {
    page: number;
    size: number;
    companyID?: number;
    branchID?: number;
    minified?: boolean;
    forBranch?: boolean;
    getChildBranchs?: boolean;
    mainRepository?: boolean;
    type: string;
    inquiryBranchesIDs: number[] | undefined;
  }) {
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
                        id: {in: filters.inquiryBranchesIDs},
                      }
                    : filters.branchID && !filters.getChildBranchs
                      ? {id: filters.branchID}
                      : undefined,
                },
                {
                  branch:
                    filters.branchID && !filters.getChildBranchs
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
              type: filters.type ? (filters.type as RepositoryType) : undefined,
            },
          ],
        },
        filters.getChildBranchs && filters.type
          ? {
              type: filters.type ? (filters.type as RepositoryType) : undefined,
              branch: filters.branchID
                ? {
                    parentBranchId: filters.branchID,
                  }
                : undefined,
            }
          : {},
      ],
    } satisfies Prisma.RepositoryWhereInput;

    if (filters.minified === true) {
      const paginatedRepositories = await prisma.repository.findManyPaginated(
        {
          where: where,
          select: {
            id: true,
            name: true,
            type: true,
            mainRepository: true,
            branchId: true,
          },
        },
        {
          page: filters.page,
          size: filters.size,
        },
      );
      return {
        repositories: paginatedRepositories.data,
        pagesCount: paginatedRepositories.pagesCount,
      };
    }

    const paginatedRepositories = await prisma.repository.findManyPaginated(
      {
        where: where,
        orderBy: {
          name: "asc",
        },
        select: repositorySelect,
      },
      {
        page: filters.page,
        size: filters.size,
      },
    );

    return {
      repositories: paginatedRepositories.data,
      pagesCount: paginatedRepositories.pagesCount,
    };
  }

  async getRepository(data: {repositoryID: number}) {
    const repository = await prisma.repository.findUnique({
      where: {
        id: data.repositoryID,
      },
      select: repositorySelect,
    });
    return repository;
  }

  async updateRepository(data: {
    repositoryID: number;
    repositoryData: RepositoryUpdateType;
  }) {
    const repository = await prisma.repository.update({
      where: {
        id: data.repositoryID,
      },
      data: {
        name: data.repositoryData.name,
        type: data.repositoryData.type,
        mainRepository: data.repositoryData.mainRepository ? true : false,
      },
      select: repositorySelect,
    });
    return repository;
  }

  async deleteRepository(data: {repositoryID: number}) {
    await prisma.repository.delete({
      where: {
        id: data.repositoryID,
      },
    });
    return true;
  }
}
