// Run with: node --test tests/receiving-agent-manager.test.cjs
// Query fixtures only: this suite never connects to a database, Redis, or the app server.
const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node/register/transpile-only");

const user = {
  id: 99,
  role: "RECEIVING_AGENTS_MANAGER",
  companyID: 1,
  branchId: 10,
};
const agent = (id, branchId = 10, companyId = 1) => ({
  id,
  branchId,
  companyId,
  user: { id, name: `Agent ${id}` },
});
const agents = [agent(1), agent(2), agent(3, 20), agent(4, 10, 2)];
const client = (id, branchId = 10) => ({
  id,
  branchId,
  companyId: 1,
  user: { id, name: `Client ${id}` },
  company: { name: "Company" },
  branch: { id: branchId },
});
const clients = [client(101), client(102), client(103), client(104, 20)];
const assignments = [
  [1, 101],
  [2, 101],
  [2, 102],
  [3, 103],
  [1, 104],
].map(([agentId, clientId]) => ({
  agentId,
  clientId,
  receivingAgent: agents.find((a) => a.id === agentId),
}));
for (const c of clients)
  c.ReceivingAgentClients = assignments.filter((a) => a.clientId === c.id);
const order = (id, clientId, status, agentId, extra = {}) => ({
  id,
  clientId,
  client: clients.find((c) => c.id === clientId),
  status,
  deliveryAgentId: agentId ?? null,
  deliveryAgent: agents.find((a) => a.id === agentId) ?? null,
  companyId: 1,
  deleted: false,
  branchId: 20,
  branch: { id: 20 },
  ...extra,
});
const orders = [
  order("r1", 101, "READY_TO_SEND"),
  order("r2", 101, "READY_TO_SEND"),
  order("r3", 102, "READY_TO_SEND"),
  order("r4", 103, "READY_TO_SEND"),
  order("r5", 104, "READY_TO_SEND"),
  order("r6", 101, "READY_TO_SEND", null, { deleted: true }),
  order("r7", 101, "READY_TO_SEND", null, { companyId: 2 }),
  order("w1", 101, "WITH_RECEIVING_AGENT", 1),
  order("w2", 101, "WITH_RECEIVING_AGENT", 1),
  order("w3", 102, "WITH_RECEIVING_AGENT", 2),
  order("w4", 103, "WITH_RECEIVING_AGENT", 3),
  order("w5", 104, "WITH_RECEIVING_AGENT", 1, { branchId: null, branch: null }),
  order("w6", 101, "WITH_RECEIVING_AGENT", 1, { deleted: true }),
  order("w7", 101, "WITH_RECEIVING_AGENT", 1, { companyId: 2 }),
];
const report = (
  id,
  agentId,
  secondaryType,
  baghdad,
  governorates,
  extra = {}
) => ({
  id,
  companyId: 1,
  type: "CLIENT",
  deleted: false,
  confirmed: false,
  createdBy: { branchId: 20, user: { id: 99, name: "Creator" } },
  baghdadOrdersCount: baghdad,
  governoratesOrdersCount: governorates,
  clientReport: {
    id,
    secondaryType,
    client: clients[0],
    agent: agents.find((a) => a.id === agentId),
    receivingAgentId: agentId,
  },
  ...extra,
});
const reports = [
  report(1, 1, "RETURNED", 2, 3),
  report(2, 1, "RETURNED", 1, 1),
  report(3, 2, "RETURNED", 3, 0),
  report(4, 1, "DELIVERED", 1, 3),
  report(5, 2, "DELIVERED", 2, 4),
  report(6, 1, "RETURNED", 100, 0, { confirmed: true }),
  report(7, 1, "RETURNED", 100, 0, { deleted: true }),
  report(8, 1, "RETURNED", 100, 0, { companyId: 2 }),
  report(9, 3, "RETURNED", 100, 0),
  report(10, 4, "RETURNED", 100, 0),
  report(11, 1, "RETURNED", 100, 0, {
    clientReport: {
      agent: agents[0],
      client: clients[3],
      secondaryType: "RETURNED",
    },
  }),
];
function matches(row, condition) {
  if (condition === undefined) return true;
  if (condition === null || typeof condition !== "object")
    return row === condition;
  const entries = Object.entries(condition).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return true;
  return entries.every(([key, value]) => {
    if (key === "AND")
      return (Array.isArray(value) ? value : [value]).every((c) =>
        matches(row, c)
      );
    if (key === "OR") return value.some((c) => matches(row, c));
    if (key === "in") return value.includes(row);
    if (key === "not") return !matches(row, value);
    if (key === "some")
      return Array.isArray(row) && row.some((r) => matches(r, value));
    if (row == null) return false;
    return matches(row[key], value);
  });
}
const selected = (rows, args) => rows.filter((row) => matches(row, args.where));
function aggregate(rows, args) {
  const data = selected(rows, args);
  return {
    _count: { id: data.length },
    _sum: Object.fromEntries(
      Object.keys(args._sum ?? {}).map((k) => [
        k,
        data.length ? data.reduce((n, r) => n + (r[k] ?? 0), 0) : null,
      ])
    ),
  };
}
const calls = [];
const db = {
  employee: { findMany: async (args) => selected(agents, args) },
  client: { findMany: async (args) => selected(clients, args) },
  receivingAgentClients: {
    findMany: async (args) => selected(assignments, args),
  },
  report: {
    findMany: async (args) => selected(reports, args),
    aggregate: async (args) => {
      calls.push(["reportTotals", args]);
      return aggregate(reports, args);
    },
    findManyPaginated: async (args, pagination) => {
      calls.push(["reportList", args, pagination]);
      const rows = selected(reports, args).sort((a, b) => b.id - a.id);
      return {
        data: rows.slice(
          (pagination.page - 1) * pagination.size,
          pagination.page * pagination.size
        ),
        pagesCount: Math.ceil(rows.length / pagination.size) || 1,
      };
    },
  },
  order: {
    count: async (args) => selected(orders, args).length,
    groupBy: async (args) => {
      const field = args.by[0],
        result = new Map();
      for (const row of selected(orders, args))
        result.set(row[field], (result.get(row[field]) ?? 0) + 1);
      return [...result].map(([key, count]) => ({
        [field]: key,
        _count: { id: count },
      }));
    },
    findManyPaginated: async (args, pagination) => {
      calls.push(["orderList", args, pagination]);
      const rows = selected(orders, args);
      return { data: rows, dataCount: rows.length, pagesCount: 1 };
    },
  },
};
function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub("../src/database/db", { prisma: db });
stub("../src/server", { io: {} });
stub("../src/lib/redis", { redis: {} });
stub("../src/app/messages/messages.controller", {
  MessagesController: class {},
});
const manager = require("../src/app/orders/receivingAgentManager");
const { OrdersRepository } = require("../src/app/orders/orders.repository");

