import { AdminRole, ClientRole, EmployeeRole, type Order, ReportType } from "@prisma/client";
import { AppError } from "../../lib/AppError";
// import { OrderTimelineType } from "../orders/orders.dto";
import { localizeReportType } from "../../lib/localize";
import type { loggedInUserType } from "../../types/user";
import { ClientsRepository } from "../clients/clients.repository";
import { CompaniesRepository } from "../companies/companies.repository";
import { EmployeesRepository } from "../employees/employees.repository";
import { sendNotification } from "../notifications/helpers/sendNotification";
import { OrdersRepository } from "../orders/orders.repository";
import type { orderReform } from "../orders/orders.responses";
import { generateReport } from "./helpers/generateReport";
import { generateReportsReport } from "./helpers/generateReportsReport";
import type {
    ReportCreateOrdersFiltersType,
    ReportCreateType,
    ReportUpdateType,
    ReportsFiltersType,
    ReportsReportPDFCreateType
} from "./reports.dto";
import { ReportsRepository } from "./reports.repository";
import type { reportReform } from "./reports.responses";

const reportsRepository = new ReportsRepository();
const ordersRepository = new OrdersRepository();
const employeesRepository = new EmployeesRepository();
const clientsRepository = new ClientsRepository();
const companiesRepository = new CompaniesRepository();

