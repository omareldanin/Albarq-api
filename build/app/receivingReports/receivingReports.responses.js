"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receivingReportReform = exports.receivingReportSelect = void 0;
exports.receivingReportSelect = {
    id: true,
    createdAt: true,
    ordersCount: true,
    baghdadOrdersCount: true,
    governoratesOrdersCount: true,
    totalCost: true,
    client: { select: { id: true, user: { select: { name: true, phone: true } } } },
    receivingAgent: { select: { id: true, user: { select: { name: true } } } }
};
const receivingReportReform = (report) => ({
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
exports.receivingReportReform = receivingReportReform;
//# sourceMappingURL=receivingReports.responses.js.map