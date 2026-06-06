import {prisma} from "../../database/db";
import type {loggedInUserType} from "../../types/user";
import type {CompanyCreateType, CompanyUpdateType} from "./companies.dto";
import {companySelect} from "./companies.responses";

export class CompaniesRepository {
  async createCompany(data: {
    loggedInUser: loggedInUserType;
    companyData: CompanyCreateType;
  }) {
    const createdCompany = await prisma.company.create({
      data: {
        name: data.companyData.companyData.name,
        phone: data.companyData.companyData.phone,
        logo: data.companyData.companyData.logo,
        registrationText: data.companyData.companyData.registrationText,
        governoratesDeliveryCosts:
          data.companyData.companyData.governoratesDeliveryCosts,
        isExternal:
          data.loggedInUser.role === "COMPANY_MANAGER" ||
          data.companyData.companyData.isExternal
            ? true
            : false,
        targetCompanyId:
          data.loggedInUser.role === "COMPANY_MANAGER"
            ? data.loggedInUser.companyID
            : data.companyData.companyData.companyID
              ? +data.companyData.companyData.companyID
              : undefined,
        employees:
          data.loggedInUser.role === "COMPANY_MANAGER"
            ? undefined
            : {
                create: {
                  user: {
                    create: {
                      username: data.companyData.companyManager.username,
                      name: data.companyData.companyManager.name,
                      password: data.companyData.companyManager.password,
                      phone: data.companyData.companyManager.phone,
                    },
                  },
                  createdBy: {
                    connect: {
                      id: data.loggedInUser.id,
                    },
                  },
                  role: "COMPANY_MANAGER",
                },
              },
      },
      select: companySelect,
    });
    return createdCompany;
  }

  async getAllCompaniesPaginated(
    filters: {
      page: number;
      size: number;
      minified?: boolean;
      mainCompany?: boolean;
    },
    loggedInUser: loggedInUserType,
  ) {
    if (filters.minified === true) {
      const paginatedCompanies = await prisma.company.findManyPaginated(
        {
          select: {
            id: true,
            name: true,
          },
          where: {
            mainCompany: filters.mainCompany,
            isExternal: loggedInUser.role !== "ADMIN" ? false : undefined,
          },
          orderBy: [
            {
              mainCompany: "desc",
            },
            {
              name: "asc",
            },
          ],
        },
        {
          page: filters.page,
          size: filters.size,
          withCount: true,
        },
      );
      return {
        companies: paginatedCompanies.data,
        pagesCount: paginatedCompanies.pagesCount,
      };
    }

    const paginatedCompanies = await prisma.company.findManyPaginated(
      {
        orderBy: [
          {
            mainCompany: "desc",
          },
          {
            name: "asc",
          },
        ],
        select: companySelect,
        where: {
          mainCompany: filters.mainCompany,
          isExternal: loggedInUser.role !== "ADMIN" ? false : undefined,
        },
      },
      {
        page: filters.page,
        size: filters.size,
        withCount: true,
      },
    );

    return {
      companies: paginatedCompanies.data,
      pagesCount: paginatedCompanies.pagesCount,
    };
  }

  async getCompany(data: {companyID: number}) {
    const company = await prisma.company.findUnique({
      where: {
        id: data.companyID,
      },
      select: companySelect,
    });
    return company;
  }

  async updateCompany(data: {
    companyID: number;
    companyData: CompanyUpdateType;
  }) {
    const company = await prisma.company.update({
      where: {
        id: data.companyID,
      },
      data: {
        name: data.companyData.name,
        phone: data.companyData.phone,
        logo: data.companyData.logo,
        registrationText: data.companyData.registrationText,
        governoratesDeliveryCosts: data.companyData.governoratesDeliveryCosts,
        isExternal: data.companyData.isExternal ? true : false,
        targetCompanyId: data.companyData.companyID
          ? +data.companyData.companyID
          : undefined,
        employees: {
          update: {
            where: {
              id: data.companyData.companyManagerID,
            },
            data: {
              user: {
                update: {
                  username: data.companyData.phone,
                  phone: data.companyData.phone,
                  password: data.companyData.password,
                  avatar: data.companyData.logo,
                },
              },
            },
          },
        },
      },
      select: companySelect,
    });
    return company;
  }

  async deleteCompany(data: {companyID: number}) {
    await prisma.usersLoginHistory.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });
    await prisma.transaction.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });
    await prisma.employee.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });
    await prisma.size.deleteMany({
      where: {
        client: {
          companyId: data.companyID,
        },
      },
    });
    await prisma.category.deleteMany({
      where: {
        client: {
          companyId: data.companyID,
        },
      },
    });
    await prisma.color.deleteMany({
      where: {
        client: {
          companyId: data.companyID,
        },
      },
    });
    await prisma.product.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });
    await prisma.orderTimeline.deleteMany({
      where: {
        order: {
          companyId: data.companyID,
        },
      },
    });
    await prisma.order.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });
    await prisma.store.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });

    await prisma.client.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });

    await prisma.clientOrderReceipt.deleteMany({
      where: {
        branch: {
          companyId: data.companyID,
        },
      },
    });

    await prisma.repository.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });

    await prisma.branch.deleteMany({
      where: {
        companyId: data.companyID,
      },
    });

    await prisma.company.delete({
      where: {
        id: data.companyID,
      },
      select: companySelect,
    });
    return true;
  }
}
