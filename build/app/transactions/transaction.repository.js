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
    getProfitOrders = async (params) => {
        const { companyId, myBranchId, bucket, applyBranchScope, startDay, endDay, page, size, clientId, storeId, deliveryAgentId, governorate, receivedBranch, forwardedBranch, receiptNumber, } = params;
        let startDate = new Date();
        let endDate = new Date();
        if (startDay) {
            startDate = new Date(startDay);
            startDate.setHours(0, 0, 0, 0);
        }
        else {
            if (applyBranchScope) {
                startDate = new Date("2026-08-09");
            }
            else {
                startDate = new Date("2026-08-07");
            }
            startDate.setHours(0, 0, 0, 0);
        }
        if (endDay) {
            endDate = new Date(endDay);
            endDate.setHours(23, 59, 59, 59);
        }
        // ---- the scoped "inside" bucket needs raw SQL ----
        if (bucket === "inside" && applyBranchScope) {
            const extraSql = client_1.Prisma.sql `
      ${endDay ? client_1.Prisma.sql `AND o."deliveriedAt" < ${endDate}` : client_1.Prisma.empty}
      ${clientId ? client_1.Prisma.sql `AND o."clientId" = ${clientId}` : client_1.Prisma.empty}
      ${storeId ? client_1.Prisma.sql `AND o."storeId" = ${storeId}` : client_1.Prisma.empty}
      ${deliveryAgentId ? client_1.Prisma.sql `AND o."deliveryAgentId" = ${deliveryAgentId}` : client_1.Prisma.empty}
      ${governorate ? client_1.Prisma.sql `AND o."governorate" = ${governorate}::"Governorate"` : client_1.Prisma.empty}
      ${receiptNumber ? client_1.Prisma.sql `AND o."receiptNumber" = ${receiptNumber}` : client_1.Prisma.empty}
      ${receivedBranch ? client_1.Prisma.sql `AND o."branchId" = ${receivedBranch}` : client_1.Prisma.empty}
      ${forwardedBranch ? client_1.Prisma.sql `AND c."branchId" = ${forwardedBranch}` : client_1.Prisma.empty}
    `;
            const whereSql = client_1.Prisma.sql `
      o."companyId" = ${companyId}
      AND o."deleted" = false
      AND o."confirmed" = true
      AND o."deliveriedAt" IS NOT NULL
      AND o."deliveriedAt" >= ${startDate}
      AND o."status" IN ('DELIVERED','PARTIALLY_RETURNED','REPLACED')
      AND c."branchId" <> ${myBranchId}
      AND o."branchId" IS DISTINCT FROM c."branchId"
      ${extraSql}
    `;
            const [orders, aggRows] = await Promise.all([
                db_1.prisma.$queryRaw `
        SELECT
          o."id",
          o."receiptNumber",
          o."governorate",
          o."status",
          o."deliveriedAt",
          o."deliveryCost",
          o."paidAmount",
          o."insideBranchNet",
          o."receivingBranchNet",
          o."forwardedBranchNet",
          o."deliveryAgentNet",
          o."branchId",
          ob."name" AS "orderBranchName",
          c."branchId" AS "clientBranchId",
          cb."name"   AS "clientBranchName",
          u."name"    AS "clientName",
          s."name"    AS "storeName",
          au."name"   AS "deliveryAgentName"
        FROM "Order" o
        JOIN "Client" c  ON c."id" = o."clientId"
        LEFT JOIN "User" u    ON u."id" = c."id"
        LEFT JOIN "Branch" ob ON ob."id" = o."branchId"
        LEFT JOIN "Branch" cb ON cb."id" = c."branchId"
        LEFT JOIN "Store" s   ON s."id" = o."storeId"
        LEFT JOIN "User" au   ON au."id" = o."deliveryAgentId"
        WHERE ${whereSql}
        ORDER BY o."deliveriedAt" DESC
        LIMIT ${size} OFFSET ${(page - 1) * size};
      `,
                db_1.prisma.$queryRaw `
      SELECT
        COUNT(*)                    AS count,
        SUM(o."forwardedBranchNet") AS "forwardedBranchNet",
        SUM(o."receivingBranchNet") AS "receivingBranchNet",
        SUM(o."deliveryAgentNet")   AS "deliveryAgentNet",
        SUM(o."insideBranchNet")    AS "insideBranchNet",
        SUM(o."deliveryCost")       AS "deliveryCost"
      FROM "Order" o
      JOIN "Client" c ON c."id" = o."clientId"
      WHERE ${whereSql};
    `,
            ]);
            const a = aggRows[0];
            const n = (v) => Number(v ?? 0);
            const total = n(a.forwardedBranchNet) - n(a.receivingBranchNet);
            return {
                orders,
                pagesCount: Math.ceil(Number(a.count) / size),
                totals: {
                    total,
                    count: Number(a.count),
                },
            };
        }
        // ---- everything else stays in Prisma ----
        const base = {
            companyId,
            deleted: false,
            confirmed: true,
            status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
            deliveriedAt: {
                not: null,
                gte: startDate,
                ...(endDay && { lt: endDate }),
            },
            ...(clientId !== undefined && { clientId }),
            ...(storeId !== undefined && { storeId }),
            ...(deliveryAgentId !== undefined && { deliveryAgentId }),
            ...(governorate !== undefined && { governorate }),
            ...(receiptNumber !== undefined && { receiptNumber }),
        };
        const where = bucket === "received"
            ? { ...base, branchId: myBranchId, client: { branchId: { not: myBranchId } } }
            : bucket === "forwarded"
                ? {
                    ...base,
                    branchId: receivedBranch ? receivedBranch : { not: myBranchId },
                    client: { branchId: myBranchId },
                }
                : { ...base, branchId: myBranchId, client: { branchId: myBranchId } };
        const [orders, agg] = await Promise.all([
            db_1.prisma.order.findMany({
                skip: (page - 1) * size,
                take: size,
                where,
                orderBy: { deliveriedAt: "desc" },
                select: {
                    id: true,
                    receiptNumber: true,
                    governorate: true,
                    status: true,
                    deliveriedAt: true,
                    deliveryCost: true,
                    paidAmount: true,
                    insideBranchNet: true,
                    receivingBranchNet: true,
                    forwardedBranchNet: true,
                    deliveryAgentNet: true,
                    branch: { select: { id: true, name: true } },
                    store: { select: { id: true, name: true } },
                    deliveryAgent: { select: { id: true, user: { select: { name: true } } } },
                    client: {
                        select: {
                            id: true,
                            branchId: true,
                            user: { select: { name: true } },
                            branch: { select: { name: true } },
                        },
                    },
                },
            }),
            db_1.prisma.order.aggregate({
                where,
                _count: { id: true },
                _sum: {
                    insideBranchNet: true,
                    receivingBranchNet: true,
                    forwardedBranchNet: true,
                    deliveryAgentNet: true,
                    deliveryCost: true,
                },
            }),
        ]);
        const n = (v) => v ?? 0;
        const s = agg._sum;
        let total;
        if (bucket === "received") {
            total = n(s.receivingBranchNet) - n(s.deliveryAgentNet);
        }
        else if (bucket === "forwarded") {
            total = applyBranchScope
                ? n(s.deliveryCost) - n(s.receivingBranchNet)
                : n(s.deliveryCost) - n(s.forwardedBranchNet);
        }
        else {
            // inside, non-scoped (the scoped case returned earlier)
            total = n(s.insideBranchNet);
        }
        return {
            orders,
            pagesCount: Math.ceil(agg._count.id / size),
            totals: {
                total,
                count: agg._count.id,
            },
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
    getAllTransactionsPaginated = async ({ page, size, companyID, branchID, employeeID, type, approved, deleted, startDate, endDate, targetBranch, }, loggedInUser) => {
        let applyBranchScope = loggedInUser?.role === "COMPANY_MANAGER" || loggedInUser?.mainRepository;
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
        if (loggedInUser?.role === "COMPANY_MANAGER" &&
            loggedInUser.mainRepository &&
            targetBranch) {
            myBranchId = targetBranch;
            applyBranchScope = false;
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
        let childBranchs = [];
        let applyBranchScope = filters.loggedInUser?.role === "COMPANY_MANAGER" ||
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
        if (filters.loggedInUser?.role === "COMPANY_MANAGER" &&
            filters.loggedInUser.mainRepository &&
            filters.targetBranch) {
            myBranchId = filters.targetBranch;
            applyBranchScope = false;
        }
        const branchs = await db_1.prisma.branch.findMany({
            where: {
                parentBranchId: myBranchId,
            },
            select: {
                id: true,
            },
        });
        childBranchs = branchs.map((b) => b.id);
        const branchScope = [myBranchId, ...childBranchs].filter((id) => id != null);
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
                            branchId: myBranchId,
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
                            branchId: myBranchId,
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
                        branchId: myBranchId,
                        client: {
                            branchId: myBranchId,
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
                            branchId: myBranchId,
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
                                    branchId: myBranchId,
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
        //مبالغ مستحقه للفرع الرئيسي / مبالغ مستحقه عند الافرع
        const forMainBranchRows = applyBranchScope
            ? await db_1.prisma.$queryRaw `
      SELECT
        SUM(o."paidAmount")         AS "paidAmount",
        SUM(o."receivingBranchNet") AS "receivingBranchNet",
        SUM(o."forwardedBranchNet") AS "forwardedBranchNet",
        COUNT(o."id")               AS "count"
      FROM "Order" o
      JOIN "Client" c ON c."id" = o."clientId"
      WHERE o."companyId" = ${filters.companyId}
        AND o."deleted" = false
        AND o."confirmed" = true
        AND o."status" IN ('DELIVERED','PARTIALLY_RETURNED','REPLACED')
        AND o."hasMainReceivedReport" = false
        AND o."branchId" IS DISTINCT FROM c."branchId"
        ${createdAtFilter
                ? client_1.Prisma.sql `AND o."createdAt" >= ${createdAtFilter.gt} AND o."createdAt" < ${createdAtFilter.lte}`
                : client_1.Prisma.empty};
    `
            : null;
        const forMainBranch = applyBranchScope
            ? {
                _sum: {
                    paidAmount: forMainBranchRows[0].paidAmount
                        ? Number(forMainBranchRows[0].paidAmount)
                        : null,
                    receivingBranchNet: forMainBranchRows[0].receivingBranchNet
                        ? Number(forMainBranchRows[0].receivingBranchNet)
                        : null,
                    forwardedBranchNet: forMainBranchRows[0].forwardedBranchNet
                        ? Number(forMainBranchRows[0].forwardedBranchNet)
                        : null,
                },
                _count: { id: Number(forMainBranchRows[0].count) },
            }
            : await db_1.prisma.order.aggregate({
                _sum: {
                    paidAmount: true,
                    receivingBranchNet: true,
                    forwardedBranchNet: true,
                },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                    OR: [
                        {
                            AND: [
                                {
                                    client: {
                                        branchId: { notIn: branchScope },
                                    },
                                },
                                {
                                    branchId: { in: branchScope },
                                },
                            ],
                        },
                        {
                            AND: [
                                {
                                    branch: {
                                        id: myBranchId,
                                        governorate: "BAGHDAD",
                                        parentBranchId: { equals: null },
                                    },
                                },
                                {
                                    client: {
                                        branchId: myBranchId,
                                    },
                                },
                            ],
                        },
                    ],
                    hasMainReceivedReport: false,
                },
            });
        //مبالغ مستحقه عند الفرع الرئيسي / مبالغ مستحقه للأفرع
        const forMyBranchRows = applyBranchScope
            ? await db_1.prisma.$queryRaw `
          SELECT
            SUM(o."paidAmount")         AS "paidAmount",
            SUM(o."receivingBranchNet") AS "receivingBranchNet",
            SUM(o."forwardedBranchNet") AS "forwardedBranchNet",
            COUNT(o."id")               AS "count"
          FROM "Order" o
          JOIN "Client" c ON c."id" = o."clientId"
          WHERE o."companyId" = ${filters.companyId}
            AND o."deleted" = false
            AND o."confirmed" = true
            AND o."status" IN ('DELIVERED','PARTIALLY_RETURNED','REPLACED')
            AND o."hasMainForwardedReport" = false
            AND o."hasDeliveredClientReport" = true
            AND c."branchId" <> ${myBranchId}
            AND c."companyId" = 16
            AND o."branchId" IS DISTINCT FROM c."branchId"
            ${createdAtFilter
                ? client_1.Prisma.sql `AND o."createdAt" >= ${createdAtFilter.gt} AND o."createdAt" < ${createdAtFilter.lte}`
                : client_1.Prisma.empty};
          `
            : null;
        const forMyBranch = applyBranchScope
            ? {
                _sum: {
                    paidAmount: forMyBranchRows[0].paidAmount
                        ? Number(forMyBranchRows[0].paidAmount)
                        : null,
                    receivingBranchNet: forMyBranchRows[0].receivingBranchNet
                        ? Number(forMyBranchRows[0].receivingBranchNet)
                        : null,
                    forwardedBranchNet: forMyBranchRows[0].forwardedBranchNet
                        ? Number(forMyBranchRows[0].forwardedBranchNet)
                        : null,
                },
                _count: { id: Number(forMyBranchRows[0].count) },
            }
            : await db_1.prisma.order.aggregate({
                _sum: {
                    paidAmount: true,
                    forwardedBranchNet: true,
                    receivingBranchNet: true,
                },
                _count: { id: true },
                where: {
                    companyId: filters.companyId,
                    deleted: false,
                    confirmed: true,
                    status: { in: ["DELIVERED", "PARTIALLY_RETURNED", "REPLACED"] },
                    hasMainForwardedReport: false,
                    hasDeliveredClientReport: true,
                    OR: [
                        {
                            AND: [
                                { branchId: { notIn: branchScope } },
                                {
                                    client: {
                                        branchId: { in: branchScope },
                                    },
                                },
                            ],
                        },
                        {
                            AND: [
                                {
                                    branch: {
                                        id: myBranchId,
                                        governorate: "BAGHDAD",
                                        parentBranchId: { equals: null },
                                    },
                                },
                                {
                                    client: {
                                        branchId: myBranchId,
                                    },
                                },
                            ],
                        },
                    ],
                    ...(createdAtFilter && { createdAt: createdAtFilter }),
                },
            });
        return {
            totalDepoist: totalDepoist._sum.paidAmount,
            totalWithdraw: totalWithdraw._sum.paidAmount,
            forMainBranch: applyBranchScope
                ? {
                    total: (forMainBranch._sum.paidAmount ?? 0) -
                        (forMainBranch._sum.forwardedBranchNet ?? 0),
                    count: forMainBranch._count.id,
                }
                : {
                    total: (forMainBranch._sum.paidAmount ?? 0) -
                        (forMainBranch._sum.receivingBranchNet ?? 0),
                    count: forMainBranch._count.id,
                },
            forMyBranch: applyBranchScope
                ? {
                    total: (forMyBranch._sum.paidAmount ?? 0) -
                        (forMyBranch._sum.forwardedBranchNet ?? 0),
                    count: forMyBranch._count.id,
                }
                : {
                    total: (forMyBranch._sum.paidAmount ?? 0) -
                        (forMyBranch._sum.forwardedBranchNet ?? 0),
                    count: forMyBranch._count.id,
                },
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
        let applyBranchScope = filters.loggedInUser?.role === "COMPANY_MANAGER" ||
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
        if (filters.loggedInUser?.role === "COMPANY_MANAGER" &&
            filters.loggedInUser.mainRepository &&
            filters.targetBranch) {
            myBranchId = filters.targetBranch;
            applyBranchScope = false;
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
                            branchId: myBranchId,
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
                            branchId: myBranchId,
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
                        client: { branchId: myBranchId },
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
                        branchId: myBranchId,
                        client: {
                            branchId: myBranchId,
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
                            branchId: myBranchId,
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
                                    branchId: myBranchId,
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
        let applyBranchScope = filters.loggedInUser?.role === "COMPANY_MANAGER" ||
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
        if (filters.loggedInUser?.role === "COMPANY_MANAGER" &&
            filters.loggedInUser.mainRepository &&
            filters.targetBranch) {
            myBranchId = filters.targetBranch;
            applyBranchScope = false;
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