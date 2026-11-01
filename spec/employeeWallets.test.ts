import assert from "node:assert/strict";
import {afterEach, beforeEach, mock, test} from "node:test";
import {Prisma} from "@prisma/client";
import {
  EmployeeWalletCreateSchema,
  EmployeeWalletTransactionCreateSchema,
  EmployeeWalletTargetsSchema,
  EmployeeWalletListSchema,
  EmployeeWalletParamsSchema,
  EmployeeWalletTransactionsSchema,
  EmployeeWalletTransactionsExportSchema,
  EmployeeWalletUpdateSchema,
} from "../src/app/employeeWallets/employeeWallets.dto";
import {EmployeeWalletsRepository} from "../src/app/employeeWallets/employeeWallets.repository";
import {prisma} from "../src/database/db";
import {AppError} from "../src/lib/AppError";
import type {loggedInUserType} from "../src/types/user";

const repository = new EmployeeWalletsRepository();
const manager: loggedInUserType = {
  id: 5, name: "Manager", username: "manager", role: "COMPANY_MANAGER",
  companyID: 1, companyName: "Company", mainCompany: false,
  branchId: 10, clientId: 0, parentBranchId: 0, repositoryId: 0,
  mainRepository: false, showTreatury: true, permissions: [],
};
const branchManager: loggedInUserType = {...manager, role: "BRANCH_MANAGER"};
const wallet = {
  id: 7, companyId: 1, branchId: 10, employeeId: 20,
  total: 100, paid: 25, pending: 75, createdById: 5,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  _count: {transactions: 0},
};
const hasStatus = (status: number) => (error: unknown) =>
  error instanceof AppError && error.statusCode === status;

// Prisma delegates expose methods through proxies, so assign mocks directly.
const restorers: Array<() => void> = [];
function mockMethod(target: object, name: string, implementation: (...args: any[]) => any) {
  const methods = target as Record<string, any>;
  const original = methods[name];
  const mocked = mock.fn(implementation);
  methods[name] = mocked;
  restorers.push(() => { methods[name] = original; });
  return mocked;
}
beforeEach(() => {
  // Unconfigured calls must fail locally, never reach a real database.
  for (const [delegate, methods] of [
    [prisma.employeeWallet, ["create", "findFirst", "findMany", "count", "update", "delete"]],
    [prisma.branch, ["findFirst", "findMany", "count"]],
    [prisma.client, ["findFirst", "findMany", "count"]],
    [prisma, ["$transaction"]],
    [prisma.employee, ["findFirst"]],
    [prisma.transaction, ["findMany", "count", "create"]],
  ] as const) {
    for (const method of methods) mockMethod(delegate, method, () => {
      throw new Error(`Unmocked database method: ${method}`);
    });
  }
});
afterEach(() => {
  for (const restore of restorers.splice(0).reverse()) restore();
  mock.restoreAll();
});

test("create accepts JSON and form ids without adding balance fields", () => {
  assert.deepEqual(EmployeeWalletCreateSchema.parse({employeeID: null}), {
    employeeID: null,
  });
  assert.deepEqual(EmployeeWalletCreateSchema.parse({}), {});
  assert.deepEqual(EmployeeWalletCreateSchema.parse({employeeID: "20"}), {employeeID: 20});
});

test("create and update reject balance fields, even when supplied with valid assignment", () => {
  for (const schema of [EmployeeWalletCreateSchema, EmployeeWalletUpdateSchema]) {
    for (const field of ["total", "paid", "pending"]) {
      for (const value of [0, 100, "12.50", -1, null]) {
        assert.equal(schema.safeParse({employeeID: 20, [field]: value}).success, false);
      }
    }
  }
});

test("partial updates accept unassignment but reject empty and server-owned fields", () => {
  assert.deepEqual(EmployeeWalletUpdateSchema.parse({employeeID: null}), {employeeID: null});
  for (const data of [{}, {companyId: 2}, {createdById: 1}, {branchID: 11}]) {
    assert.equal(EmployeeWalletUpdateSchema.safeParse(data).success, false);
  }
  assert.equal(EmployeeWalletCreateSchema.safeParse({companyID: 2}).success, false);
});

