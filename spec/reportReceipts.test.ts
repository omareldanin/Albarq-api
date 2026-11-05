import assert from "node:assert/strict";
import {after, afterEach, beforeEach, mock, test} from "node:test";
import type {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";
import {ZodError} from "zod";
import {ReportReceiptParamsSchema} from "../src/app/reports/reports.dto";
import {ReportsRepository} from "../src/app/reports/reports.repository";
import {AllreportReform} from "../src/app/reports/reports.responses";
import {reportReceiptScope} from "../src/app/reports/helpers/reportReceiptScope";
import {prisma} from "../src/database/db";
import {AppError} from "../src/lib/AppError";
import type {loggedInUserType} from "../src/types/user";

// Keep these tests database/network/browser-free, including legacy service imports
// that otherwise start the server, Redis, Firebase, and the browser maintenance timer.
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
const pdfBytes = Buffer.from("%PDF-1.4\nreceipt-test");
const renderPDF = mock.fn(async (_html: string, _css?: string, _options?: object) => pdfBytes);
stubModule("../src/lib/generatePDF", {generatePDF: renderPDF});
stubModule("../src/config", {env: {ACCESS_TOKEN_SECRET: "report-receipt-test-secret"}});
stubModule("../src/app/orders/orders.repository", {OrdersRepository: class {}});
stubModule("../src/app/employees/employees.repository", {EmployeesRepository: class {}});
stubModule("../src/app/notifications/helpers/sendNotification", {sendNotification: () => {throw new Error("Unexpected notification");}});
for (const name of ["generateReport", "generateReportsReport", "generateBranchClientsReport"]) {
  stubModule(`../src/app/reports/helpers/${name}`, {[name]: () => {throw new Error("Unexpected full-report generation");}});
}

const {renderReportReceipt, reportReceiptDetails} = require("../src/app/reports/helpers/generateReportReceipt") as typeof import("../src/app/reports/helpers/generateReportReceipt");
const {ReportsService} = require("../src/app/reports/reports.service") as typeof import("../src/app/reports/reports.service");
const reportRoutes = require("../src/app/reports/reports.routes").default;

const manager: loggedInUserType = {
  id: 5, name: "ساحب الكشف", username: "manager", role: "COMPANY_MANAGER",
  companyID: 1, companyName: "البرق", mainCompany: false,
  branchId: 10, clientId: 0, parentBranchId: 0, repositoryId: 7,
  mainRepository: false, showTreatury: true, permissions: [],
};
const rawReport: NonNullable<Parameters<typeof AllreportReform>[0]> = {
  id: 123, type: "CLIENT", status: "UNPAID", confirmed: false,
  delivered: false, deliveredAt: null,
  createdAt: new Date("2026-11-04T21:30:00Z"), updatedAt: new Date("2026-11-04T21:30:00Z"),
  createdBy: {id: 5, branchId: 10, user: {id: 5, name: "ساحب الكشف الأصلي"}},
  baghdadOrdersCount: 12, governoratesOrdersCount: 8,
  totalCost: 900000, paidAmount: 850000, deliveryCost: 60000,
  clientNet: 790000, deliveryAgentNet: 40000, companyNet: 810000, branchNet: 800000,
  url: null, deleted: false, deletedAt: null, deletedBy: null,
  company: {id: 1, name: "شركة البرق", logo: ""},
  employeeReport: null, governorateReport: null,
  clientReport: {
    receivingAgentId: null, agent: null,
    id: 123, secondaryType: "DELIVERED", repository: null,
    client: {user: {id: 20, name: "أحمد محمد", phone: "07700000000"}, branch: {id: 10, name: "بغداد"}},
    store: {id: 4, name: "متجر النور"}, baghdadDeliveryCost: 0, governoratesDeliveryCost: 0,
  },
  branchReport: {id: 123, type: "forwarded", branch: {id: 10, name: "فرع بغداد"}, baghdadDeliveryCost: 0, governoratesDeliveryCost: 0},
  deliveryAgentReport: {id: 123, deliveryAgent: {user: {id: 30, name: "علي حسين"}}, deliveryAgentDeliveryCost: 0},
  companyReport: {id: 123, secondaryType: "DELIVERED", repository: null, company: {id: 2, name: "شركة التوصيل"}, baghdadDeliveryCost: 0, governoratesDeliveryCost: 0},
  repositoryReport: {id: 123, secondaryType: "DELIVERED", repository: {id: 7, name: "مخزن بغداد"}, targetRepositoryId: 8, targetRepositoryName: "مخزن البصرة"},
};
const receipt = (overrides: Partial<typeof rawReport> = {}) => AllreportReform(structuredClone({...rawReport, ...overrides}))!;
const repository = new ReportsRepository();
const service = new ReportsService();
const hasStatus = (status: number) => (error: unknown) => error instanceof AppError && error.statusCode === status;
const originalFind = prisma.report.findFirst;
let find: ReturnType<typeof mock.fn>;
beforeEach(() => {
  find = mock.fn(async () => rawReport);
  prisma.report.findFirst = find as typeof prisma.report.findFirst;
  renderPDF.mock.resetCalls();
});
afterEach(() => {
  prisma.report.findFirst = originalFind;
  mock.restoreAll();
});
after(() => { for (const restore of moduleRestorers.reverse()) restore(); });

test("receipt IDs are positive PostgreSQL integers, without coercion surprises", () => {
  for (const reportID of ["0", "-1", "1.5", "abc", "", " 1", "1e2", "0x10", "01", "2147483648", null, true, ["1"]]) {
    assert.equal(ReportReceiptParamsSchema.safeParse({reportID}).success, false);
  }
  assert.deepEqual(ReportReceiptParamsSchema.parse({reportID: "123"}), {reportID: 123});
});

for (const [type, label, name, amount] of [
  ["CLIENT", "العميل", "أحمد محمد", 790000],
  ["BRANCH", "الفرع", "فرع بغداد", 800000],
  ["DELIVERY_AGENT", "المندوب", "علي حسين", 810000],
  ["COMPANY", "الشركة", "شركة التوصيل", 810000],
  ["REPOSITORY", "المخزن", "مخزن بغداد", 790000],
] as const) {
  test(`${type} receipt uses the correct party and saved settlement amount`, () => {
    const details = reportReceiptDetails(receipt({type}));
    assert.equal(details.label, label);
    assert.equal(details.name, name);
    assert.equal(details.amount, amount);
  });
}

test("zero and negative saved totals are retained; unsupported report types fail", () => {
  assert.equal(reportReceiptDetails(receipt({clientNet: 0})).amount, 0);
  assert.equal(reportReceiptDetails(receipt({clientNet: -5000})).amount, -5000);
  for (const type of ["EMPLOYEE", "GOVERNORATE"] as const) {
    assert.throws(() => reportReceiptDetails(receipt({type})), hasStatus(400));
  }
});

test("Arabic HTML embeds assets, escapes names, and uses the original creator and Baghdad date", async () => {
  const report = receipt();
  report.clientReport!.client.name = '<img src="https://invalid.example/" onerror="alert(1)">';
  report.company.logo = "https://cdn.example.com/company-logo.png?v=1&size=small";
  const html = await renderReportReceipt(report);
  assert.match(html, /lang="ar" dir="rtl"/);
  assert.match(html, /data:font\/ttf;base64,/);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img\s+src="https:/);
  assert.match(html, /05\/11\/2026, 00:30/);
  assert.match(html, /ساحب الكشف الأصلي/);
  assert.match(html, /متجر النور/);
  assert.match(html, /790,000/);
  assert.match(html, /<header>[\s\S]*class="qr-block"[\s\S]*class="brand"[\s\S]*<img\s+class="company-logo"\s+src="https:\/\/cdn\.example\.com\/company-logo\.png\?v&#x3D;1&amp;size&#x3D;small"[\s\S]*<\/header>/);
  const qrCodes = [...html.matchAll(/<img\s+class="qr"\s+src="([^"]+)"/g)];
  assert.equal(qrCodes.length, 2);
  assert.equal(qrCodes[0][1], qrCodes[1][1]);
  assert.match(html, /<footer class="receipt-footer">\s*<img\s+class="qr"/);
  assert.match(html, /نوع البريد:<\/th><td>واصل<\/td>/);
  assert.match(html, /إجمالي عدد الطلبات:<\/th><td><bdi\s+dir="ltr"\s*>20<\/bdi>/);
});

test("missing stores render a placeholder and unrelated report stores are not shown", async () => {
  const report = receipt();
  report.clientReport!.store = null;
  report.clientReport!.secondaryType = "RETURNED";
  assert.match(await renderReportReceipt(report), /المتجر:<\/th><td>-<\/td>/);
  assert.match(await renderReportReceipt(report), /نوع البريد:<\/th><td>راجع<\/td>/);
  for (const type of ["BRANCH", "DELIVERY_AGENT", "COMPANY", "REPOSITORY"] as const) {
    const html = await renderReportReceipt(receipt({type}));
    assert.doesNotMatch(html, /المتجر:|متجر النور/);
    assert.doesNotMatch(html, /نوع البريد:/);
    assert.doesNotMatch(html, /<img\s+class="company-logo"/);
  }
});

test("returned receipts hide the amount while retaining order counts and both QR codes", async () => {
  for (const type of ["CLIENT", "COMPANY", "REPOSITORY"] as const) {
    const report = receipt({
      type,
      clientReport: {...rawReport.clientReport!, secondaryType: "RETURNED"},
      companyReport: {...rawReport.companyReport!, secondaryType: "RETURNED"},
      repositoryReport: {...rawReport.repositoryReport!, secondaryType: "RETURNED"},
    });
    const html = await renderReportReceipt(report);
    assert.doesNotMatch(html, /<div class="amount">|المبلغ المستحق:|د\.ع/);
    assert.match(html, /إجمالي عدد الطلبات:/);
    assert.match(html, /عدد طلبات بغداد:/);
    assert.match(html, /عدد طلبات المحافظات:/);
    assert.equal((html.match(/<img\s+class="qr"/g) ?? []).length, 2);
    assert.match(await renderReportReceipt(receipt({type})), /<div class="amount">/);
  }
});

test("company managers and admins have explicit tenant/global scope", () => {
  assert.deepEqual(reportReceiptScope(manager), {companyId: 1});
  assert.deepEqual(reportReceiptScope({...manager, role: "ADMIN", companyID: null, companyName: null, mainCompany: null}), {});
  assert.throws(() => reportReceiptScope({...manager, companyID: undefined} as unknown as loggedInUserType), hasStatus(403));
});

test("client, assistant and agent ownership cannot be bypassed by main-repository flags", () => {
  assert.deepEqual(reportReceiptScope({...manager, role: "CLIENT", id: 20, mainRepository: true}), {companyId: 1, type: "CLIENT", clientReport: {clientId: 20}});
  assert.deepEqual(reportReceiptScope({...manager, role: "CLIENT_ASSISTANT", clientId: 20, permissions: ["MANAGE_REPORTS"]}), {companyId: 1, type: "CLIENT", clientReport: {clientId: 20}});
  assert.deepEqual(reportReceiptScope({...manager, role: "DELIVERY_AGENT", id: 30, mainRepository: true}), {companyId: 1, type: "DELIVERY_AGENT", deliveryAgentReport: {deliveryAgentId: 30}});
  assert.throws(() => reportReceiptScope({...manager, role: "CLIENT_ASSISTANT", clientId: 20}), hasStatus(403));
  assert.throws(() => reportReceiptScope({...manager, role: "CLIENT_ASSISTANT", permissions: ["MANAGE_REPORTS"]}), hasStatus(403));
});

test("branch and repository staff cannot drop their scope", () => {
  const scope = reportReceiptScope({...manager, role: "ACCOUNTANT"});
  assert.equal(scope.companyId, 1);
  assert.ok(scope.OR?.some(filter => JSON.stringify(filter) === JSON.stringify({createdBy: {branchId: 10}})));
  assert.throws(() => reportReceiptScope({...manager, role: "ACCOUNTANT", branchId: 0}), hasStatus(403));
  const repositoryScope = reportReceiptScope({...manager, role: "REPOSITORIY_EMPLOYEE"});
  assert.match(JSON.stringify(repositoryScope.AND), /"repositoryId":7/);
  assert.match(JSON.stringify(repositoryScope.AND), /"targetRepositoryId":7/);
  assert.throws(() => reportReceiptScope({...manager, role: "REPOSITORIY_EMPLOYEE", repositoryId: 0}), hasStatus(403));
});

test("roles excluded from report listing are also excluded from receipts", () => {
  for (const role of ["INQUIRY_EMPLOYEE", "RECEIVING_AGENT", "EMPLOYEE_CLIENT_ASSISTANT"] as const) {
    assert.throws(() => reportReceiptScope({...manager, role, mainRepository: true}), hasStatus(403));
  }
});

test("receipt reads filter deletion and tenant before selecting only summary data", async () => {
  const report = await repository.getReportForReceipt({reportID: 123, loggedInUser: manager});
  const args = find.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, {id: 123, deleted: false, AND: [{companyId: 1}]});
  for (const key of ["clientReport", "branchReport", "companyReport", "repositoryReport", "deliveryAgentReport"]) {
    assert.equal(args.select[key].select.orders, undefined);
  }
  assert.equal(report.clientNet, 790000);
  assert.equal(report.createdBy.name, "ساحب الكشف الأصلي");
});

