import type { Prisma } from "@prisma/client";

export const receivingReportSelect = {
    id: true,
    createdAt: true,
    ordersCount: true,
    baghdadOrdersCount: true,
    governoratesOrdersCount: true,
    totalCost: true,
    client: { select: { id: true, user: { select: { name: true, phone: true } } } },
    receivingAgent: { select: { id: true, user: { select: { name: true } } } }
} satisfies Prisma.ReceivingReportSelect;

type ReceivingReportRow = Prisma.ReceivingReportGetPayload<{ select: typeof receivingReportSelect }>;

export const receivingReportReform = (report: ReceivingReportRow) => ({
    id: report.id,
    createdAt: report.createdAt,
    ordersCount: report.ordersCount,
    baghdadOrdersCount: report.baghdadOrdersCount,
    governoratesOrdersCount: report.governoratesOrdersCount,
    totalCost: report.totalCost,
    client: { id: report.client.id, name: report.client.user.name, phone: report.client.user.phone },
    receivingAgent: report.receivingAgent
        ? { id: report.receivingAgent.id, name: report.receivingAgent.user.name }
        : null
});
