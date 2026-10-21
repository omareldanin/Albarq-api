import assert from "node:assert/strict";
import {test} from "node:test";
import {ClientListFilterSchema, clientListFilterWhere} from "../src/app/clients/clients.filters";

test("omitted filters do not restrict clients", () => {
  const parsed = ClientListFilterSchema.parse({page: "2"});
  assert.deepEqual(parsed, {});
  assert.deepEqual(clientListFilterWhere(parsed), {activeProfit: undefined, user: undefined});
});

test("activeProfit distinguishes false, true and all", () => {
  for (const value of ["false", "true"] as const) {
    const parsed = ClientListFilterSchema.parse({activeProfit: value});
    assert.equal(clientListFilterWhere(parsed).activeProfit, value === "true");
  }
  assert.equal(ClientListFilterSchema.parse({}).activeProfit, undefined);
  for (const invalid of ["yes", "0", "", ["true", "false"]]) {
    assert.equal(ClientListFilterSchema.safeParse({activeProfit: invalid}).success, false);
  }
});

test("same-day range includes every instant of the selected Baghdad day", () => {
  const filters = ClientListFilterSchema.parse({created_from: "2026-10-21", created_to: "2026-10-21"});
  assert.deepEqual(clientListFilterWhere(filters), {
    activeProfit: undefined,
    user: {createdAt: {
      gte: new Date("2026-10-20T21:00:00.000Z"),
      lt: new Date("2026-10-21T21:00:00.000Z"),
    }},
  });
});

test("end date advances correctly across month and year boundaries", () => {
  for (const [date, expected] of [["2024-02-29", "2024-02-29T21:00:00.000Z"], ["2026-12-31", "2026-12-31T21:00:00.000Z"]]) {
    const where = clientListFilterWhere({created_to: date});
    assert.deepEqual(where.user, {createdAt: {gte: undefined, lt: new Date(expected)}});
  }
});

test("date and inactive-profit filters combine without dropping false", () => {
  const parsed = ClientListFilterSchema.parse({created_from: "2026-10-01", activeProfit: "false"});
  assert.deepEqual(clientListFilterWhere(parsed), {
    activeProfit: false,
    user: {createdAt: {gte: new Date("2026-09-30T21:00:00.000Z"), lt: undefined}},
  });
});

test("invalid, non-calendar and reversed dates are rejected", () => {
  for (const filters of [
    {created_from: "2026-02-30"}, {created_to: "2026-13-01"},
    {created_from: "not-a-date"}, {created_from: "2026-10-01T00:00:00Z"},
    {created_from: "2026-10-21", created_to: "2026-10-20"},
  ]) assert.equal(ClientListFilterSchema.safeParse(filters).success, false);
});