test("missing, deleted or out-of-scope results return 404 before PDF generation", async () => {
  find.mock.mockImplementation(async () => null);
  await assert.rejects(service.getReportReceiptPDF({params: {reportID: 123}, loggedInUser: manager}), hasStatus(404));
  assert.equal(renderPDF.mock.callCount(), 0);
});

test("the receipt service generates A5 portrait from saved data", async () => {
  assert.equal(await service.getReportReceiptPDF({params: {reportID: 123}, loggedInUser: manager}), pdfBytes);
  const args = renderPDF.mock.calls[0].arguments;
  assert.deepEqual(args[2], {landscape: false, format: "A5", waitUntil: "load"});
  assert.match(args[0], /790,000/);
});

test("unsupported report types return 400 before PDF generation", async () => {
  find.mock.mockImplementation(async () => ({...rawReport, type: "EMPLOYEE"}));
  await assert.rejects(service.getReportReceiptPDF({params: {reportID: 123}, loggedInUser: manager}), hasStatus(400));
  assert.equal(renderPDF.mock.callCount(), 0);
});

// Exercise the registered route and its real auth/controller/service chain without
// binding sockets. Only the database, PDF renderer and creation service are mocked.
function invokeRoute(path: string, method: "get" | "post", input: Partial<Request> = {}) {
  const route = reportRoutes.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])?.route;
  assert.ok(route, `Missing ${method.toUpperCase()} ${path}`);
  return new Promise<{status: number; headers: Record<string, string>; body: unknown}>(resolve => {
    let status = 200;
    const headers: Record<string, string> = {};
    const req = {params: {}, query: {}, body: {}, headers: {}, cookies: {}, baseUrl: "/api/v1", ...input} as Request;
    const res = {
      locals: {},
      setHeader(name: string, value: string) {headers[name.toLowerCase()] = String(value);},
      send(body: unknown) {resolve({status, headers, body});},
      json(body: unknown) {resolve({status, headers, body});},
    } as unknown as Response;
    let index = 0;
    const next: NextFunction = (error?: unknown) => {
      if (error) {
        status = error instanceof ZodError ? 400 : error instanceof AppError ? error.statusCode : 500;
        resolve({status, headers, body: error});
        return;
      }
      const layer = route.stack[index++];
      assert.ok(layer, "Route did not produce a response");
      layer.handle(req, res, next);
    };
    next();
  });
}
const authorization = `Bearer ${jwt.sign(manager, "report-receipt-test-secret")}`;