test("ids and pagination reject malformed input and bound page size", () => {
  for (const value of ["0", "-1", "1.5", "abc", "", null, true, ["1"], "2147483648"]) {
    assert.equal(EmployeeWalletParamsSchema.safeParse({walletID: value}).success, false);
    assert.equal(EmployeeWalletListSchema.safeParse({branch_id: value}).success, false);
  }
  assert.deepEqual(EmployeeWalletListSchema.parse({}), {page: 1, size: 10});
  assert.equal(EmployeeWalletListSchema.safeParse({size: "101"}).success, false);
  assert.equal(EmployeeWalletListSchema.safeParse({page: "0"}).success, false);
  assert.equal(EmployeeWalletTransactionsSchema.parse({approved: "false"}).approved, false);
  assert.equal(EmployeeWalletTransactionsSchema.safeParse({approved: "yes"}).success, false);
});

test("create uses the authenticated company, creator and default branch", async () => {
  const branch = mockMethod(prisma.branch, "findFirst", async () => ({id: 10}));
  const employee = mockMethod(prisma.employee, "findFirst", async () => ({id: 20}));
  const create = mockMethod(prisma.employeeWallet, "create", async () => wallet);
  await repository.createWallet(manager, EmployeeWalletCreateSchema.parse({employeeID: 20}));
  assert.deepEqual(branch.mock.calls[0].arguments[0].where, {id: 10, companyId: 1});
  assert.deepEqual(employee.mock.calls[0].arguments[0].where, {
    id: 20, companyId: 1, branchId: 10, deleted: false,
  });
  assert.deepEqual(create.mock.calls[0].arguments[0].data, {
    companyId: 1, branchId: 10, employeeId: 20, createdById: 5,
  });
});

test("branch managers cannot create or list wallets for another branch", async () => {
  assert.equal(EmployeeWalletCreateSchema.safeParse({branchID: 11}).success, false);
  await assert.rejects(repository.getWallets(branchManager, {page: 1, size: 10, branch_id: 11}), hasStatus(403));
});

test("missing tenant or branch context and unauthorized roles fail closed", async () => {
  for (const user of [
    {...manager, companyID: null, role: "ADMIN", companyName: null, mainCompany: null} as loggedInUserType,
    {...branchManager, branchId: undefined} as unknown as loggedInUserType,
    {...manager, role: "DELIVERY_AGENT"} as loggedInUserType,
    {...manager, showTreatury: false},
  ]) {
    await assert.rejects(repository.getWallets(user, {page: 1, size: 10}), hasStatus(403));
  }
});

test("creation rejects foreign branches and employees before writing", async () => {
  const create = mockMethod(prisma.employeeWallet, "create", async () => wallet);
  const branch = mockMethod(prisma.branch, "findFirst", async () => null);
  await assert.rejects(repository.createWallet({...manager, branchId: 11}, EmployeeWalletCreateSchema.parse({employeeID: 20})), hasStatus(400));
  branch.mock.mockImplementation(async () => ({id: 10}));
  mockMethod(prisma.employee, "findFirst", async () => null);
  await assert.rejects(repository.createWallet(manager, EmployeeWalletCreateSchema.parse({employeeID: 20})), hasStatus(400));
  assert.equal(create.mock.callCount(), 0);
});

test("lists scope both rows and counts, paginate and let company managers filter branches", async () => {
  const find = mockMethod(prisma.employeeWallet, "findMany", async () => [wallet]);
  const count = mockMethod(prisma.employeeWallet, "count", async () => 21);
  const result = await repository.getWallets(branchManager, {page: 2, size: 10, employee_id: 20});
  assert.deepEqual(result, {data: [wallet], count: 21, page: 2, pagesCount: 3});
  const args = find.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, {companyId: 1, branchId: 10, employeeId: 20});
  assert.deepEqual(count.mock.calls[0].arguments[0].where, args.where);
  assert.equal(args.skip, 10);
  assert.equal(args.take, 10);
  await repository.getWallets(manager, {page: 1, size: 10, branch_id: 11});
  assert.equal(find.mock.calls[1].arguments[0].where.branchId, 11);
  await repository.getWallets(manager, {page: 1, size: 10});
  assert.equal(find.mock.calls[2].arguments[0].where.branchId, undefined);
});

