import assert from "node:assert/strict";
import {after, afterEach, beforeEach, mock, test} from "node:test";
import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {ZodError} from "zod";
import {prisma} from "../src/database/db";
import {AppError} from "../src/lib/AppError";
import type {loggedInUserType} from "../src/types/user";
import {ReportsRepository} from "../src/app/reports/reports.repository";
import {AllreportSelect, reportSelect} from "../src/app/reports/reports.responses";

// Exercise the actual route/auth/controller/service/repository without starting
// the legacy server, browser, notification services, or a live database.
const moduleRestorers: Array<() => void> = [];
function stubModule(name: string, exports: object) {
  const id = require.resolve(name);
  const previous = require.cache[id];
  require.cache[id] = {id, filename: id, loaded: true, exports} as NodeJS.Module;
  moduleRestorers.push(() => {
    if (previous) require.cache[id] = previous;
    else delete require.cache[id];
  });
}
stubModule("../src/config", {env: {ACCESS_TOKEN_SECRET: "report-delivery-test-secret"}});
stubModule("../src/app/orders/orders.repository", {OrdersRepository: class {}});
stubModule("../src/app/employees/employees.repository", {EmployeesRepository: class {}});
stubModule("../src/app/notifications/helpers/sendNotification", {
  sendNotification: () => {throw new Error("Unexpected notification");},
});
for (const name of ["generateReport", "generateReportReceipt", "generateReportsReport", "generateBranchClientsReport"]) {
  stubModule(`../src/app/reports/helpers/${name}`, {});
}
const routes = require("../src/app/reports/reports.routes").default;

const agent: loggedInUserType = {
  id: 20, name: "مندوب الاستلام", username: "receiving-agent", role: "RECEIVING_AGENT",
  companyID: 1, companyName: "البرق", mainCompany: false,
  branchId: 10, clientId: 0, parentBranchId: 0, repositoryId: 0,
  mainRepository: false, showTreatury: false, permissions: [],
};
const originalTransaction = prisma.$transaction;
let transaction: ReturnType<typeof mock.fn>;
let update: ReturnType<typeof mock.fn>;
let find: ReturnType<typeof mock.fn>;
let findAgent: ReturnType<typeof mock.fn>;
let assignAgent: ReturnType<typeof mock.fn>;
const delivery = {
  id: 123, status: "UNPAID", confirmed: false, delivered: true,
  deliveredAt: new Date("2026-11-04T12:00:00.000Z"),
  clientReport: {
    receivingAgentId: agent.id,
    agent: {user: {id: agent.id, name: agent.name}},
  },
};
const expectedDelivery = {
  ...delivery,
  clientReport: {receivingAgentId: agent.id, agent: {id: agent.id, name: agent.name}},
};

beforeEach(() => {
  update = mock.fn(async () => ({count: 1}));
  find = mock.fn(async () => structuredClone(delivery));
  findAgent = mock.fn(async () => ({id: agent.id}));
  assignAgent = mock.fn(async () => ({id: delivery.id}));
  transaction = mock.fn(async (callback: (tx: object) => Promise<unknown>) =>
    callback({
      report: {updateMany: update, findFirst: find},
      employee: {findFirst: findAgent},
      clientReport: {update: assignAgent},
    }),
  );
  prisma.$transaction = transaction as typeof prisma.$transaction;
});
afterEach(() => {
  prisma.$transaction = originalTransaction;
  mock.restoreAll();
});
after(() => {for (const restore of moduleRestorers.reverse()) restore();});

function invokeDelivery({
  user = agent,
  reportID = "123",
  body,
}: {user?: loggedInUserType | null; reportID?: string; body?: unknown} = {}) {
  const route = routes.stack.find((layer: any) =>
    layer.route?.path === "/reports/:reportID/deliver" && layer.route.methods.patch,
  )?.route;
  assert.ok(route, "Missing PATCH delivery route");
  return new Promise<{status: number; body: any}>((resolve, reject) => {
    const req = {
      params: {reportID}, body, cookies: {},
      headers: user ? {authorization: `Bearer ${jwt.sign(user, "report-delivery-test-secret")}`} : {},
    } as unknown as Request;
    const res = {locals: {}, json: (response: unknown) => resolve({status: 200, body: response})} as Response;
    let index = 0;
    const next: NextFunction = (error?: unknown) => {
      if (error) {
        resolve({
          status: error instanceof ZodError ? 400 : error instanceof AppError ? error.statusCode : 500,
          body: error,
        });
        return;
      }
      const layer = route.stack[index++];
      if (!layer) {reject(new Error("Route did not produce a response")); return;}
      try {layer.handle(req, res, next);} catch (error) {reject(error);}
    };
    next();
  });
}

test("delivery requires authentication and the receiving-agent role", async () => {
  assert.equal((await invokeDelivery({user: null})).status, 401);
  for (const role of ["CLIENT", "DELIVERY_AGENT", "RECEIVING_AGENTS_MANAGER", "COMPANY_MANAGER", "ADMIN"] as const) {
    assert.equal((await invokeDelivery({user: {...agent, role}})).status, 403);
  }
  assert.equal(transaction.mock.callCount(), 0);
});

