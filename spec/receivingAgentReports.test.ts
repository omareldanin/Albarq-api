import assert from "node:assert/strict";
import {after, afterEach, beforeEach, mock, test} from "node:test";
import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {ZodError} from "zod";
import {prisma} from "../src/database/db";
import {AppError} from "../src/lib/AppError";
import type {loggedInUserType} from "../src/types/user";
import {ReportsRepository} from "../src/app/reports/reports.repository";

const restorers: Array<() => void> = [];
function stubModule(name: string, exports: object) {
  const id = require.resolve(name);
  const previous = require.cache[id];
  require.cache[id] = {id, filename: id, loaded: true, exports} as NodeJS.Module;
  restorers.push(() => {if (previous) require.cache[id] = previous; else delete require.cache[id];});
}
stubModule("../src/config", {env: {ACCESS_TOKEN_SECRET: "receiving-report-list-test"}});
stubModule("../src/app/orders/orders.repository", {OrdersRepository: class {}});
stubModule("../src/app/employees/employees.repository", {EmployeesRepository: class {}});
stubModule("../src/app/notifications/helpers/sendNotification", {sendNotification: () => {throw new Error("Unexpected notification");}});
for (const name of ["generateReport", "generateReportReceipt", "generateReportsReport", "generateBranchClientsReport"]) {
  stubModule(`../src/app/reports/helpers/${name}`, {});
}
const routes = require("../src/app/reports/reports.routes").default;
const agent: loggedInUserType = {
  id: 20, name: "مندوب الاستلام", username: "agent", role: "RECEIVING_AGENT",
  companyID: 1, companyName: "البرق", mainCompany: false, branchId: 10,
  clientId: 0, parentBranchId: 0, repositoryId: 0, mainRepository: false,
  showTreatury: false, permissions: [],
};
const baseReport = {
  id: 123, type: "CLIENT", companyId: 1, deleted: false, deletedAt: null,
  confirmed: false, delivered: false, deliveredAt: null, status: "UNPAID",
  createdAt: new Date("2026-11-05T12:00:00Z"), updatedAt: new Date("2026-11-05T12:00:00Z"),
  createdBy: {branchId: 10, user: {id: 3, name: "ساحب الكشف"}},
  baghdadOrdersCount: 3, governoratesOrdersCount: 2,
  totalCost: 100, paidAmount: 0, deliveryCost: 20, clientNet: 80, deliveryAgentNet: 10, companyNet: 10,
  clientReport: {
    id: 123, receivingAgentId: 20, secondaryType: "DELIVERED",
    agent: {user: {id: 20, name: "مندوب الاستلام"}},
    client: {user: {id: 30, name: "عميل", phone: "07700000000"}, branch: {id: 11, name: "فرع آخر"}},
    store: {id: 4, name: "المتجر"}, baghdadDeliveryCost: 0, governoratesDeliveryCost: 0,
  },
};
const reports = [
  baseReport,
  {...baseReport, id: 124, clientReport: {...baseReport.clientReport, secondaryType: "RETURNED"}},
  {...baseReport, id: 125, confirmed: true},
  {...baseReport, id: 126, clientReport: {...baseReport.clientReport, receivingAgentId: 21}},
  {...baseReport, id: 127, companyId: 2},
  {...baseReport, id: 128, deleted: true},
  {...baseReport, id: 129, type: "BRANCH"},
  {...baseReport, id: 130, delivered: true},
];
function matching(where: any) {
  return reports.filter((report) =>
    report.companyId === where.companyId && report.type === where.type &&
    report.deleted === where.deleted && report.confirmed === where.confirmed &&
    report.clientReport.receivingAgentId === where.clientReport.receivingAgentId &&
    (!where.clientReport.secondaryType || report.clientReport.secondaryType === where.clientReport.secondaryType),
  ).sort((a, b) => b.id - a.id);
}
const original = {
  find: prisma.employee.findFirst,
  list: prisma.report.findManyPaginated,
  aggregate: prisma.report.aggregate,
};
let findAgent: ReturnType<typeof mock.fn>;
let list: ReturnType<typeof mock.fn>;
let aggregate: ReturnType<typeof mock.fn>;
beforeEach(() => {
  findAgent = mock.fn(async () => ({id: agent.id}));
  list = mock.fn(async ({where}: any, {page, size}: any) => {
    const rows = matching(where);
    return {data: rows.slice((page - 1) * size, page * size), pagesCount: Math.ceil(rows.length / size)};
  });
  aggregate = mock.fn(async ({where, _sum}: any) => {
    const rows = matching(where);
    return {_count: {id: rows.length}, _sum: Object.fromEntries(Object.keys(_sum).map((key) => [
      key, rows.length ? rows.reduce((total, row) => total + (row as any)[key], 0) : null,
    ]))};
  });
  prisma.employee.findFirst = findAgent as typeof prisma.employee.findFirst;
  prisma.report.findManyPaginated = list as typeof prisma.report.findManyPaginated;
  prisma.report.aggregate = aggregate as typeof prisma.report.aggregate;
});
afterEach(() => {
  prisma.employee.findFirst = original.find;
  prisma.report.findManyPaginated = original.list;
  prisma.report.aggregate = original.aggregate;
  mock.restoreAll();
});
after(() => {for (const restore of restorers.reverse()) restore();});