test("all wallet-specific operations return 404 for out-of-scope wallets", async () => {
  const find = mockMethod(prisma.employeeWallet, "findFirst", async () => null);
  const transactions = mockMethod(prisma.transaction, "findMany", async () => []);
  const update = mockMethod(prisma.employeeWallet, "update", async () => wallet);
  const remove = mockMethod(prisma.employeeWallet, "delete", async () => wallet);
  await assert.rejects(repository.getWallet(branchManager, 7), hasStatus(404));
  await assert.rejects(repository.updateWallet(branchManager, 7, {employeeID: 20}), hasStatus(404));
  await assert.rejects(repository.deleteWallet(branchManager, 7), hasStatus(404));
  await assert.rejects(repository.getTransactions(branchManager, 7, {page: 1, size: 10}), hasStatus(404));
  for (const call of find.mock.calls) {
    assert.deepEqual(call.arguments[0].where, {id: 7, companyId: 1, branchId: 10});
  }
  assert.equal(transactions.mock.callCount() + update.mock.callCount() + remove.mock.callCount(), 0);
});

test("assignment updates never write balances and guard concurrent changes", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const update = mockMethod(prisma.employeeWallet, "update", async () => wallet);
  await repository.updateWallet(branchManager, 7, {employeeID: 20});
  const args = update.mock.calls[0].arguments[0];
  assert.deepEqual(args.data, {branchId: 10, employeeId: 20});
  assert.deepEqual(args.where, {id: 7, companyId: 1, branchId: 10, updatedAt: wallet.updatedAt});
  update.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("Concurrent change", {code: "P2025", clientVersion: "5.22.0"});
  });
  await assert.rejects(repository.updateWallet(manager, 7, {employeeID: 20}), hasStatus(409));
});

test("reassignment validates the new employee against the wallet branch", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  mockMethod(prisma.branch, "findFirst", async () => ({id: 10}));
  const employee = mockMethod(prisma.employee, "findFirst", async () => null);
  await assert.rejects(repository.updateWallet(manager, 7, {employeeID: 21}), hasStatus(400));
  assert.deepEqual(employee.mock.calls[0].arguments[0].where, {
    id: 21, companyId: 1, branchId: 10, deleted: false,
  });
});

test("an unlinked wallet can clear its employee without changing branch or balances", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  mockMethod(prisma.branch, "findFirst", async () => ({id: 10}));
  const update = mockMethod(prisma.employeeWallet, "update", async () => wallet);
  await repository.updateWallet(manager, 7, {employeeID: null});
  const args = update.mock.calls[0].arguments[0];
  assert.equal(args.data.employeeId, null);
  assert.equal(args.data.branchId, 10);
  assert.deepEqual(args.where.transactions, {none: {}});
});

test("transaction history prevents deletion and reassignment", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => ({...wallet, _count: {transactions: 1}}));
  const remove = mockMethod(prisma.employeeWallet, "delete", async () => wallet);
  const update = mockMethod(prisma.employeeWallet, "update", async () => wallet);
  await assert.rejects(repository.deleteWallet(manager, 7), hasStatus(409));
  await assert.rejects(repository.updateWallet(manager, 7, {employeeID: null}), hasStatus(409));
  assert.equal(remove.mock.callCount() + update.mock.callCount(), 0);
});

test("deletion is scoped and handles a transaction linked concurrently", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const remove = mockMethod(prisma.employeeWallet, "delete", async () => wallet);
  await repository.deleteWallet(branchManager, 7);
  assert.deepEqual(remove.mock.calls[0].arguments[0].where, {
    id: 7, companyId: 1, branchId: 10, updatedAt: wallet.updatedAt, transactions: {none: {}},
  });
  remove.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("Linked history", {code: "P2003", clientVersion: "5.22.0"});
  });
  await assert.rejects(repository.deleteWallet(manager, 7), hasStatus(409));
});

