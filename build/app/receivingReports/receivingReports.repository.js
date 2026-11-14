"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceivingReportsRepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const receivingReports_responses_1 = require("./receivingReports.responses");
const MAX_ORDERS_PER_REQUEST = 5000;
const forbidden = () => new AppError_1.AppError("ليس مصرح لك بعرض هذه الكشوفات", 403);
const receivingReportOrderSelect = {
    receiptNumber: true,
    createdAt: true,
    recipientName: true,
    recipientPhones: true,
    recipientAddress: true,
    governorate: true,
    totalCost: true,
    notes: true,
    store: { select: { name: true } },
    location: { select: { name: true } }
};
const receiptCollator = new Intl.Collator("en", { numeric: true });
class ReceivingReportsRepository {
    /** Reports a user may see: the client's own, the agent's own, or the whole company for its manager. */
    viewScope(user, filters) {
        const companyId = user.companyID;
        if (!companyId || !Number.isInteger(user.id) || user.id <= 0)
            throw forbidden();
        switch (user.role) {
            case "CLIENT":
                return { companyId, clientId: user.id };
            case "CLIENT_ASSISTANT":
                if (!user.permissions?.includes("MANAGE_REPORTS") || !user.clientId)
                    throw forbidden();
                return { companyId, clientId: user.clientId };
            case "RECEIVING_AGENT":
                return { companyId, receivingAgentId: user.id, clientId: filters?.client_id };
            case "COMPANY_MANAGER":
                return {
                    companyId,
                    clientId: filters?.client_id,
                    receivingAgentId: filters?.receiving_agent_id
                };
            default:
                throw forbidden();
        }
    }
    /**
     * Whose orders a creator may report, and which agent the report names.
     * A receiving agent reports its clients' orders; a client reports its own orders,
     * naming its receiving agent when exactly one is assigned to it.
     */
    createScope = async (user, data) => {
        const companyId = user.companyID;
        const notAllowed = () => new AppError_1.AppError("ليس مصرح لك القيام بهذا الفعل", 403);
        if (!companyId || !Number.isInteger(user.id) || user.id <= 0)
            throw notAllowed();
        if (user.role === "RECEIVING_AGENT") {
            const agent = await db_1.prisma.employee.findFirst({
                where: { id: user.id, companyId, role: "RECEIVING_AGENT", deleted: false },
                select: { id: true, inquiryClients: { select: { clientId: true } } }
            });
            if (!agent)
                throw notAllowed();
            // Same rule as the agent's orders list: no assigned clients means every company client.
            const assignedClients = agent.inquiryClients.map((item) => item.clientId);
            if (data.clientID && assignedClients.length > 0 && !assignedClients.includes(data.clientID)) {
                throw new AppError_1.AppError("هذا العميل غير مرتبط بك", 403);
            }
            return {
                companyId,
                clientId: data.clientID ?? (assignedClients.length > 0 ? { in: assignedClients } : undefined),
                receivingAgentId: agent.id
            };
        }
        if (user.role === "CLIENT") {
            if (data.clientID && data.clientID !== user.id)
                throw notAllowed();
            const client = await db_1.prisma.client.findFirst({
                where: { id: user.id, companyId, deleted: false },
                select: { id: true }
            });
            if (!client)
                throw notAllowed();
            const agents = await db_1.prisma.receivingAgentClients.findMany({
                where: {
                    clientId: client.id,
                    receivingAgent: { companyId, role: "RECEIVING_AGENT", deleted: false }
                },
                select: { agentId: true },
                take: 2
            });
            return {
                companyId,
                clientId: client.id,
                receivingAgentId: agents.length === 1 ? agents[0].agentId : null
            };
        }
        throw notAllowed();
    };
    /**
     * Saves received orders (status WITH_RECEIVING_AGENT) that are not in a receiving
     * report yet. Orders are split into one report per client so each client only ever
     * sees its own orders.
     */
    createReports = async (user, data) => {
        const scope = await this.createScope(user, data);
        const orders = await db_1.prisma.order.findMany({
            where: {
                companyId: scope.companyId,
                deleted: false,
                status: "WITH_RECEIVING_AGENT",
                receivingReportOrder: { is: null },
                id: data.ordersIDs ? { in: data.ordersIDs } : undefined,
                clientId: scope.clientId
            },
            select: { id: true, clientId: true, governorate: true, totalCost: true },
            orderBy: { createdAt: "asc" },
            take: MAX_ORDERS_PER_REQUEST + 1
        });
        if (orders.length === 0) {
            throw new AppError_1.AppError("لا توجد طلبات جديدة لعمل كشف استلام", 400);
        }
        if (orders.length > MAX_ORDERS_PER_REQUEST) {
            throw new AppError_1.AppError("عدد الطلبات كبير جداً، اختر عميلاً واحداً لعمل الكشف", 400);
        }
        const byClient = new Map();
        for (const order of orders) {
            const list = byClient.get(order.clientId) ?? [];
            list.push(order);
            byClient.set(order.clientId, list);
        }
        try {
            const reports = await db_1.prisma.$transaction([...byClient].map(([clientId, clientOrders]) => {
                const baghdad = clientOrders.filter((order) => order.governorate === "BAGHDAD").length;
                return db_1.prisma.receivingReport.create({
                    data: {
                        companyId: scope.companyId,
                        clientId,
                        receivingAgentId: scope.receivingAgentId,
                        ordersCount: clientOrders.length,
                        baghdadOrdersCount: baghdad,
                        governoratesOrdersCount: clientOrders.length - baghdad,
                        totalCost: clientOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0),
                        orders: { create: clientOrders.map((order) => ({ orderId: order.id })) }
                    },
                    select: receivingReports_responses_1.receivingReportSelect
                });
            }));
            return reports.map(receivingReports_responses_1.receivingReportReform);
        }
        catch (error) {
            // Another request put one of these orders in a report first (orderId is unique).
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new AppError_1.AppError("بعض الطلبات أضيفت إلى كشف استلام آخر، أعد المحاولة", 409);
            }
            throw error;
        }
    };
    getReports = async (user, filters) => {
        // Calendar dates follow Baghdad time; include the entire selected end day.
        const from = filters.start_date ? new Date(`${filters.start_date}T00:00:00+03:00`) : undefined;
        const until = filters.end_date ? new Date(`${filters.end_date}T00:00:00+03:00`) : undefined;
        if (until)
            until.setUTCDate(until.getUTCDate() + 1);
        const where = {
            ...this.viewScope(user, filters),
            createdAt: from || until ? { gte: from, lt: until } : undefined
        };
        const [reports, totals] = await Promise.all([
            db_1.prisma.receivingReport.findMany({
                where,
                orderBy: { id: "desc" },
                skip: (filters.page - 1) * filters.size,
                take: filters.size,
                select: receivingReports_responses_1.receivingReportSelect
            }),
            db_1.prisma.receivingReport.aggregate({
                where,
                _count: { id: true },
                _sum: {
                    ordersCount: true,
                    baghdadOrdersCount: true,
                    governoratesOrdersCount: true,
                    totalCost: true
                }
            })
        ]);
        return {
            page: filters.page,
            pagesCount: Math.max(1, Math.ceil(totals._count.id / filters.size)),
            data: {
                reports: reports.map(receivingReports_responses_1.receivingReportReform),
                reportsMetaData: {
                    reportsCount: totals._count.id,
                    ordersCount: totals._sum.ordersCount ?? 0,
                    baghdadOrdersCount: totals._sum.baghdadOrdersCount ?? 0,
                    governoratesOrdersCount: totals._sum.governoratesOrdersCount ?? 0,
                    totalCost: totals._sum.totalCost ?? 0
                }
            }
        };
    };
    /** A single report with its orders, for the PDF. */
    getReportWithOrders = async (user, reportID) => {
        const report = await db_1.prisma.receivingReport.findFirst({
            where: { id: reportID, ...this.viewScope(user) },
            select: {
                ...receivingReports_responses_1.receivingReportSelect,
                company: { select: { name: true, logo: true } },
                orders: { select: { order: { select: receivingReportOrderSelect } } }
            }
        });
        if (!report)
            throw new AppError_1.AppError("كشف الاستلام غير موجود", 404);
        const orders = report.orders
            .map((item) => item.order)
            .sort((a, b) => receiptCollator.compare(a.receiptNumber, b.receiptNumber));
        return { report: { ...(0, receivingReports_responses_1.receivingReportReform)(report), company: report.company }, orders };
    };
}
exports.ReceivingReportsRepository = ReceivingReportsRepository;
//# sourceMappingURL=receivingReports.repository.js.map