test("invalid IDs and attempts to set payment, confirmation, or audit fields never write", async () => {
  for (const reportID of ["0", "-1", "1.2", "1e2", "abc", "01", "2147483648"]) {
    assert.equal((await invokeDelivery({reportID})).status, 400);
  }
  for (const body of [
    {status: "PAID"}, {confirmed: true}, {delivered: false},
    {deliveredById: 99}, {deliveredAt: "2020-01-01"},
    {receivingAgentId: 99}, {agent: {connect: {id: 99}}},
    {companyID: 2}, {reportID: 321}, [], "123",
  ]) {
    assert.equal((await invokeDelivery({body})).status, 400);
  }
  assert.equal(transaction.mock.callCount(), 0);
});

test("missing or invalid authenticated identity and company context fail closed", async () => {
  for (const user of [
    {...agent, id: 0}, {...agent, id: -1}, {...agent, id: 1.5},
    {...agent, companyID: null}, {...agent, companyID: 0},
    {...agent, companyID: -1}, {...agent, companyID: undefined},
  ]) {
    assert.equal((await invokeDelivery({user: user as loggedInUserType})).status, 403);
  }
  assert.equal(transaction.mock.callCount(), 0);
});

test("valid scan records server-owned delivery without changing payment or confirmation", async () => {
  const before = new Date();
  const response = await invokeDelivery();
  const afterTime = new Date();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {status: "success", data: expectedDelivery});
  assert.equal(transaction.mock.callCount(), 1);
  const write = update.mock.calls[0].arguments[0];
  assert.deepEqual(Object.keys(write.data).sort(), ["delivered", "deliveredAt"]);
  assert.equal(write.data.delivered, true);
  assert.equal(assignAgent.mock.callCount(), 1);
  assert.deepEqual(assignAgent.mock.calls[0].arguments[0], {
    where: {id: 123}, data: {agent: {connect: {id: agent.id}}},
  });
  assert.ok(write.data.deliveredAt instanceof Date);
  assert.ok(write.data.deliveredAt >= before && write.data.deliveredAt <= afterTime);
  assert.equal(response.body.data.status, "UNPAID");
  assert.equal(response.body.data.confirmed, false);
});

test("delivery validates the active agent and scopes the report by company without requiring assignment", async () => {
  await invokeDelivery({body: {}});
  const scope = {
    id: 123, type: "CLIENT", companyId: 1, deleted: false,
  };
  assert.deepEqual(findAgent.mock.calls[0].arguments[0], {
    where: {id: 20, role: "RECEIVING_AGENT", companyId: 1, deleted: false},
    select: {id: true},
  });
  assert.deepEqual(update.mock.calls[0].arguments[0].where, {...scope, delivered: false});
  assert.deepEqual(find.mock.calls[0].arguments[0].where, scope);
});

test("missing or inaccessible reports return 404, including when already delivered", async () => {
  update.mock.mockImplementation(async () => ({count: 0}));
  find.mock.mockImplementation(async () => null);
  const response = await invokeDelivery();
  assert.equal(response.status, 404);
  assert.ok(response.body instanceof AppError);
  assert.equal(assignAgent.mock.callCount(), 0);
});

test("repeated delivery returns the original timestamp and actor, with paid/confirmed state intact", async () => {
  const originalAgent = {id: 7, name: "المندوب الأصلي"};
  const existing = {
    ...delivery, status: "PAID", confirmed: true,
    clientReport: {receivingAgentId: 7, agent: {user: originalAgent}},
  };
  update.mock.mockImplementation(async () => ({count: 0}));
  find.mock.mockImplementation(async () => existing);
  for (let i = 0; i < 2; i++) {
    const response = await invokeDelivery();
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      ...existing, clientReport: {receivingAgentId: 7, agent: originalAgent},
    });
  }
  assert.equal(assignAgent.mock.callCount(), 0);
  for (const call of update.mock.calls) assert.equal(call.arguments[0].where.delivered, false);
});

test("database failure propagates instead of reporting delivery success", async () => {
  update.mock.mockImplementation(async () => {throw new Error("Database unavailable");});
  assert.equal((await invokeDelivery()).status, 500);
  assert.equal(find.mock.callCount(), 0);
  assert.equal(assignAgent.mock.callCount(), 0);
});

test("inactive, removed, or company/role-changed agents cannot change a report", async () => {
  findAgent.mock.mockImplementation(async () => null);
  assert.equal((await invokeDelivery()).status, 403);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(assignAgent.mock.callCount(), 0);
});

test("agent assignment failure rejects the delivery transaction without reporting success", async () => {
  assignAgent.mock.mockImplementation(async () => {throw new Error("Assignment failed");});
  assert.equal((await invokeDelivery()).status, 500);
  assert.equal(transaction.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(find.mock.callCount(), 0);
});

test("report list and detail selectors expose clientReport.agent instead of deliveredBy", () => {
  for (const select of [AllreportSelect, reportSelect]) {
    assert.equal(select.delivered, true);
    assert.equal(select.deliveredAt, true);
    assert.equal("deliveredBy" in select, false);
    assert.equal(select.clientReport.select.receivingAgentId, true);
    assert.deepEqual(select.clientReport.select.agent, {select: {user: {select: {id: true, name: true}}}});
  }
});

test("direct repository access also rejects non-receiving agents", async () => {
  await assert.rejects(new ReportsRepository().deliverReport({
    reportID: 123, loggedInUser: {...agent, role: "COMPANY_MANAGER"},
  }), (error: unknown) => error instanceof AppError && error.statusCode === 403);
  assert.equal(transaction.mock.callCount(), 0);
});