test("transaction history scopes rows and counts and preserves approved=false", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const find = mockMethod(prisma.transaction, "findMany", async () => []);
  const count = mockMethod(prisma.transaction, "count", async () => 0);
  const result = await repository.getTransactions(branchManager, 7, {page: 1, size: 10, approved: false});
  const where = {employeeWalletId: 7, companyId: 1, branchId: 10, deleted: false, type: undefined, approved: false, targetBranchId: undefined, targetClientId: undefined, createdAt: undefined};
  assert.deepEqual(find.mock.calls[0].arguments[0].where, where);
  assert.deepEqual(count.mock.calls[0].arguments[0].where, where);
  assert.deepEqual(result, {data: [], count: 0, page: 1, pagesCount: 0});
});


test("transaction filters validate calendar dates, ordering and destination ids", () => {
  for (const data of [
    {start_date: "2026-02-30"}, {end_date: "invalid"},
    {start_date: "2026-11-02", end_date: "2026-11-01"},
    {start_date: "2026-11-01T10:00:00Z"},
    {target_branch_id: "0"}, {target_client_id: "1.5"},
  ]) assert.equal(EmployeeWalletTransactionsSchema.safeParse(data).success, false);
  assert.equal(EmployeeWalletTransactionsSchema.safeParse({start_date: "2026-11-01", end_date: "2026-11-01"}).success, true);
});

test("transaction dates and both destinations combine within wallet scope for rows and counts", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const find = mockMethod(prisma.transaction, "findMany", async () => []);
  const count = mockMethod(prisma.transaction, "count", async () => 23);
  const result = await repository.getTransactions(branchManager, 7, EmployeeWalletTransactionsSchema.parse({
    page: "2", size: "10", start_date: "2026-11-01", end_date: "2026-11-01",
    target_branch_id: "11", target_client_id: "30",
  }));
  const args = find.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, {
    employeeWalletId: 7, companyId: 1, branchId: 10, deleted: false,
    type: undefined, approved: undefined, targetBranchId: 11, targetClientId: 30,
    createdAt: {gte: new Date("2026-10-31T21:00:00Z"), lt: new Date("2026-11-01T21:00:00Z")},
  });
  assert.deepEqual(count.mock.calls[0].arguments[0].where, args.where);
  assert.equal(args.skip, 10);
  assert.equal(args.take, 10);
  assert.equal(result.pagesCount, 3);
  assert.deepEqual(args.select.targetClient, {select: {id: true, user: {select: {name: true}}}});
});

test("transaction date ranges support either boundary independently", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const find = mockMethod(prisma.transaction, "findMany", async () => []);
  mockMethod(prisma.transaction, "count", async () => 0);
  await repository.getTransactions(manager, 7, {page: 1, size: 10, start_date: "2026-12-31"});
  await repository.getTransactions(manager, 7, {page: 1, size: 10, end_date: "2026-12-31"});
  assert.deepEqual(find.mock.calls[0].arguments[0].where.createdAt, {gte: new Date("2026-12-30T21:00:00Z"), lt: undefined});
  assert.deepEqual(find.mock.calls[1].arguments[0].where.createdAt, {gte: undefined, lt: new Date("2026-12-31T21:00:00Z")});
});


test("PDF export has the same tenant and filter scope and includes every matching row", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const rows = Array.from({length: 125}, (_, id) => ({id}));
  const find = mockMethod(prisma.transaction, "findMany", async () => rows);
  mockMethod(prisma.transaction, "count", async () => rows.length);
  const filters = EmployeeWalletTransactionsExportSchema.parse({
    start_date: "2026-11-01", end_date: "2026-11-02", target_branch_id: "11", target_client_id: "30", approved: "false"
  });
  const report = await repository.getTransactionsExport(branchManager, 7, filters);
  await repository.getTransactions(branchManager, 7, {...filters, page: 3, size: 10});
  const exported = find.mock.calls[0].arguments[0];
  const listed = find.mock.calls[1].arguments[0];
  assert.deepEqual(exported.where, listed.where);
  assert.deepEqual(exported.select, listed.select);
  assert.deepEqual(exported.orderBy, listed.orderBy);
  assert.equal("take" in exported, false);
  assert.equal("skip" in exported, false);
  assert.equal(report.transactions.length, 125);
  assert.deepEqual(report.wallet, wallet);
});