for (const invalid of [
  { role: "RECEIVING_AGENT" },
  { companyID: null },
  { companyID: 0 },
  { branchId: undefined },
  { branchId: 0 },
]) {
  test(`reject invalid manager scope ${JSON.stringify(invalid)}`, () => {
    assert.throws(
      () => manager.receivingManagerScope({ ...user, ...invalid }),
      (e) => e.statusCode === 403
    );
  });
}
test("invalid IDs and unsupported statuses are rejected", () => {
  for (const id of ["0", "-1", "1.5", "abc", "9007199254740992"])
    assert.equal(manager.managerAgentIdSchema.safeParse(id).success, false);
  assert.equal(
    manager.managerStatusSchema.safeParse("REGISTERED").success,
    false
  );
  assert.equal(
    manager.managerOrderStatusSchema.safeParse("RETURNED").success,
    false
  );
});
test("dashboard counts stay aligned with grouped counts and exclude other scopes", async () => {
  const stats = await manager.getReceivingManagerStatistics(user);
  assert.deepEqual(
    Object.fromEntries(
      stats.ordersStatisticsByStatus.map((s) => [s.status, s.count])
    ),
    {
      WITH_RECEIVING_AGENT: 4,
      READY_TO_SEND: 3,
      RETURNED: 10,
      DELIVERED: 10,
    }
  );
});
test("ready orders follow client assignments, with unique overall total for shared clients", async () => {
  const result = await manager.getReceivingManagerAgents(user, "READY_TO_SEND");
  assert.deepEqual(
    result.agents.map((a) => [a.agentId, a.count]),
    [
      [2, 3],
      [1, 2],
    ]
  );
  assert.equal(result.totalCount, 3);
  assert.equal(result.hasSharedClients, true);
  const clients = await manager.getReceivingManagerClients(
    user,
    "READY_TO_SEND",
    2
  );
  assert.deepEqual(
    clients.map((c) => [c.clientId, c.count]),
    [
      [101, 2],
      [102, 1],
    ]
  );
});
test("with-agent counts use the assigned agent, never the manager ID or the order destination", async () => {
  const result = await manager.getReceivingManagerAgents(
    user,
    "WITH_RECEIVING_AGENT"
  );
  assert.deepEqual(
    result.agents.map((a) => [a.agentId, a.count]),
    [
      [1, 3],
      [2, 1],
    ]
  );
  const clients = await manager.getReceivingManagerClients(
    user,
    "WITH_RECEIVING_AGENT",
    1
  );
  assert.deepEqual(
    clients.map((c) => [c.clientId, c.count]),
    [
      [101, 2],
      [104, 1],
    ]
  );
});
test("reports group by receiving agent and add saved order counts, retaining report counts separately", async () => {
  const returned = await manager.getReceivingManagerAgents(user, "RETURNED");
  assert.deepEqual(
    returned.agents.map((a) => [a.agentId, a.count, a.reportsCount]),
    [
      [1, 7, 2],
      [2, 3, 1],
    ]
  );
  const delivered = await manager.getReceivingManagerAgents(user, "DELIVERED");
  assert.deepEqual(
    delivered.agents.map((a) => [a.agentId, a.count, a.reportsCount]),
    [
      [2, 6, 1],
      [1, 4, 1],
    ]
  );
});
test("selected report agent is retained across pages and totals use the exact same filter", async () => {
  calls.length = 0;
  const result = await manager.getReceivingManagerReports(user, {
    page: 2,
    size: 1,
    secondaryType: "RETURNED",
    receivingAgentID: 1,
    companyID: 2,
  });
  assert.deepEqual(
    result.reports.map((r) => r.id),
    [1]
  );
  assert.equal(result.pagesCount, 2);
  assert.equal(result.reportsMetaData.reportsCount, 2);
  assert.equal(
    result.reportsMetaData.baghdadOrdersCount +
      result.reportsMetaData.governoratesOrdersCount,
    7
  );
  assert.deepEqual(
    calls.find((c) => c[0] === "reportList")[1].where,
    calls.find((c) => c[0] === "reportTotals")[1].where
  );
});
test("outside-branch and outside-company agent selections return empty drilldowns", async () => {
  for (const id of [3, 4, 999]) {
    assert.deepEqual(
      await manager.getReceivingManagerClients(user, "READY_TO_SEND", id),
      []
    );
    const result = await manager.getReceivingManagerReports(user, {
      page: 1,
      size: 20,
      secondaryType: "RETURNED",
      receivingAgentID: id,
    });
    assert.equal(result.reports.length, 0);
    assert.equal(result.reportsMetaData.reportsCount, 0);
    assert.equal(result.reportsMetaData.baghdadOrdersCount, 0);
  }
});
test("report pagination is bounded and invalid page numbers default safely", async () => {
  calls.length = 0;
  await manager.getReceivingManagerReports(user, {
    page: -1,
    size: 999,
    receivingAgentID: 1,
  });
  const pagination = calls.find((c) => c[0] === "reportList")[2];
  assert.equal(pagination.page, 1);
  assert.equal(pagination.size, 100);
});
test("order detail query keeps the selected agent and client while allowing a different or missing destination branch", async () => {
  const repository = new OrdersRepository();
  for (const [status, agentId, clientId, ids] of [
    ["READY_TO_SEND", 2, 101, ["r1", "r2"]],
    ["WITH_RECEIVING_AGENT", 1, 104, ["w5"]],
    ["WITH_RECEIVING_AGENT", 3, 103, []],
    ["READY_TO_SEND", 1, 102, []],
  ]) {
    const result = await repository.getAllOrdersPaginated({
      loggedInUser: user,
      filters: {
        page: 1,
        size: 20,
        status,
        clientID: clientId,
        companyID: 1,
        deleted: false,
        minified: true,
      },
      additionalWhere: manager.receivingManagerOrderWhere(
        user,
        status,
        agentId
      ),
    });
    assert.deepEqual(
      result.orders.map((o) => o.id),
      ids
    );
    assert.equal(result.ordersMetaData.count, ids.length);
  }
});
