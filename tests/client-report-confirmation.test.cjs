// Run: node --test tests/client-report-confirmation.test.cjs
// Uses the real update service and repository with database fixtures; no network/database connection.
const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
require('ts-node/register/transpile-only');
const { Prisma } = require('@prisma/client');
function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const user = {id: 101, role: 'CLIENT', companyID: 1, permissions: []};
let rows, updates, orderUpdates;
const makeReport = (id, overrides = {}) => ({
  id, type: 'CLIENT', companyId: 1, deleted: false, confirmed: false,
  status: 'UNPAID', delivered: false,
  clientReport: {id, clientId: 101, secondaryType: 'DELIVERED'}, ...overrides,
});
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((part) => matches(row, part));
    if (value !== null && typeof value === 'object') return row[key] != null && matches(row[key], value);
    return row[key] === value;
  });
}
const db = {
  report: {
    update: async ({where, data}) => {
      updates.push({where, data});
      const report = rows.find((r) => matches(r, where));
      if (!report) throw new Prisma.PrismaClientKnownRequestError('No record', {code: 'P2025', clientVersion: '5.22.0'});
      for (const [key, value] of Object.entries(data)) if (value !== undefined) report[key] = value;
      return report;
    },
  },
  order: {updateMany: async (args) => {orderUpdates.push(args); return {count: 1};}},
};
stub('../src/database/db', {prisma: db});
stub('../src/app/reports/reports.responses', {reportSelect: {}, reportReform: (report) => report});
stub('../src/app/orders/helpers/recomputeReportFlags', {});
stub('../src/app/orders/receivingAgentManager', {});
stub('../src/app/employees/employees.repository', {EmployeesRepository: class {}});
stub('../src/app/orders/orders.repository', {OrdersRepository: class {}});
stub('../src/app/transactions/transaction.repository', {TransactionsRepository: class {}});
for (const file of [
  '../src/app/notifications/helpers/sendNotification',
  '../src/app/reports/helpers/generateReport',
  '../src/app/reports/helpers/generateReportReceipt',
  '../src/app/reports/helpers/generateReportsReport',
  '../src/app/reports/helpers/generateBranchClientsReport',
]) stub(file, {});
const {ReportsService} = require('../src/app/reports/reports.service');
const {ReportParamsSchema} = require('../src/app/reports/reports.dto');
const service = new ReportsService();
const confirm = (id = 1, actor = user, reportData = {confirmed: true}) =>
  service.updateReport({params: {reportID: id}, loggedInUser: actor, reportData});
beforeEach(() => {
  rows = [
    makeReport(1),
    makeReport(2, {clientReport: {id: 2, clientId: 202, secondaryType: 'DELIVERED'}}),
    makeReport(3, {companyId: 2}),
    makeReport(4, {deleted: true}),
    makeReport(5, {type: 'DELIVERY_AGENT', clientReport: null}),
    makeReport(6, {clientReport: {id: 6, clientId: 101, secondaryType: 'RETURNED'}}),
  ];
  updates = []; orderUpdates = [];
});
test('clients confirm their report without changing payment or agent delivery', async () => {
  const report = await confirm();
  assert.equal(report.confirmed, true);
  assert.equal(report.status, 'UNPAID');
  assert.equal(report.delivered, false);
  assert.deepEqual(updates[0].where, {
    id: 1, AND: {companyId: 1, type: 'CLIENT', clientReport: {clientId: 101}, deleted: false},
  });
});
for (const [id, label] of [[2,'another client'], [3,'another company'], [4,'deleted'], [5,'wrong report type'], [999,'missing']]) {
  test(`reject ${label} report before any change`, async () => {
    const before = JSON.stringify(rows);
    await assert.rejects(confirm(id), (e) => e.statusCode === 404);
    assert.equal(JSON.stringify(rows), before);
    assert.equal(orderUpdates.length, 0);
  });
}
test('returned-report confirmation retains the existing WITH_CLIENT order update', async () => {
  await confirm(6);
  assert.equal(orderUpdates.length, 1);
  assert.deepEqual(orderUpdates[0].data, {secondaryStatus: 'WITH_CLIENT'});
  assert.equal(orderUpdates[0].where.clientReport.some.id, 6);
});
test('repeating a confirmation remains successful', async () => {
  await confirm();
  const report = await confirm();
  assert.equal(report.confirmed, true);
  assert.equal(report.status, 'UNPAID');
});
test('clients cannot unconfirm, change payment status, or move repositories', async () => {
  for (const payload of [{confirmed: false}, {}, {status: 'PAID'}, {confirmed: true, status: 'PAID'}, {confirmed: true, repositoryID: 1}]) {
    await assert.rejects(confirm(1, user, payload), (e) => [400,403].includes(e.statusCode));
  }
  assert.equal(updates.length, 0);
});
test('invalid client or company identity fails closed', async () => {
  for (const actor of [{...user, id: 0}, {...user, companyID: null}, {...user, companyID: 0}])
    await assert.rejects(confirm(1, actor), (e) => e.statusCode === 403);
  assert.equal(updates.length, 0);
});
test('client assistants require report permission and are scoped to their client', async () => {
  const assistant = {...user, id: 900, role: 'CLIENT_ASSISTANT', clientId: 101, permissions: ['MANAGE_REPORTS']};
  assert.equal((await confirm(1, assistant)).confirmed, true);
  await assert.rejects(confirm(2, assistant), (e) => e.statusCode === 404);
  await assert.rejects(confirm(1, {...assistant, permissions: []}), (e) => e.statusCode === 403);
  await assert.rejects(confirm(1, {...assistant, clientId: undefined}), (e) => e.statusCode === 403);
});
test('existing employee updates keep their current behavior', async () => {
  const result = await confirm(1, {...user, role: 'COMPANY_MANAGER'}, {status: 'PAID'});
  assert.equal(result.status, 'PAID');
  assert.equal(updates[0].where.AND, undefined);
});
test('update route report IDs must be positive database integers', () => {
  for (const reportID of ['0', '-1', '1.5', 'NaN', '2147483648', '1abc'])
    assert.equal(ReportParamsSchema.safeParse({reportID}).success, false);
  assert.equal(ReportParamsSchema.parse({reportID: '123'}).reportID, 123);
});