test("PDF export rejects out-of-scope wallets, unauthorized users and invalid filters", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => null);
  const find = mockMethod(prisma.transaction, "findMany", async () => []);
  await assert.rejects(repository.getTransactionsExport(branchManager, 7, {}), hasStatus(404));
  await assert.rejects(repository.getTransactionsExport({...manager, showTreatury: false}, 7, {}), hasStatus(403));
  assert.equal(find.mock.callCount(), 0);
  for (const data of [{start_date: "2026-02-30"}, {start_date: "2026-11-03", end_date: "2026-11-01"}, {target_client_id: "0"}, {page: "2"}, {size: "10"}]) {
    assert.equal(EmployeeWalletTransactionsExportSchema.safeParse(data).success, false);
  }
});

const walletOwner: loggedInUserType = {...manager, id: 20, role: "ACCOUNTANT", showTreatury: false};
const ownWalletWhere = {
  companyId: 1, employeeId: 20,
  employee: {is: {id: 20, companyId: 1, deleted: false}},
};

test("employees list only their assigned wallets in their company, including multiple wallets", async () => {
  const rows = [wallet, {...wallet, id: 8}];
  const find = mockMethod(prisma.employeeWallet, "findMany", async () => rows);
  assert.deepEqual(await repository.getOwnWallets(walletOwner), rows);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, ownWalletWhere);
  find.mock.mockImplementation(async () => []);
  assert.deepEqual(await repository.getOwnWallets(walletOwner), []);
});

test("personal wallet reads reject clients and missing tenant or user identity", async () => {
  for (const user of [
    {...walletOwner, companyID: null}, {...walletOwner, id: 0},
    {...walletOwner, role: "CLIENT"}, {...walletOwner, role: "ADMIN"},
  ]) await assert.rejects(repository.getOwnWallets(user as loggedInUserType), hasStatus(403));
});

test("personal transactions and PDF verify ownership before querying any history", async () => {
  const findWallet = mockMethod(prisma.employeeWallet, "findFirst", async () => null);
  const findTransactions = mockMethod(prisma.transaction, "findMany", async () => []);
  await assert.rejects(repository.getTransactions(walletOwner, 99, {page: 1, size: 10}, true), hasStatus(404));
  await assert.rejects(repository.getTransactionsExport(walletOwner, 99, {}, true), hasStatus(404));
  await assert.rejects(repository.getOwnWalletFilters(walletOwner, 99), hasStatus(404));
  for (const call of findWallet.mock.calls) assert.deepEqual(call.arguments[0].where, {id: 99, ...ownWalletWhere});
  assert.equal(findTransactions.mock.callCount(), 0);
});

test("personal transactions and PDF retain wallet, company, branch and destination filters", async () => {
  const findWallet = mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const find = mockMethod(prisma.transaction, "findMany", async () => []);
  const count = mockMethod(prisma.transaction, "count", async () => 0);
  const filters = {start_date: "2026-11-01", target_branch_id: 11, target_client_id: 30};
  await repository.getTransactions(walletOwner, 7, {...filters, page: 2, size: 10}, true);
  await repository.getTransactionsExport(walletOwner, 7, filters, true);
  assert.deepEqual(findWallet.mock.calls[0].arguments[0].where, {id: 7, ...ownWalletWhere});
  const where = find.mock.calls[0].arguments[0].where;
  assert.deepEqual(where, {
    employeeWalletId: 7, companyId: 1, branchId: 10, deleted: false,
    type: undefined, approved: undefined, targetBranchId: 11, targetClientId: 30,
    createdAt: {gte: new Date("2026-10-31T21:00:00Z"), lt: undefined},
  });
  assert.deepEqual(count.mock.calls[0].arguments[0].where, where);
  assert.deepEqual(find.mock.calls[1].arguments[0].where, where);
  assert.equal("take" in find.mock.calls[1].arguments[0], false);
});