test("GET receipt authenticates, validates IDs and returns inline PDF bytes", async () => {
  const path = "/reports/:reportID/receipt/pdf";
  assert.equal((await invokeRoute(path, "get", {params: {reportID: "123"}})).status, 401);
  assert.equal(find.mock.callCount(), 0);
  assert.equal((await invokeRoute(path, "get", {params: {reportID: "nope"}, headers: {authorization}})).status, 400);
  assert.equal(find.mock.callCount(), 0);
  const response = await invokeRoute(path, "get", {params: {reportID: "123"}, headers: {authorization}});
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/pdf");
  assert.equal(response.headers["content-disposition"], 'inline; filename="report-123-receipt.pdf"');
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(response.body, pdfBytes);
});

test("POST creation retains its PDF body and exposes the receipt URL", async () => {
  mock.method(ReportsService.prototype, "createReport", async () => ({pdf: pdfBytes, reportID: 123}));
  const response = await invokeRoute("/reports", "post", {
    headers: {authorization},
    query: {statuses: "DELIVERED", store_id: "4", confirmed: "true"},
    body: {type: "CLIENT", storeID: 4, ordersIDs: ["order-1"]},
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["x-report-id"], "123");
  assert.equal(response.headers["x-report-receipt-url"], "/api/v1/reports/123/receipt/pdf");
  assert.equal(response.headers["access-control-expose-headers"], "X-Report-ID, X-Report-Receipt-URL");
  assert.deepEqual(response.body, pdfBytes);
});