function invoke(query: Record<string, string> = {}, user: loggedInUserType | null = agent) {
  const route = routes.stack.find((layer: any) => layer.route?.path === "/reports" && layer.route.methods.get)?.route;
  assert.ok(route);
  return new Promise<{status: number; body: any}>((resolve, reject) => {
    const req = {query, cookies: {}, headers: user ? {authorization: `Bearer ${jwt.sign(user, "receiving-report-list-test")}`} : {}} as unknown as Request;
    let status = 200;
    const res = {locals: {}, status: (code: number) => {status = code; return res;}, json: (body: unknown) => resolve({status, body})} as Response;
    let index = 0;
    const next: NextFunction = (error?: unknown) => {
      if (error) {
        resolve({status: error instanceof ZodError ? 400 : error instanceof AppError ? error.statusCode : 500, body: error});
        return;
      }
      const layer = route.stack[index++];
      if (!layer) {reject(new Error("Missing response")); return;}
      try {layer.handle(req, res, next);} catch (error) {reject(error);}
    };
    next();
  });
}

test("GET reports requires authentication; malformed report subtypes fail validation", async () => {
  assert.equal((await invoke({}, null)).status, 401);
  assert.equal((await invoke({secondaryReportType: "OTHER"})).status, 400);
  assert.equal(list.mock.callCount(), 0);
});

test("delivered list is assigned, unconfirmed and company scoped regardless of client query filters", async () => {
  const result = await invoke({
    secondaryReportType: "DELIVERED", company: "2", company_id: "2", branch: "999",
    receiving_agent_id: "21", confirmed: "true", deleted: "true", type: "COMPANY", minified: "true",
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.reports.map((row: any) => row.id), [130, 123]);
  const where = list.mock.calls[0].arguments[0].where;
  assert.deepEqual(where, {
    type: "CLIENT", companyId: 1, deleted: false, confirmed: false,
    clientReport: {receivingAgentId: 20, secondaryType: "DELIVERED"},
  });
  assert.deepEqual(aggregate.mock.calls[0].arguments[0].where, where);
  assert.equal(result.body.data.reportsMetaData.reportsCount, 2);
  assert.equal(result.body.data.reportsMetaData.baghdadOrdersCount, 6);
  assert.equal(result.body.data.reportsMetaData.governoratesOrdersCount, 4);
  assert.equal(result.body.data.reports[0].clientReport.client.name, "عميل");
  assert.equal(result.body.data.reports[0].clientReport.agent.id, agent.id);
});

test("returned totals include returned reports and use the same query as the list", async () => {
  const result = await invoke({secondaryReportType: "RETURNED"});
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.reports.map((row: any) => row.id), [124]);
  assert.equal(result.body.data.reports[0].secondaryType, "RETURNED");
  assert.equal(result.body.data.reportsMetaData.reportsCount, 1);
  assert.equal(result.body.data.reportsMetaData.baghdadOrdersCount + result.body.data.reportsMetaData.governoratesOrdersCount, 5);
  assert.deepEqual(list.mock.calls[0].arguments[0].where, aggregate.mock.calls[0].arguments[0].where);
});

test("pagination returns distinct pages while metadata covers the entire filtered list", async () => {
  const first = await invoke({secondaryReportType: "DELIVERED", size: "1", page: "1"});
  const second = await invoke({secondaryReportType: "DELIVERED", size: "1", page: "2"});
  assert.deepEqual(first.body.data.reports.map((row: any) => row.id), [130]);
  assert.deepEqual(second.body.data.reports.map((row: any) => row.id), [123]);
  assert.equal(first.body.pagesCount, 2);
  assert.equal(second.body.page, 2);
  assert.deepEqual(first.body.data.reportsMetaData, second.body.data.reportsMetaData);
  await invoke({size: "999", page: "1.5"});
  assert.deepEqual(list.mock.calls[2].arguments[1], {page: 1, size: 100, withCount: true});
});

test("missing or inactive authenticated agents cannot read reports", async () => {
  for (const invalid of [{...agent, companyID: null}, {...agent, companyID: 0}, {...agent, id: 0}]) {
    assert.equal((await invoke({}, invalid as loggedInUserType)).status, 403);
  }
  findAgent.mock.mockImplementation(async () => null);
  assert.equal((await invoke()).status, 403);
  assert.equal(list.mock.callCount(), 0);
  assert.deepEqual(findAgent.mock.calls[0].arguments[0].where, {id: 20, companyId: 1, role: "RECEIVING_AGENT", deleted: false});
  await assert.rejects(new ReportsRepository().getReceivingAgentReportsPaginated({
    loggedInUser: {...agent, role: "DELIVERY_AGENT"}, filters: {page: 1, size: 20},
  }), (error: unknown) => error instanceof AppError && error.statusCode === 403);
});

test("an agent with no assigned reports gets an empty list and zero totals", async () => {
  const result = await invoke({}, {...agent, id: 99});
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.reports, []);
  assert.equal(result.body.data.reportsMetaData.reportsCount, 0);
  assert.equal(result.body.data.reportsMetaData.baghdadOrdersCount, 0);
  assert.equal(result.body.data.reportsMetaData.governoratesOrdersCount, 0);
});