test("personal destination options come only from the authorized wallet's nondeleted history", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const find = mockMethod(prisma.transaction, "findMany", async (args) =>
    args.select.targetBranch ? [{targetBranch: {id: 11, name: "Branch"}}] : [{targetClient: {id: 30, user: {name: "Client"}}}]);
  assert.deepEqual(await repository.getOwnWalletFilters(walletOwner, 7), {
    branches: [{id: 11, name: "Branch"}], clients: [{id: 30, name: "Client"}],
  });
  for (const call of find.mock.calls) {
    const {where} = call.arguments[0];
    assert.equal(where.employeeWalletId, 7);
    assert.equal(where.companyId, 1);
    assert.equal(where.branchId, 10);
    assert.equal(where.deleted, false);
  }
});

test("own-wallet access does not give employees management access", async () => {
  await assert.rejects(repository.getWallets(walletOwner, {page: 1, size: 10}), hasStatus(403));
  await assert.rejects(repository.getWallet(walletOwner, 7), hasStatus(403));
  await assert.rejects(repository.createWallet(walletOwner, {employeeID: 20}), hasStatus(403));
  await assert.rejects(repository.updateWallet(walletOwner, 7, {employeeID: null}), hasStatus(403));
  await assert.rejects(repository.deleteWallet(walletOwner, 7), hasStatus(403));
  await assert.rejects(repository.getTransactions(walletOwner, 7, {page: 1, size: 10}), hasStatus(403));
});


test("wallet transaction creation requires the matching destination and rejects unrelated targets", () => {
  for (const type of ["FROM_BRANCH", "TO_BRANCH"]) {
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Transfer", paidAmount: 10}).success, false);
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Transfer", paidAmount: 10, targetBranchId: "11"}).success, true);
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Transfer", paidAmount: 10, targetBranchId: 11, targetClientId: 30}).success, false);
  }
  for (const type of ["FROM_CLIENT", "TO_CLIENT"]) {
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Transfer", paidAmount: 10}).success, false);
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Transfer", paidAmount: 10, targetClientId: 30}).success, true);
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Transfer", paidAmount: 10, targetBranchId: 11}).success, false);
  }
  for (const type of ["DEPOSIT", "WITHDRAW"]) {
    assert.deepEqual(EmployeeWalletTransactionCreateSchema.parse({type, for: "  Cash  ", paidAmount: "12.5"}), {type, for: "Cash", paidAmount: 12.5});
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({type, for: "Cash", paidAmount: 10, targetBranchId: 11}).success, false);
  }
});

test("employees cannot set balances, approval or ownership when creating transactions", () => {
  const base = {type: "DEPOSIT", for: "Cash", paidAmount: 10};
  for (const field of ["total", "paid", "pending", "approved", "approvedforMain", "employeeWalletId", "companyId", "employeeId", "createdById", "branchId", "forWallets", "reportId"]) {
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({...base, [field]: 1}).success, false);
  }
  for (const paidAmount of [0, -1, Infinity, NaN, null, true, "", "abc"]) {
    assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({...base, paidAmount}).success, false);
  }
  assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({...base, for: "  "}).success, false);
  assert.equal(EmployeeWalletTransactionCreateSchema.safeParse({...base, type: "TO_WALLET"}).success, false);
});

