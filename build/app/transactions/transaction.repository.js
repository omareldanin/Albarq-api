"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsRepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../../database/db");
const transactionSelect = {
    id: true,
    type: true,
    for: true,
    paidAmount: true,
    totalPaidAmount: true,
    branchNet: true,
    clientNet: true,
    deliveryAgentNet: true,
    forwardedBranchNet: true,
    receivingBranchNet: true,
    insideBranchNet: true,
    approved: true,
    deleted: true,
    createdAt: true,
    updatedAt: true,
    branch: { select: { id: true, name: true } },
    company: { select: { id: true, name: true } },
    employee: { select: { id: true, user: { select: { name: true } } } },
    createdBy: { select: { id: true, name: true } },
    report: { select: { id: true, type: true } },
};
class TransactionsRepository {
    computeProfit = async (params) => {
        const { companyId, myBranchId, applyBranchScope, dateFilter } = params;
        // spread only when a range is given — omitted means "all time"
        const dateCondition = dateFilter ? { deliveriedAt: dateFilter } : {};
        let [insideBranchNet, receivedBranchNet, forwardedBranchNet] = await Promise.all([
            applyBranchScope
                ? Promise.resolve({
                    _sum: {
                        deliveryCost: 0,
                        forwardedBranchNet: 0,
                        receivingBranchNet: 0,
                        deliveryAgentNet: 0,
                        insideBranchNet: 0,
                    },
                    _count: { id: 0 },
                })
                : db_1.prisma.order.aggregate({
                    _sum: {
                        deliveryCost: true,
                        forwardedBranchNet: true,
                        receivingBranchNet: true,
                        deliveryAgentNet: true,
                        insideBranchNet: true,
                    },
                    _count: { id: true },
                    where: {
                        companyId,
                        deleted: false,
                        confirmed: true,
                        branchId: myBranchId,
                        status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                        client: { branchId: myBranchId },
                        ...dateCondition,
                    },
                }),
            db_1.prisma.order.aggregate({
                _sum: { receivingBranchNet: true, deliveryAgentNet: true },
                _count: { id: true },
                where: {
                    companyId,
                    deleted: false,
                    confirmed: true,
                    branchId: myBranchId,
                    status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                    client: { branchId: { not: myBranchId } },
                    ...dateCondition,
                },
            }),
            db_1.prisma.order.aggregate({
                _sum: {
                    forwardedBranchNet: true,
                    clientNet: true,
                    deliveryCost: true,
                    receivingBranchNet: true,
                    deliveryAgentNet: true,
                },
                _count: { id: true },
                where: {
                    companyId,
                    deleted: false,
                    confirmed: true,
                    status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                    branchId: { not: myBranchId },
                    client: { branchId: myBranchId },
                    ...dateCondition,
                },
            }),
        ]);
        if (applyBranchScope) {
            const rows = await db_1.prisma.$queryRaw `
        SELECT
          SUM(o."deliveryCost")         AS "deliveryCost",
          SUM(o."forwardedBranchNet") AS "forwardedBranchNet",
          SUM(o."receivingBranchNet") AS "receivingBranchNet",
          SUM(o."deliveryAgentNet")   AS "deliveryAgentNet",
          SUM(o."insideBranchNet")    AS "insideBranchNet",
          COUNT(o."id")               AS "count"
        FROM "Order" o
        JOIN "Client" c ON c."id" = o."clientId"
        WHERE o."companyId" = ${companyId}
          AND o."deleted" = false
          AND o."confirmed" = true
          AND o."status" IN ('DELIVERED','PARTIALLY_RETURNED','REPLACED')
          AND c."branchId" <> ${myBranchId}
          AND o."branchId" IS DISTINCT FROM c."branchId"
          ${dateFilter ? client_1.Prisma.sql `AND o."deliveriedAt" >= ${dateFilter.gte} AND o."deliveriedAt" < ${dateFilter.lt}` : client_1.Prisma.empty};
      `;
            const result = rows[0];
            insideBranchNet = {
                _sum: {
                    deliveryCost: result.deliveryCost
                        ? Number(result.deliveryCost)
                        : null,
                    forwardedBranchNet: result.forwardedBranchNet
                        ? Number(result.forwardedBranchNet)
                        : null,
                    receivingBranchNet: result.receivingBranchNet
                        ? Number(result.receivingBranchNet)
                        : null,
                    deliveryAgentNet: result.deliveryAgentNet
                        ? Number(result.deliveryAgentNet)
                        : null,
                    insideBranchNet: result.insideBranchNet
                        ? Number(result.insideBranchNet)
                        : null,
                },
                _count: { id: Number(result.count) },
            };
        }
        const insideBranchProfit = applyBranchScope
            ? {
                total: (insideBranchNet._sum.forwardedBranchNet ?? 0) -
                    (insideBranchNet._sum.receivingBranchNet ?? 0),
                count: insideBranchNet._count.id,
            }
            : {
                total: insideBranchNet._sum.insideBranchNet ?? 0,
                count: insideBranchNet._count.id,
            };
        const receivedBranchProfit = {
            total: (receivedBranchNet._sum.receivingBranchNet ?? 0) -
                (receivedBranchNet._sum.deliveryAgentNet ?? 0),
            count: receivedBranchNet._count.id,
        };
        const forwardedBranchProfit = applyBranchScope
            ? {
                total: (forwardedBranchNet._sum.deliveryCost ?? 0) -
                    (forwardedBranchNet._sum.receivingBranchNet ?? 0),
                count: forwardedBranchNet._count.id,
            }
            : {
                total: (forwardedBranchNet._sum.deliveryCost ?? 0) -
                    (forwardedBranchNet._sum.forwardedBranchNet ?? 0),
                count: forwardedBranchNet._count.id,
            };
        return {
            total: {
                total: insideBranchProfit.total +
                    receivedBranchProfit.total +
                    forwardedBranchProfit.total,
                count: insideBranchProfit.count +
                    receivedBranchProfit.count +
                    forwardedBranchProfit.count,
            },
            insideBranchNet: insideBranchProfit,
            receivedBranchNet: receivedBranchProfit,
            forwardedBranchNet: forwardedBranchProfit,
        };
    };
    createTransaction = async ({ companyID, createdByID, data, }) => {
        const { employeeID, reportID, branchID, ...rest } = data;
        return db_1.prisma.transaction.create({
            data: {
                ...rest,
                company: { connect: { id: companyID } },
                createdBy: { connect: { id: createdByID } },
                ...(employeeID && { employee: { connect: { id: employeeID } } }),
                ...(reportID && { report: { connect: { id: reportID } } }),
                ...(branchID && { branch: { connect: { id: branchID } } }),
            },
            select: transactionSelect,
        });
    };
    getAllTransactionsPaginated = async ({ page, size, companyID, branchID, employeeID, type, approved, deleted, startDate, endDate, }, loggedInUser) => {
        const applyBranchScope = loggedInUser?.role === "COMPANY_MANAGER" || loggedInUser?.mainRepository;
        let myBranchId = loggedInUser?.branchId;
        if (loggedInUser?.role === "COMPANY_MANAGER") {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: loggedInUser.companyID,
                    mainRepository: true,
                },
                select: {
                    branchId: true,
                },
            });
            myBranchId = mainBranch?.branchId || loggedInUser?.branchId;
        }
        const where = {
            companyId: companyID,
            employeeId: employeeID,
            type: type,
            deleted: deleted ?? false,
            ...((startDate || endDate) && {
                createdAt: {
                    ...(startDate && { gte: startDate }),
                    ...(endDate && { lte: endDate }),
                },
            }),
            ...(applyBranchScope
                ? {
                    approvedforMain: approved,
                    OR: [
                        { branchId: myBranchId },
                        {
                            report: {
                                type: "BRANCH",
                                branchReport: { forChildBranches: false },
                            },
                        },
                    ],
                }
                : {
                    approved,
                    branchId: branchID,
                }),
        };
        const [transactions, count] = await Promise.all([
            db_1.prisma.transaction.findMany({
                skip: (page - 1) * size,
                take: size,
                where,
                orderBy: { createdAt: "desc" },
                select: transactionSelect,
            }),
            db_1.prisma.transaction.count({ where }),
        ]);
        // When branch-scoped, flip DEPOSIT<->WITHDRAW for BRANCH-report transactions
        const reformedTransactions = applyBranchScope
            ? transactions.map((t) => {
                if (t.report?.type === "BRANCH") {
                    return {
                        ...t,
                        type: t.type === "DEPOSIT"
                            ? "WITHDRAW"
                            : t.type === "WITHDRAW"
                                ? "DEPOSIT"
                                : t.type,
                    };
                }
                return t;
            })
            : transactions;
        return {
            transactions: reformedTransactions,
            pagesCount: Math.ceil(count / size),
        };
    };
    getAllDailyProfits = async (params) => {
        const { page, size, companyId, branchId, startDay, endDay } = params;
        const where = {
            companyId,
            ...(branchId !== undefined && { branchId }),
            ...((startDay || endDay) && {
                day: {
                    ...(startDay && { gte: startDay }),
                    ...(endDay && { lte: endDay }),
                },
            }),
        };
        const [dailyProfits, count, totals] = await Promise.all([
            db_1.prisma.dailyProfit.findMany({
                skip: (page - 1) * size,
                take: size,
                where,
                orderBy: [{ day: "desc" }, { branchId: "asc" }],
                select: {
                    id: true,
                    day: true,
                    totalProfit: true,
                    insideProfit: true,
                    receiviedProfit: true,
                    forwardedProfit: true,
                    insideCount: true,
                    receiviedCount: true,
                    forwardedCount: true,
                    branch: { select: { id: true, name: true } },
                },
            }),
            db_1.prisma.dailyProfit.count({ where }),
            // grand totals across the whole filtered range
            db_1.prisma.dailyProfit.aggregate({
                where,
                _sum: {
                    totalProfit: true,
                    insideProfit: true,
                    receiviedProfit: true,
                    forwardedProfit: true,
                    insideCount: true,
                    receiviedCount: true,
                    forwardedCount: true,
                },
            }),
        ]);
        return {
            dailyProfits,
            pagesCount: Math.ceil(count / size),
            totals: {
                totalProfit: totals._sum.totalProfit ?? 0,
                insideProfit: totals._sum.insideProfit ?? 0,
                receiviedProfit: totals._sum.receiviedProfit ?? 0,
                forwardedProfit: totals._sum.forwardedProfit ?? 0,
                insideCount: totals._sum.insideCount ?? 0,
                receiviedCount: totals._sum.receiviedCount ?? 0,
                forwardedCount: totals._sum.forwardedCount ?? 0,
            },
        };
    };
    async getStatistics(filters) {
        const applyBranchScope = filters.loggedInUser?.role === "COMPANY_MANAGER" ||
            filters.loggedInUser?.mainRepository;
        let myBranchId = filters.loggedInUser?.branchId;
        if (filters.loggedInUser?.role === "COMPANY_MANAGER") {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: filters.loggedInUser.companyID,
                    mainRepository: true,
                },
                select: {
                    branchId: true,
                },
            });
            myBranchId = mainBranch?.branchId;
        }
        let startDate = new Date();
        let endDate = new Date();
        if (filters.start_date) {
            startDate = new Date(filters.start_date);
            startDate.setHours(0, 0, 0, 0);
        }
        if (filters.end_date) {
            endDate = new Date(filters.end_date);
            endDate.setHours(23, 59, 59, 59);
        }
        // built once, reused — identical semantics to the inline versions
        const createdAtFilter = filters.start_date || filters.end_date
            ? {
                ...(filters.start_date && { gt: startDate }),
                ...(filters.end_date && { lte: endDate }),
            }
            : undefined;
        const [totalDepoist, totalWithdraw, receivedFromAgents, notReceived, forClients, paidToClients, insideBranchNet, receivedBranchNet, forwardedBranchNet,] = await Promise.all([
            db_1.prisma.transaction.aggregate({
                _sum: { paidAmount: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    ...(applyBranchScope
                        ? {
                            approvedforMain: true,
                            OR: [
                                { branchId: myBranchId, type: "DEPOSIT" },
                                {
                                    type: "WITHDRAW",
                                    report: {
                                        type: "BRANCH",
                                        branchReport: { type: "received", forChildBranches: false },
                                    },
                                },
                            ],
                        }
                        : {
                            approved: true,
                            type: "DEPOSIT",
                            branchId: filters.loggedInUser?.branchId,
                        }),
                },
            }),
            db_1.prisma.transaction.aggregate({
                _sum: { paidAmount: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    ...(applyBranchScope
                        ? {
                            approvedforMain: true,
                            OR: [
                                { branchId: myBranchId, type: "WITHDRAW" },
                                {
                                    type: "DEPOSIT",
                                    report: {
                                        type: "BRANCH",
                                        branchReport: {
                                            type: "forwarded",
                                            forChildBranches: false,
                                        },
                                    },
                                },
                            ],
                        }
                        : {
                            approved: true,
                            type: "WITHDRAW",
                            branchId: filters.loggedInUser?.branchId,
                        }),
                },
            }),
            db_1.prisma.order.aggregate({
                _sum: { paidAmount: true, deliveryAgentNet: true },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    branchId: myBranchId,
                    deliveryAgentId: filters.deliveryAgentId,
                    ...(createdAtFilter && { createdAt: createdAtFilter }),
                    deliveryAgentReport: {
                        report: { deleted: false, activeProfit: true },
                    },
                },
            }),
            db_1.prisma.order.aggregate({
                _sum: { paidAmount: true },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                    branchId: myBranchId,
                    deliveryAgent: {
                        branchId: myBranchId,
                    },
                    ...(createdAtFilter && { createdAt: createdAtFilter }),
                    OR: [
                        { deliveryAgentReport: { is: null } },
                        { deliveryAgentReport: { report: { deleted: true } } },
                    ],
                },
            }),
            db_1.prisma.order.aggregate({
                _sum: { paidAmount: true, deliveryCost: true },
                _count: { id: true },
                where: {
                    companyId: filters.loggedInUser?.companyID || undefined,
                    deleted: false,
                    confirmed: true,
                    status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                    clientId: filters.clientId,
                    client: { branchId: myBranchId },
                    hasDeliveredClientReport: false,
                },
            }),
            db_1.prisma.report.aggregate({
                _sum: {
                    clientNet: true,
                    baghdadOrdersCount: true,
                    governoratesOrdersCount: true,
                },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    ...(createdAtFilter && { createdAt: createdAtFilter }),
                    clientReport: {
                        clientId: filters.clientId,
                        client: { branchId: myBranchId },
                        secondaryType: "DELIVERED",
                        report: {
                            deleted: false,
                            activeProfit: true,
                            transaction: applyBranchScope
                                ? {
                                    deleted: false,
                                    approvedforMain: true,
                                }
                                : {
                                    deleted: false,
                                    approved: true,
                                },
                        },
                    },
                },
            }),
            applyBranchScope
                ? db_1.prisma.order.aggregate({
                    _sum: {
                        paidAmount: true,
                        forwardedBranchNet: true,
                        receivingBranchNet: true,
                        deliveryAgentNet: true,
                        insideBranchNet: true,
                    },
                    _count: { id: true },
                    where: {
                        companyId: filters.companyId,
                        deleted: false,
                        confirmed: true,
                        client: {
                            branchId: { not: myBranchId },
                        },
                        ...(createdAtFilter && { createdAt: createdAtFilter }),
                        AND: [
                            {
                                branchReport: {
                                    some: {
                                        type: "received",
                                        report: {
                                            deleted: false,
                                            activeProfit: true,
                                            transaction: { deleted: false, approvedforMain: true },
                                        },
                                    },
                                },
                            },
                            {
                                branchReport: {
                                    some: {
                                        type: "forwarded",
                                        report: {
                                            deleted: false,
                                            activeProfit: true,
                                            transaction: { deleted: false, approvedforMain: true },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                })
                : db_1.prisma.order.aggregate({
                    _sum: {
                        paidAmount: true,
                        forwardedBranchNet: true,
                        receivingBranchNet: true,
                        deliveryAgentNet: true,
                        insideBranchNet: true,
                    },
                    _count: { id: true },
                    where: {
                        companyId: filters.companyId,
                        deleted: false,
                        confirmed: true,
                        branchId: filters.loggedInUser?.branchId,
                        client: {
                            branchId: filters.loggedInUser?.branchId,
                        },
                        ...(createdAtFilter && { createdAt: createdAtFilter }),
                        clientReport: {
                            some: {
                                clientId: filters.clientId,
                                secondaryType: "DELIVERED",
                                report: {
                                    deleted: false,
                                    activeProfit: true,
                                    transaction: {
                                        deleted: false,
                                        approved: true,
                                    },
                                },
                            },
                        },
                    },
                }),
            db_1.prisma.order.aggregate({
                _sum: { receivingBranchNet: true, deliveryAgentNet: true },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    ...(createdAtFilter && { createdAt: createdAtFilter }),
                    branchReport: {
                        some: {
                            branchId: filters.loggedInUser?.branchId,
                            type: "received",
                            report: {
                                deleted: false,
                                activeProfit: true,
                                transaction: {
                                    deleted: false,
                                    approvedforMain: true,
                                },
                            },
                        },
                    },
                },
            }),
            db_1.prisma.order.aggregate({
                _sum: {
                    forwardedBranchNet: true,
                    clientNet: true,
                    deliveryCost: true,
                    receivingBranchNet: true,
                    deliveryAgentNet: true,
                },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    ...(createdAtFilter && { createdAt: createdAtFilter }),
                    ...(applyBranchScope
                        ? {
                            client: {
                                branchId: myBranchId,
                            },
                            branchReport: {
                                some: {
                                    type: "received",
                                    report: {
                                        deleted: false,
                                        activeProfit: true,
                                        transaction: {
                                            deleted: false,
                                            approvedforMain: true,
                                        },
                                    },
                                },
                            },
                        }
                        : {
                            branchReport: {
                                some: {
                                    branchId: filters.loggedInUser?.branchId,
                                    type: "forwarded",
                                    report: {
                                        deleted: false,
                                        activeProfit: true,
                                        transaction: {
                                            deleted: false,
                                            approved: true,
                                        },
                                    },
                                },
                            },
                        }),
                },
            }),
        ]);
        return {
            totalDepoist: totalDepoist._sum.paidAmount,
            totalWithdraw: totalWithdraw._sum.paidAmount,
            total: (totalDepoist._sum.paidAmount ?? 0) -
                (totalWithdraw._sum.paidAmount ?? 0),
            receivedFromAgents: {
                total: (receivedFromAgents._sum.paidAmount ?? 0) -
                    (receivedFromAgents._sum.deliveryAgentNet ?? 0),
                count: receivedFromAgents._count.id,
            },
            agentProfit: {
                total: receivedFromAgents._sum.deliveryAgentNet,
                count: receivedFromAgents._count.id,
            },
            notReceived: {
                total: notReceived._sum.paidAmount,
                count: notReceived._count.id,
            },
            forClients: {
                total: (forClients._sum.paidAmount ?? 0) -
                    (forClients._sum.deliveryCost ?? 0),
                count: forClients._count.id,
            },
            paidToClients: {
                total: paidToClients._sum.clientNet,
                count: (paidToClients._sum.baghdadOrdersCount ?? 0) +
                    (paidToClients._sum.governoratesOrdersCount ?? 0),
            },
            insideBranchNet: applyBranchScope
                ? {
                    total: (insideBranchNet._sum.forwardedBranchNet ?? 0) -
                        (insideBranchNet._sum.receivingBranchNet ?? 0),
                    count: insideBranchNet._count.id,
                }
                : {
                    total: insideBranchNet._sum.insideBranchNet,
                    count: insideBranchNet._count.id,
                },
            receivedBranchNet: {
                total: (receivedBranchNet._sum.receivingBranchNet ?? 0) -
                    (receivedBranchNet._sum.deliveryAgentNet ?? 0),
                count: receivedBranchNet._count.id,
            },
            forwardedBranchNet: applyBranchScope
                ? {
                    total: (forwardedBranchNet._sum.deliveryCost ?? 0) -
                        (forwardedBranchNet._sum.receivingBranchNet ?? 0),
                    count: forwardedBranchNet._count.id,
                }
                : {
                    total: (forwardedBranchNet._sum.deliveryCost ?? 0) -
                        (forwardedBranchNet._sum.forwardedBranchNet ?? 0),
                    count: forwardedBranchNet._count.id,
                },
        };
    }
    async getDailyStatistics(filters) {
        const applyBranchScope = filters.loggedInUser?.role === "COMPANY_MANAGER" ||
            filters.loggedInUser?.mainRepository;
        let myBranchId = filters.loggedInUser?.branchId;
        if (filters.loggedInUser?.role === "COMPANY_MANAGER") {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: filters.loggedInUser.companyID,
                    mainRepository: true,
                },
                select: {
                    branchId: true,
                },
            });
            myBranchId = mainBranch?.branchId;
        }
        let startDate = new Date();
        let endDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 59);
        // built once, reused — identical semantics to the inline versions
        const createdAtFilter = {
            gt: startDate,
            lte: endDate,
        };
        const [totalDepoist, totalWithdraw, receivedFromAgents, paidToClients, insideBranchNet, receivedBranchNet, forwardedBranchNet,] = await Promise.all([
            db_1.prisma.transaction.aggregate({
                _sum: { paidAmount: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    ...(applyBranchScope
                        ? {
                            approvedforMain: false,
                            OR: [
                                { branchId: myBranchId, type: "DEPOSIT" },
                                {
                                    type: "WITHDRAW",
                                    report: {
                                        type: "BRANCH",
                                        branchReport: { type: "received", forChildBranches: false },
                                    },
                                },
                            ],
                        }
                        : {
                            approved: false,
                            type: "DEPOSIT",
                            branchId: filters.loggedInUser?.branchId,
                        }),
                },
            }),
            db_1.prisma.transaction.aggregate({
                _sum: { paidAmount: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    ...(applyBranchScope
                        ? {
                            approvedforMain: false,
                            OR: [
                                { branchId: myBranchId, type: "WITHDRAW" },
                                {
                                    type: "DEPOSIT",
                                    report: {
                                        type: "BRANCH",
                                        branchReport: {
                                            type: "forwarded",
                                            forChildBranches: false,
                                        },
                                    },
                                },
                            ],
                        }
                        : {
                            approvedforMain: false,
                            type: "WITHDRAW",
                            branchId: filters.loggedInUser?.branchId,
                        }),
                },
            }),
            db_1.prisma.report.aggregate({
                _sum: {
                    paidAmount: true,
                    deliveryAgentNet: true,
                    baghdadOrdersCount: true,
                    governoratesOrdersCount: true,
                },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    activeProfit: true,
                    createdAt: createdAtFilter,
                    deliveryAgentReport: {
                        deliveryAgent: {
                            branchId: myBranchId,
                        },
                    },
                    transaction: applyBranchScope
                        ? {
                            deleted: false,
                            approvedforMain: false,
                        }
                        : {
                            deleted: false,
                            approved: false,
                        },
                },
            }),
            db_1.prisma.report.aggregate({
                _sum: {
                    clientNet: true,
                    baghdadOrdersCount: true,
                    governoratesOrdersCount: true,
                },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    createdAt: createdAtFilter,
                    activeProfit: true,
                    clientReport: {
                        clientId: filters.clientId,
                        client: { branchId: filters.loggedInUser?.branchId },
                        secondaryType: "DELIVERED",
                        report: { deleted: false, activeProfit: true },
                    },
                    transaction: applyBranchScope
                        ? {
                            deleted: false,
                            approvedforMain: false,
                        }
                        : {
                            deleted: false,
                            approved: false,
                        },
                },
            }),
            applyBranchScope
                ? db_1.prisma.order.aggregate({
                    _sum: {
                        paidAmount: true,
                        forwardedBranchNet: true,
                        receivingBranchNet: true,
                        deliveryAgentNet: true,
                        insideBranchNet: true,
                    },
                    _count: { id: true },
                    where: {
                        companyId: filters.companyId,
                        deleted: false,
                        confirmed: true,
                        client: {
                            branchId: { not: myBranchId },
                        },
                        AND: [
                            {
                                branchReport: {
                                    some: {
                                        type: "received",
                                        report: {
                                            deleted: false,
                                            activeProfit: true,
                                            transaction: { deleted: false, approvedforMain: false },
                                        },
                                    },
                                },
                            },
                            {
                                branchReport: {
                                    some: {
                                        type: "forwarded",
                                        report: {
                                            deleted: false,
                                            activeProfit: true,
                                            transaction: { deleted: false, approvedforMain: false },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                })
                : db_1.prisma.order.aggregate({
                    _sum: {
                        paidAmount: true,
                        forwardedBranchNet: true,
                        receivingBranchNet: true,
                        deliveryAgentNet: true,
                        insideBranchNet: true,
                    },
                    _count: { id: true },
                    where: {
                        companyId: filters.companyId,
                        deleted: false,
                        confirmed: true,
                        branchId: filters.loggedInUser?.branchId,
                        client: {
                            branchId: filters.loggedInUser?.branchId,
                        },
                        clientReport: {
                            some: {
                                clientId: filters.clientId,
                                secondaryType: "DELIVERED",
                                report: {
                                    deleted: false,
                                    activeProfit: true,
                                    transaction: {
                                        deleted: false,
                                        approved: false,
                                    },
                                },
                            },
                        },
                    },
                }),
            db_1.prisma.order.aggregate({
                _sum: { receivingBranchNet: true, deliveryAgentNet: true },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    branchReport: {
                        some: {
                            branchId: filters.loggedInUser?.branchId,
                            type: "received",
                            report: {
                                deleted: false,
                                activeProfit: true,
                                transaction: {
                                    deleted: false,
                                    approvedforMain: false,
                                },
                            },
                        },
                    },
                },
            }),
            db_1.prisma.order.aggregate({
                _sum: {
                    forwardedBranchNet: true,
                    clientNet: true,
                    deliveryCost: true,
                    receivingBranchNet: true,
                    deliveryAgentNet: true,
                },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    ...(applyBranchScope
                        ? {
                            client: {
                                branchId: myBranchId,
                            },
                            branchReport: {
                                some: {
                                    type: "received",
                                    report: {
                                        deleted: false,
                                        activeProfit: true,
                                        transaction: {
                                            deleted: false,
                                            approvedforMain: false,
                                        },
                                    },
                                },
                            },
                        }
                        : {
                            branchReport: {
                                some: {
                                    branchId: filters.loggedInUser?.branchId,
                                    type: "forwarded",
                                    report: {
                                        deleted: false,
                                        activeProfit: true,
                                        transaction: {
                                            deleted: false,
                                            approved: false,
                                        },
                                    },
                                },
                            },
                        }),
                },
            }),
        ]);
        return {
            totalDepoist: totalDepoist._sum.paidAmount,
            totalWithdraw: totalWithdraw._sum.paidAmount,
            total: (totalDepoist._sum.paidAmount ?? 0) -
                (totalWithdraw._sum.paidAmount ?? 0),
            receivedFromAgents: {
                total: (receivedFromAgents._sum.paidAmount ?? 0) -
                    (receivedFromAgents._sum.deliveryAgentNet ?? 0),
                count: (receivedFromAgents._sum.baghdadOrdersCount ?? 0) +
                    (receivedFromAgents._sum.governoratesOrdersCount ?? 0),
            },
            agentProfit: {
                total: receivedFromAgents._sum.deliveryAgentNet,
                count: (receivedFromAgents._sum.baghdadOrdersCount ?? 0) +
                    (receivedFromAgents._sum.governoratesOrdersCount ?? 0),
            },
            notReceived: {
                total: 0,
                count: 0,
            },
            forClients: {
                total: 0,
                count: 0,
            },
            paidToClients: {
                total: paidToClients._sum.clientNet,
                count: (paidToClients._sum.baghdadOrdersCount ?? 0) +
                    (paidToClients._sum.governoratesOrdersCount ?? 0),
            },
            insideBranchNet: applyBranchScope
                ? {
                    total: (insideBranchNet._sum.forwardedBranchNet ?? 0) -
                        (insideBranchNet._sum.receivingBranchNet ?? 0),
                    count: insideBranchNet._count.id,
                }
                : {
                    total: insideBranchNet._sum.insideBranchNet,
                    count: insideBranchNet._count.id,
                },
            receivedBranchNet: {
                total: (receivedBranchNet._sum.receivingBranchNet ?? 0) -
                    (receivedBranchNet._sum.deliveryAgentNet ?? 0),
                count: receivedBranchNet._count.id,
            },
            forwardedBranchNet: applyBranchScope
                ? {
                    total: (forwardedBranchNet._sum.deliveryCost ?? 0) -
                        (forwardedBranchNet._sum.receivingBranchNet ?? 0),
                    count: forwardedBranchNet._count.id,
                }
                : {
                    total: (forwardedBranchNet._sum.deliveryCost ?? 0) -
                        (forwardedBranchNet._sum.forwardedBranchNet ?? 0),
                    count: forwardedBranchNet._count.id,
                },
        };
    }
    async getDailyProfit(filters) {
        const applyBranchScope = filters.loggedInUser?.role === "COMPANY_MANAGER" ||
            filters.loggedInUser?.mainRepository;
        let myBranchId = filters.loggedInUser?.branchId;
        if (filters.loggedInUser?.role === "COMPANY_MANAGER") {
            const mainBranch = await db_1.prisma.repository.findFirst({
                where: {
                    companyId: filters.loggedInUser.companyID,
                    mainRepository: true,
                },
                select: {
                    branchId: true,
                },
            });
            myBranchId = mainBranch?.branchId;
        }
        let startDate = new Date();
        let endDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 59);
        const baseParams = {
            companyId: filters.companyId,
            myBranchId: myBranchId,
            applyBranchScope: applyBranchScope,
        };
        const [today] = await Promise.all([
            this.computeProfit({
                ...baseParams,
                dateFilter: { gte: startDate, lt: endDate },
            }),
        ]);
        return { today };
    }
    getTransaction = async ({ transactionID }) => {
        return db_1.prisma.transaction.findUnique({
            where: { id: transactionID },
            select: transactionSelect,
        });
    };
    approveAllBranchTransactions = async ({ branchID, companyID, loggedInUser, }) => {
        const applyBranchScope = loggedInUser?.role === "COMPANY_MANAGER" || loggedInUser?.mainRepository;
        if (applyBranchScope) {
            const result = await db_1.prisma.transaction.updateMany({
                where: {
                    companyId: companyID,
                    approvedforMain: false,
                    deleted: false,
                },
                data: { approvedforMain: true },
            });
            return { approvedCount: result.count };
        }
        const result = await db_1.prisma.transaction.updateMany({
            where: {
                branchId: branchID,
                companyId: companyID,
                approved: false,
                deleted: false,
            },
            data: { approved: true },
        });
        return { approvedCount: result.count };
    };
    updateTransaction = async ({ transactionID, data, }) => {
        const { employeeID, reportID, branchID, ...rest } = data;
        return db_1.prisma.transaction.update({
            where: { id: transactionID },
            data: {
                ...rest,
                ...(employeeID && { employee: { connect: { id: employeeID } } }),
                ...(reportID && { report: { connect: { id: reportID } } }),
                ...(branchID && { branch: { connect: { id: branchID } } }),
            },
            select: transactionSelect,
        });
    };
    approveTransaction = async ({ transactionID }) => {
        return db_1.prisma.transaction.update({
            where: { id: transactionID },
            data: { approved: true },
            select: transactionSelect,
        });
    };
    deleteTransaction = async ({ transactionID }) => {
        return db_1.prisma.transaction.update({
            where: { id: transactionID },
            data: { deleted: true },
            select: { id: true },
        });
    };
    approveAllPendingTransactions = async () => {
        const result = await db_1.prisma.transaction.updateMany({
            where: {
                approved: false,
                deleted: false,
            },
            data: { approved: true },
        });
        await db_1.prisma.transaction.updateMany({
            where: {
                approvedforMain: false,
                deleted: false,
            },
            data: { approvedforMain: true },
        });
        return { approvedCount: result.count };
    };
}
exports.TransactionsRepository = TransactionsRepository;
//# sourceMappingURL=transaction.repository.js.map