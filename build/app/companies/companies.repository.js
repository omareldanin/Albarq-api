"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesRepository = void 0;
const db_1 = require("../../database/db");
const companies_responses_1 = require("./companies.responses");
class CompaniesRepository {
    async createCompany(data) {
        const createdCompany = await db_1.prisma.company.create({
            data: {
                name: data.companyData.companyData.name,
                phone: data.companyData.companyData.phone,
                logo: data.companyData.companyData.logo,
                registrationText: data.companyData.companyData.registrationText,
                governoratesDeliveryCosts: data.companyData.companyData.governoratesDeliveryCosts,
                isExternal: data.loggedInUser.role === "COMPANY_MANAGER" ||
                    data.companyData.companyData.isExternal
                    ? true
                    : false,
                targetCompanyId: data.loggedInUser.role === "COMPANY_MANAGER"
                    ? data.loggedInUser.companyID
                    : data.companyData.companyData.companyID
                        ? +data.companyData.companyData.companyID
                        : undefined,
                employees: data.loggedInUser.role === "COMPANY_MANAGER"
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
            select: companies_responses_1.companySelect,
        });
        return createdCompany;
    }
    async getAllCompaniesPaginated(filters, loggedInUser) {
        if (filters.minified === true) {
            const paginatedCompanies = await db_1.prisma.company.findManyPaginated({
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
            }, {
                page: filters.page,
                size: filters.size,
                withCount: true,
            });
            return {
                companies: paginatedCompanies.data,
                pagesCount: paginatedCompanies.pagesCount,
            };
        }
        const paginatedCompanies = await db_1.prisma.company.findManyPaginated({
            orderBy: [
                {
                    mainCompany: "desc",
                },
                {
                    name: "asc",
                },
            ],
            select: companies_responses_1.companySelect,
            where: {
                mainCompany: filters.mainCompany,
                isExternal: loggedInUser.role !== "ADMIN" ? false : undefined,
            },
        }, {
            page: filters.page,
            size: filters.size,
            withCount: true,
        });
        return {
            companies: paginatedCompanies.data,
            pagesCount: paginatedCompanies.pagesCount,
        };
    }
    async getCompany(data) {
        const company = await db_1.prisma.company.findUnique({
            where: {
                id: data.companyID,
            },
            select: companies_responses_1.companySelect,
        });
        return company;
    }
    async updateCompany(data) {
        const company = await db_1.prisma.company.update({
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
            select: companies_responses_1.companySelect,
        });
        return company;
    }
    async deleteCompany(data) {
        await db_1.prisma.employee.deleteMany({
            where: {
                companyId: data.companyID,
            },
        });
        await db_1.prisma.company.delete({
            where: {
                id: data.companyID,
            },
            select: companies_responses_1.companySelect,
        });
        return true;
    }
}
exports.CompaniesRepository = CompaniesRepository;
//# sourceMappingURL=companies.repository.js.map