test("employee creation verifies wallet and destination and records server-owned unapproved data atomically", async () => {
  const tx = mockMethod(prisma, "$transaction", async (callback) => callback(prisma));
  const findWallet = mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const branch = mockMethod(prisma.branch, "findFirst", async () => ({id: 11}));
  const create = mockMethod(prisma.transaction, "create", async () => ({id: 100}));
  await repository.createOwnTransaction(walletOwner, 7, {type: "TO_BRANCH", for: "Transfer", paidAmount: 200, targetBranchId: 11});
  assert.deepEqual(findWallet.mock.calls[0].arguments[0].where, {id: 7, ...ownWalletWhere});
  assert.deepEqual(branch.mock.calls[0].arguments[0].where, {id: 11, companyId: 1});
  assert.deepEqual(create.mock.calls[0].arguments[0].data, {
    type: "TO_BRANCH", for: "Transfer", paidAmount: 200, targetBranchId: 11, targetClientId: undefined,
    employeeWalletId: 7, companyId: 1, branchId: 10, employeeId: 20, createdById: 20,
    forWallets: true, approved: false, approvedforMain: false,
  });
  assert.equal(tx.mock.calls[0].arguments[1].isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
});

test("transaction creation rejects foreign wallets, foreign branches and deleted or foreign clients", async () => {
  mockMethod(prisma, "$transaction", async callback => callback(prisma));
  const find = mockMethod(prisma.employeeWallet, "findFirst", async () => null);
  const create = mockMethod(prisma.transaction, "create", async () => ({id: 100}));
  await assert.rejects(repository.createOwnTransaction(walletOwner, 99, {type: "DEPOSIT", for: "Cash", paidAmount: 1}), hasStatus(404));
  find.mock.mockImplementation(async () => wallet);
  mockMethod(prisma.branch, "findFirst", async () => null);
  const client = mockMethod(prisma.client, "findFirst", async () => null);
  await assert.rejects(repository.createOwnTransaction(walletOwner, 7, {type: "FROM_BRANCH", for: "Transfer", paidAmount: 1, targetBranchId: 99}), hasStatus(400));
  await assert.rejects(repository.createOwnTransaction(walletOwner, 7, {type: "TO_CLIENT", for: "Transfer", paidAmount: 1, targetClientId: 99}), hasStatus(400));
  assert.deepEqual(client.mock.calls[0].arguments[0].where, {id: 99, companyId: 1, deleted: false});
  assert.equal(create.mock.callCount(), 0);
  client.mock.mockImplementation(async () => ({id: 30}));
  await repository.createOwnTransaction(walletOwner, 7, {type: "FROM_CLIENT", for: "Transfer", paidAmount: 1, targetClientId: 30});
  assert.equal(create.mock.calls[0].arguments[0].data.targetClientId, 30);
});

test("a concurrent wallet change returns a retryable conflict instead of creating under stale ownership", async () => {
  mockMethod(prisma, "$transaction", async () => {throw new Prisma.PrismaClientKnownRequestError("Conflict", {code: "P2034", clientVersion: "5.22.0"});});
  await assert.rejects(repository.createOwnTransaction(walletOwner, 7, {type: "DEPOSIT", for: "Cash", paidAmount: 1}), hasStatus(409));
});

test("creation target search verifies ownership, scopes tenant and paginates names only", async () => {
  mockMethod(prisma.employeeWallet, "findFirst", async () => wallet);
  const branch = mockMethod(prisma.branch, "findMany", async () => [{id: 11, name: "Branch"}]);
  const branchCount = mockMethod(prisma.branch, "count", async () => 60);
  const client = mockMethod(prisma.client, "findMany", async () => [{id: 30, user: {name: "Client"}}]);
  const clientCount = mockMethod(prisma.client, "count", async () => 1);
  assert.deepEqual(await repository.getOwnWalletTargets(walletOwner, 7, {kind: "branch", search: "Branch", page: 2, size: 50}), {data: [{id: 11, name: "Branch"}], page: 2, pagesCount: 2});
  const args = branch.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, {companyId: 1, name: {contains: "Branch", mode: "insensitive"}});
  assert.deepEqual(branchCount.mock.calls[0].arguments[0].where, args.where);
  assert.equal(args.skip, 50);
  assert.equal(args.take, 50);
  assert.deepEqual(await repository.getOwnWalletTargets(walletOwner, 7, {kind: "client", page: 1, size: 50}), {data: [{id: 30, name: "Client"}], page: 1, pagesCount: 1});
  assert.deepEqual(client.mock.calls[0].arguments[0].where, {companyId: 1, deleted: false, user: undefined});
  assert.deepEqual(clientCount.mock.calls[0].arguments[0].where, client.mock.calls[0].arguments[0].where);
  assert.equal(EmployeeWalletTargetsSchema.safeParse({kind: "employee"}).success, false);
  assert.equal(EmployeeWalletTargetsSchema.safeParse({kind: "client", size: 101}).success, false);
});
