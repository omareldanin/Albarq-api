"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.managerAgentIdSchema = exports.managerStatusSchema = exports.managerOrderStatusSchema = void 0;
exports.receivingManagerScope = receivingManagerScope;
exports.receivingManagerOrderWhere = receivingManagerOrderWhere;
exports.receivingManagerReportWhere = receivingManagerReportWhere;
exports.getReceivingManagerStatistics = getReceivingManagerStatistics;
exports.getReceivingManagerAgents = getReceivingManagerAgents;
exports.getReceivingManagerClients = getReceivingManagerClients;
exports.getReceivingManagerReports = getReceivingManagerReports;
const zod_1 = require("zod");
const db_1 = require("../../database/db");
const AppError_1 = require("../../lib/AppError");
const reports_responses_1 = require("../reports/reports.responses");
exports.managerOrderStatusSchema = zod_1.z.enum([
    "READY_TO_SEND",
    "WITH_RECEIVING_AGENT",
]);
exports.managerStatusSchema = zod_1.z.enum([
    "READY_TO_SEND",
    "WITH_RECEIVING_AGENT",
    "RETURNED",
    "DELIVERED",
]);
exports.managerAgentIdSchema = zod_1.z.coerce.number().int().positive().safe();
function receivingManagerScope(user) {
    if (user.role !== "RECEIVING_AGENTS_MANAGER" ||
        !Number.isSafeInteger(user.companyID) ||
        !user.companyID ||
        user.companyID < 1 ||
        !Number.isSafeInteger(user.branchId) ||
        user.branchId < 1)
        throw new AppError_1.AppError("يجب ربط مدير مندوبي الاستلام بشركة وفرع", 403);
    return { companyId: user.companyID, branchId: user.branchId };
}
function receivingManagerOrderWhere(user, status, agentId) {
    const scope = receivingManagerScope(user);
    const agent = { ...scope, ...(agentId === undefined ? {} : { id: agentId }) };
    return {
        companyId: scope.companyId,
        deleted: false,
        status,
        ...(status === "WITH_RECEIVING_AGENT"
            ? { deliveryAgent: agent }
            : {
                client: {
                    ...scope,
                    ReceivingAgentClients: { some: { receivingAgent: agent } },
                },
            }),
    };
}
function receivingManagerReportWhere(user, secondaryType, agentId) {
    const scope = receivingManagerScope(user);
    return {
        companyId: scope.companyId,
        type: "CLIENT",
        deleted: false,
        confirmed: false,
        clientReport: {
            secondaryType,
            client: scope,
            agent: { ...scope, ...(agentId === undefined ? {} : { id: agentId }) },
        },
    };
}
const reportOrdersCount = (sum) => (sum.baghdadOrdersCount ?? 0) + (sum.governoratesOrdersCount ?? 0);
async function getReceivingManagerStatistics(user) {
    const [returned, delivered, ready, withAgent] = await Promise.all([
        db_1.prisma.report.aggregate({
            where: receivingManagerReportWhere(user, "RETURNED"),
            _sum: { baghdadOrdersCount: true, governoratesOrdersCount: true },
        }),
        db_1.prisma.report.aggregate({
            where: receivingManagerReportWhere(user, "DELIVERED"),
            _sum: { baghdadOrdersCount: true, governoratesOrdersCount: true },
        }),
        db_1.prisma.order.count({
            where: receivingManagerOrderWhere(user, "READY_TO_SEND"),
        }),
        db_1.prisma.order.count({
            where: receivingManagerOrderWhere(user, "WITH_RECEIVING_AGENT"),
        }),
    ]);
    return {
        ordersStatisticsByStatus: [
            {
                status: "WITH_RECEIVING_AGENT",
                totalCost: 0,
                count: withAgent,
                name: "مع مندوب الاستلام",
            },
            {
                status: "READY_TO_SEND",
                totalCost: 0,
                count: ready,
                name: "جاهز للشحن",
            },
            {
                status: "RETURNED",
                totalCost: 0,
                count: reportOrdersCount(returned._sum),
                name: "كشوفات الراجع",
            },
            {
                status: "DELIVERED",
                totalCost: 0,
                count: reportOrdersCount(delivered._sum),
                name: "كشوفات الواصل",
            },
        ],
    };
}
const sortAgents = (agents) => agents.sort((a, b) => b.count - a.count || a.agentId - b.agentId);
async function getReceivingManagerAgents(user, status) {
    const scope = receivingManagerScope(user);
    if (status === "RETURNED" || status === "DELIVERED") {
        // Report totals belong to Report, while the receiving agent belongs to ClientReport.
        // Select only the saved counts and agent identity; never load the reports' orders.
        const reports = await db_1.prisma.report.findMany({
            where: receivingManagerReportWhere(user, status),
            select: {
                baghdadOrdersCount: true,
                governoratesOrdersCount: true,
                clientReport: {
                    select: {
                        agent: { select: { id: true, user: { select: { name: true } } } },
                    },
                },
            },
        });
        const groups = new Map();
        let totalCount = 0;
        for (const report of reports) {
            const agent = report.clientReport?.agent;
            if (!agent)
                continue;
            const group = groups.get(agent.id) ?? {
                agentId: agent.id,
                agentName: agent.user.name,
                count: 0,
                reportsCount: 0,
            };
            group.count += reportOrdersCount(report);
            group.reportsCount = (group.reportsCount ?? 0) + 1;
            totalCount += reportOrdersCount(report);
            groups.set(agent.id, group);
        }
        return {
            agents: sortAgents([...groups.values()]),
            totalCount,
            hasSharedClients: false,
        };
    }
    if (status === "WITH_RECEIVING_AGENT") {
        const counts = await db_1.prisma.order.groupBy({
            by: ["deliveryAgentId"],
            where: receivingManagerOrderWhere(user, status),
            _count: { id: true },
        });
        const employees = await db_1.prisma.employee.findMany({
            where: {
                ...scope,
                id: {
                    in: counts.flatMap((row) => row.deliveryAgentId === null ? [] : [row.deliveryAgentId]),
                },
            },
            select: { id: true, user: { select: { name: true } } },
        });
        const names = new Map(employees.map((agent) => [agent.id, agent.user.name]));
        const agents = counts.flatMap((row) => row.deliveryAgentId === null
            ? []
            : [
                {
                    agentId: row.deliveryAgentId,
                    agentName: names.get(row.deliveryAgentId) ?? String(row.deliveryAgentId),
                    count: row._count.id,
                },
            ]);
        return {
            agents: sortAgents(agents),
            totalCount: agents.reduce((sum, row) => sum + row.count, 0),
            hasSharedClients: false,
        };
    }
    const counts = await db_1.prisma.order.groupBy({
        by: ["clientId"],
        where: receivingManagerOrderWhere(user, status),
        _count: { id: true },
    });
    const assignments = await db_1.prisma.receivingAgentClients.findMany({
        where: {
            clientId: { in: counts.map((row) => row.clientId) },
            receivingAgent: scope,
        },
        select: {
            clientId: true,
            agentId: true,
            receivingAgent: { select: { user: { select: { name: true } } } },
        },
    });
    const clientCounts = new Map(counts.map((row) => [row.clientId, row._count.id]));
    const groups = new Map();
    const seenClients = new Set();
    let hasSharedClients = false;
    for (const assignment of assignments) {
        if (seenClients.has(assignment.clientId))
            hasSharedClients = true;
        seenClients.add(assignment.clientId);
        const group = groups.get(assignment.agentId) ?? {
            agentId: assignment.agentId,
            agentName: assignment.receivingAgent.user.name,
            count: 0,
        };
        group.count += clientCounts.get(assignment.clientId) ?? 0;
        groups.set(assignment.agentId, group);
    }
    return {
        agents: sortAgents([...groups.values()]),
        // Count each order once even when its client is assigned to several agents.
        totalCount: counts.reduce((sum, row) => sum + row._count.id, 0),
        hasSharedClients,
    };
}
async function getReceivingManagerClients(user, status, agentId) {
    const counts = await db_1.prisma.order.groupBy({
        by: ["clientId"],
        where: receivingManagerOrderWhere(user, status, agentId),
        _count: { id: true },
    });
    const clients = await db_1.prisma.client.findMany({
        where: {
            companyId: receivingManagerScope(user).companyId,
            id: { in: counts.map((row) => row.clientId) },
        },
        select: { id: true, user: { select: { name: true } } },
    });
    const names = new Map(clients.map((client) => [client.id, client.user.name]));
    return counts
        .map((row) => ({
        clientId: row.clientId,
        clientName: names.get(row.clientId) ?? String(row.clientId),
        count: row._count.id,
    }))
        .sort((a, b) => b.count - a.count || a.clientId - b.clientId);
}
async function getReceivingManagerReports(user, filters) {
    const page = Number.isSafeInteger(filters.page) && filters.page > 0 ? filters.page : 1;
    const size = Number.isSafeInteger(filters.size) && filters.size > 0
        ? Math.min(filters.size, 100)
        : 20;
    const where = receivingManagerReportWhere(user, filters.secondaryType, filters.receivingAgentID);
    const [paginated, totals] = await Promise.all([
        db_1.prisma.report.findManyPaginated({ where, orderBy: { id: "desc" }, select: reports_responses_1.AllreportSelect }, { page, size, withCount: true }),
        db_1.prisma.report.aggregate({
            where,
            _count: { id: true },
            _sum: {
                totalCost: true,
                paidAmount: true,
                deliveryCost: true,
                baghdadOrdersCount: true,
                governoratesOrdersCount: true,
                clientNet: true,
                deliveryAgentNet: true,
                companyNet: true,
            },
        }),
    ]);
    return {
        page,
        pagesCount: paginated.pagesCount,
        reports: paginated.data.map(reports_responses_1.AllreportReform),
        reportsMetaData: {
            reportsCount: totals._count.id,
            totalCost: totals._sum.totalCost ?? 0,
            paidAmount: totals._sum.paidAmount ?? 0,
            deliveryCost: totals._sum.deliveryCost ?? 0,
            baghdadOrdersCount: totals._sum.baghdadOrdersCount ?? 0,
            governoratesOrdersCount: totals._sum.governoratesOrdersCount ?? 0,
            clientNet: totals._sum.clientNet ?? 0,
            deliveryAgentNet: totals._sum.deliveryAgentNet ?? 0,
            companyNet: totals._sum.companyNet ?? 0,
        },
    };
}
//# sourceMappingURL=receivingAgentManager.js.map