export class ReportsService {
    async createReport(data: {
        loggedInUser: loggedInUserType;
        reportData: ReportCreateType;
        ordersFilters: ReportCreateOrdersFiltersType;
    }) {
        let orders: ReturnType<typeof orderReform>[];
        let ordersIDs: number[] = [];
        if (data.reportData.ordersIDs === "*") {
            orders = (
                await ordersRepository.getAllOrdersPaginated({
                    filters: { ...data.ordersFilters, size: 5000 }
                })
            ).orders as ReturnType<typeof orderReform>[];

            for (const order of orders) {
                if (order) {
                    ordersIDs.push(order.id);
                }
            }
        } else {
            orders = await ordersRepository.getOrdersByIDs({ ordersIDs: data.reportData.ordersIDs });
            ordersIDs = data.reportData.ordersIDs;
        }
        //  orders = await ordersRepository.getOrdersByIDs(data.reportData);

        if (!orders || orders.length === 0) {
            throw new AppError("لا يوجد طلبات لعمل الكشف", 400);
        }

        // Check if orders are not in another report
        if (data.reportData.type === ReportType.CLIENT) {
            for (const order of orders) {
                if (order?.clientReport && order?.clientReport.deleted !== true) {
                    throw new AppError(
                        `الطلب ${order.receiptNumber} يوجد في كشف عملاء اخر رقمه ${order.clientReport.id}`,
                        400
                    );
                }
            }
        } else if (data.reportData.type === ReportType.REPOSITORY) {
            for (const order of orders) {
                if (order?.repositoryReport && order?.repositoryReport.deleted !== true) {
                    throw new AppError(
                        `الطلب ${order.receiptNumber} يوجد في كشف مخازن اخر رقمه ${order.repositoryReport.id}`,
                        400
                    );
                }
            }
        } else if (data.reportData.type === ReportType.BRANCH) {
            for (const order of orders) {
                if (order?.branchReport && order?.branchReport.deleted !== true) {
                    throw new AppError(
                        `الطلب ${order.receiptNumber} يوجد في كشف فروع اخر رقمه ${order.branchReport.id}`,
                        400
                    );
                }
            }
        } else if (data.reportData.type === ReportType.GOVERNORATE) {
            for (const order of orders) {
                if (order?.governorateReport && order?.governorateReport.deleted !== true) {
                    throw new AppError(
                        `الطلب ${order.receiptNumber} يوجد في كشف محافظة اخر رقمه ${order.governorateReport.id}`,
                        400
                    );
                }
            }
        } else if (data.reportData.type === ReportType.DELIVERY_AGENT) {
            for (const order of orders) {
                if (order?.deliveryAgentReport && order?.deliveryAgentReport.deleted !== true) {
                    throw new AppError(
                        `الطلب ${order.receiptNumber} يوجد في كشف مندوبين اخر رقمه ${order.deliveryAgentReport.id}`,
                        400
                    );
                }
            }
        } else if (data.reportData.type === ReportType.COMPANY) {
            for (const order of orders) {
                if (order?.companyReport && order?.companyReport.deleted !== true) {
                    throw new AppError(
                        `الطلب ${order.receiptNumber} يوجد في كشف شركة اخر رقمه ${order.companyReport.id}`,
                        400
                    );
                }
            }
        }

        // Change orders costs reportData contains new costs
        if (data.reportData.type === ReportType.CLIENT || data.reportData.type === ReportType.COMPANY) {
            await ordersRepository.updateOrdersCosts({
                ordersIDs,
                costs: {
                    baghdadDeliveryCost: data.reportData.baghdadDeliveryCost,
                    governoratesDeliveryCost: data.reportData.governoratesDeliveryCost
                }
            });

            orders = await ordersRepository.getOrdersByIDs({ ordersIDs });
        }

        if (
            data.reportData.type === ReportType.DELIVERY_AGENT ||
            data.reportData.type === ReportType.GOVERNORATE ||
            data.reportData.type === ReportType.BRANCH
        ) {
            await ordersRepository.updateOrdersCosts({
                ordersIDs,
                costs: {
                    deliveryAgentDeliveryCost: data.reportData.deliveryAgentDeliveryCost
                }
            });

            orders = await ordersRepository.getOrdersByIDs({ ordersIDs });
        }

        const reportMetaData = {
            baghdadOrdersCount: 0,
            governoratesOrdersCount: 0,
            totalCost: 0,
            paidAmount: 0,
            deliveryCost: 0,
            clientNet: 0,
            deliveryAgentNet: 0,
            companyNet: 0
        };

        for (const order of orders) {
            // @ts-expect-error Fix later
            reportMetaData.totalCost += +order.totalCost;
            // @ts-expect-error Fix later
            reportMetaData.paidAmount += +order.paidAmount;
            // @ts-expect-error Fix later
            reportMetaData.deliveryCost += +order.deliveryCost;
            // @ts-expect-error Fix later
            reportMetaData.clientNet += +order.clientNet;
            // @ts-expect-error Fix later
            reportMetaData.deliveryAgentNet += order.deliveryAgentNet;
            // @ts-expect-error Fix later
            reportMetaData.companyNet += +order.companyNet;
            // @ts-expect-error Fix later
            if (order.governorate === "BAGHDAD") {
                reportMetaData.baghdadOrdersCount++;
            } else {
                reportMetaData.governoratesOrdersCount++;
            }
        }

        // Get client id from store id if report type is client
        let clientID: number | undefined;
        if (data.reportData.type === ReportType.CLIENT) {
            clientID = await clientsRepository.getClientIDByStoreID({ storeID: data.reportData.storeID });
        }

        const report = await reportsRepository.createReport({
            loggedInUser: data.loggedInUser,
            reportData:
                data.reportData.type === ReportType.CLIENT
                    ? { ...data.reportData, ordersIDs, clientID }
                    : { ...data.reportData, ordersIDs },
            reportMetaData: reportMetaData
        });

        if (!report) {
            throw new AppError("حدث خطأ اثناء عمل الكشف", 500);
        }

        // if client report, make secondary status WITH_CLIENT
        if (data.reportData.type === ReportType.CLIENT) {
            await ordersRepository.updateOrdersSecondaryStatus({
                ordersIDs,
                secondaryStatus: "WITH_CLIENT"
            });
        }

        // Update company treasury
        if (
            data.reportData.type === ReportType.GOVERNORATE ||
            data.reportData.type === ReportType.BRANCH ||
            data.reportData.type === ReportType.DELIVERY_AGENT ||
            data.reportData.type === ReportType.COMPANY
        ) {
            await companiesRepository.updateCompanyTreasury({
                companyID: data.loggedInUser.companyID as number,
                treasury: {
                    amount: reportMetaData.companyNet || 0,
                    type: "increment"
                }
            });
        } else if (
            data.reportData.type === ReportType.CLIENT ||
            data.reportData.type === ReportType.REPOSITORY
        ) {
            await companiesRepository.updateCompanyTreasury({
                companyID: data.loggedInUser.companyID as number,
                treasury: {
                    amount: reportMetaData.clientNet || 0,
                    type: "decrement"
                }
            });
        }

        const reportData = await reportsRepository.getReport({
            reportID: report.id
        });

        if (!reportData) {
            throw new AppError("حدث خطأ اثناء عمل الكشف", 500);
        }

        // Send notification to client if report type is client report
        if (data.reportData.type === ReportType.CLIENT) {
            await sendNotification({
                title: "تم انشاء كشف جديد",
                content: `تم انشاء كشف جديد برقم ${reportData?.id}`,
                userID: reportData?.clientReport?.client.id as number
            });
        }

        // Send notification to delivery agent if report type is delivery agent report
        if (data.reportData.type === ReportType.DELIVERY_AGENT) {
            await sendNotification({
                title: "تم انشاء كشف جديد",
                content: `تم انشاء كشف جديد برقم ${reportData?.id}`,
                userID: reportData?.deliveryAgentReport?.deliveryAgent.id as number
            });
        }

        // update orders timeline
        for (const order of orders) {
            if (!order) {
                continue;
            }
            await ordersRepository.updateOrderTimeline({
                orderID: order.id,
                data: {
                    type: "REPORT_CREATE",
                    date: reportData?.createdAt,
                    old: null,
                    new: {
                        id: reportData?.id,
                        type: reportData?.type as ReportType
                    },
                    by: {
                        id: data.loggedInUser.id,
                        name: data.loggedInUser.name
                    },
                    message: `تم انشاء كشف ${localizeReportType(reportData?.type)} برقم ${reportData?.id}`
                }
            });
        }

        // TODO
        const pdf = await generateReport(data.reportData.type, reportData, orders);
        // const pdf = await generateReport(
        //     await ordersRepository.getAllOrders(0, 100, {
        //         sort: "receiptNumber:desc"
        //     })
        // );

        return pdf;
    }

    async getAllReports(data: {
        loggedInUser: loggedInUserType;
        filters: ReportsFiltersType;
    }) {
        let company: number | undefined;
        if (Object.keys(AdminRole).includes(data.loggedInUser.role)) {
            company = data.filters.company ? +data.filters.company : undefined;
        } else if (data.loggedInUser.companyID) {
            company = data.loggedInUser.companyID;
        }

        // Only show reports of the same branch as the employee
        let branch: number | undefined;
        if (
            (data.filters.type === ReportType.CLIENT ||
                data.filters.type === ReportType.REPOSITORY ||
                data.filters.type === ReportType.DELIVERY_AGENT) &&
            data.loggedInUser.role !== EmployeeRole.COMPANY_MANAGER &&
            data.loggedInUser.role !== AdminRole.ADMIN &&
            data.loggedInUser.role !== AdminRole.ADMIN_ASSISTANT &&
            data.loggedInUser.role !== ClientRole.CLIENT &&
            data.loggedInUser.role !== EmployeeRole.CLIENT_ASSISTANT
        ) {
            const employee = await employeesRepository.getEmployee({ employeeID: data.loggedInUser.id });
            branch = employee?.branch?.id;
        } else if (data.filters.branch) {
            branch = +data.filters.branch;
        } else {
            branch = undefined;
        }

        let clientID: number | undefined;
        if (data.loggedInUser.role === "CLIENT" || data.loggedInUser.role === "CLIENT_ASSISTANT") {
            clientID = +data.loggedInUser.id;
        } else if (data.filters.clientID) {
            clientID = +data.filters.clientID;
        } else {
            clientID = undefined;
        }

        let deliveryAgentID: number | undefined;
        if (data.loggedInUser.role === EmployeeRole.DELIVERY_AGENT) {
            deliveryAgentID = +data.loggedInUser.id;
        } else if (data.filters.deliveryAgentID) {
            deliveryAgentID = +data.filters.deliveryAgentID;
        } else {
            deliveryAgentID = undefined;
        }

        let size = data.filters.size ? +data.filters.size : 10;
        if (size > 500 && data.filters.minified !== true) {
            size = 10;
        }
        let page = 1;
        if (data.filters.page && !Number.isNaN(+data.filters.page) && +data.filters.page > 0) {
            page = +data.filters.page;
        }

        const { reports, reportsMetaData, pagesCount } = await reportsRepository.getAllReportsPaginated({
            filters: { ...data.filters, company, branch, clientID, deliveryAgentID, size }
        });

        return { page, pagesCount, reports, reportsMetaData };
    }

    async getReport(data: { params: { reportID: number } }) {
        const report = await reportsRepository.getReport({
            reportID: data.params.reportID
        });

        if (report?.deleted) {
            throw new AppError("الكشف المطلوب موجود بسلة المحذوفات", 404);
        }

        return report;
    }

    async getReportPDF(data: { params: { reportID: number } }) {
        const reportData = await reportsRepository.getReport({
            reportID: data.params.reportID
        });

        if (reportData?.deleted) {
            throw new AppError("الكشف المطلوب موجود بسلة المحذوفات", 404);
        }

        // TODO: fix this
        // @ts-expect-error Fix later
        const orders: Order[] = reportData?.repositoryReport
            ? // @tts-expect-error: Unreachable code error
              reportData?.repositoryReport.repositoryReportOrders
            : reportData?.branchReport
              ? // @tts-expect-error: Unreachable code error
                reportData?.branchReport.branchReportOrders
              : reportData?.clientReport
                ? // @tts-expect-error: Unreachable code error
                  reportData?.clientReport.clientReportOrders
                : reportData?.deliveryAgentReport
                  ? // @tts-expect-error: Unreachable code error
                    reportData?.deliveryAgentReport.deliveryAgentReportOrders
                  : reportData?.governorateReport
                    ? // @tts-expect-error: Unreachable code error
                      reportData?.governorateReport.governorateReportOrders
                    : reportData?.companyReport
                      ? // @tts-expect-error: Unreachable code error
                        reportData?.companyReport.companyReportOrders
                      : [];

        const ordersIDs = orders.map((order) => order.id);

        const ordersData = await ordersRepository.getOrdersByIDs({
            ordersIDs: ordersIDs
        });

        const pdf = await generateReport(
            // @ts-expect-error Fix later
            reportData.type,
            reportData,
            ordersData
        );
        return pdf;
    }

    async getReportsReportPDF(data: {
        reportsData: ReportsReportPDFCreateType;
        reportsFilters: ReportsFiltersType;
    }) {
        let reports: ReturnType<typeof reportReform>[];
        let reportsIDs: number[] = [];
        if (data.reportsData.reportsIDs === "*") {
            reports = (
                await reportsRepository.getAllReportsPaginated({
                    filters: { ...data.reportsFilters, type: data.reportsData.type, size: 5000 }
                })
            ).reports as ReturnType<typeof reportReform>[];

            for (const report of reports) {
                if (report) {
                    reportsIDs.push(report.id);
                }
            }
        } else {
            reports = await reportsRepository.getReportsByIDs({ reportsIDs: data.reportsData.reportsIDs });
            reportsIDs = data.reportsData.reportsIDs;
        }

        if (!reports || reports.length === 0) {
            throw new AppError("لا يوجد كشوفات لعمل التقرير", 400);
        }

        if (data.reportsData.type === "CLIENT") {
            const reportsData = {
                company: reports[0]?.company,
                companyNet: reports.reduce((acc, report) => {
                    if (report) {
                        return acc + report.companyNet;
                    }
                    return acc;
                }, 0),
                clientNet: reports.reduce((acc, report) => {
                    if (report) {
                        return acc + report.clientNet;
                    }
                    return acc;
                }, 0),
                baghdadOrdersCount: reports.reduce((acc, report) => {
                    if (report) {
                        return acc + (report.baghdadOrdersCount || 0);
                    }
                    return acc;
                }, 0),
                governoratesOrdersCount: reports.reduce((acc, report) => {
                    if (report) {
                        return acc + (report.governoratesOrdersCount || 0);
                    }
                    return acc;
                }, 0),
                date: new Date(),
                count: reports.length
            };
            const pdf = await generateReportsReport(data.reportsData.type, reportsData, reports);
            return pdf;
        }

        throw new AppError("لا يمكن عمل تقرير لهذا النوع من التقارير", 400);
    }

    async updateReport(data: {
        params: { reportID: number };
        loggedInUser: loggedInUserType;
        reportData: ReportUpdateType;
    }) {
        if (
            data.reportData.confirmed === false &&
            (data.loggedInUser.role === "CLIENT" || data.loggedInUser.role === "CLIENT_ASSISTANT")
        ) {
            throw new AppError("لا يمكنك إلغاء تأكيد التقرير", 400);
        }

        const report = await reportsRepository.updateReport({
            reportID: data.params.reportID,
            reportData: data.reportData
        });

        return report;
    }

    async deleteReport(data: { params: { reportID: number } }) {
        await reportsRepository.deleteReport({
            reportID: data.params.reportID
        });
    }

    async deactivateReport(data: { params: { reportID: number }; loggedInUser: loggedInUserType }) {
        const report = await reportsRepository.deactivateReport({
            reportID: data.params.reportID,
            deletedByID: data.loggedInUser.id
        });

        const orders =
            report?.type === ReportType.CLIENT
                ? report.clientReport?.clientReportOrders
                : report?.type === ReportType.REPOSITORY
                  ? report?.repositoryReport?.repositoryReportOrders
                  : report?.type === ReportType.BRANCH
                    ? report?.branchReport?.branchReportOrders
                    : report?.type === ReportType.GOVERNORATE
                      ? report?.governorateReport?.governorateReportOrders
                      : report?.type === ReportType.DELIVERY_AGENT
                        ? report?.deliveryAgentReport?.deliveryAgentReportOrders
                        : report?.type === ReportType.COMPANY
                          ? report?.companyReport?.companyReportOrders
                          : [];

        if (orders) {
            for (const order of orders) {
                await ordersRepository.updateOrderTimeline({
                    orderID: order.id,
                    data: {
                        type: "REPORT_DELETE",
                        date: report?.updatedAt || new Date(),
                        old: {
                            id: data.params.reportID,
                            type: report?.type as ReportType
                        },
                        new: null,
                        by: {
                            id: data.loggedInUser.id,
                            name: data.loggedInUser.name
                        },
                        message: `تم حذف كشف ${localizeReportType(report?.type as ReportType)} برقم ${
                            data.params.reportID
                        }`
                    }
                });
            }
        }

        // Send notification to client if report type is client report
        if (report?.type === ReportType.CLIENT) {
            await sendNotification({
                title: "تم حذف كشف",
                content: `تم حذف الكشف برقم ${report.id}`,
                userID: report.clientReport?.client.id as number
            });
        }

        // Send notification to delivery agent if report type is delivery agent report
        if (report?.type === ReportType.DELIVERY_AGENT) {
            await sendNotification({
                title: "تم حذف كشف",
                content: `تم حذف الكشف برقم ${report.id}`,
                userID: report.deliveryAgentReport?.deliveryAgent.id as number
            });
        }
    }

    async reactivateReport(data: { params: { reportID: number } }) {
        const report = await reportsRepository.reactivateReport({
            reportID: data.params.reportID
        });

        // Send notification to client if report type is client report
        if (report?.type === ReportType.CLIENT) {
            await sendNotification({
                title: "تم استعادة كشف",
                content: `تم استعادة الكشف برقم ${report.id}`,
                userID: report.clientReport?.client.id as number
            });
        }

        // Send notification to delivery agent if report type is delivery agent report
        if (report?.type === ReportType.DELIVERY_AGENT) {
            await sendNotification({
                title: "تم استعادة كشف",
                content: `تم استعادة الكشف برقم ${report.id}`,
                userID: report.deliveryAgentReport?.deliveryAgent.id as number
            });
        }
    }
}
