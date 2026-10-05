import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  // A separate transaction client, so a write made on `db` instead of `tx` fails the tests.
  const tx = {
    invoice: { groupBy: vi.fn(), aggregate: vi.fn() },
    employeeExpense: { groupBy: vi.fn(), aggregate: vi.fn() },
    employeeSettlement: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    user: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    salonSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const db = {
    employeeSettlement: { create: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, tx, requireSession: vi.fn(), hasPermission: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));

const { approveSettlement, generateSettlements, markSettlementCalculated, markSettlementPaid, recalculateSettlement } =
  await import("@/actions/settlements");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const admin = { id: "admin1", role: "ADMIN" };
const staff = { id: "staff1", role: "STAFF" };
const signIn = (user: typeof admin) => mocks.requireSession.mockResolvedValue({ sessionId: "s1", user });
const decimal = (value: string) => new Prisma.Decimal(value);
const sum = (value: string | null) => ({ _sum: { amount: value === null ? null : decimal(value) } });

const september = { periodStart: new Date("2026-09-01T00:00:00.000Z"), periodEnd: new Date("2026-09-30T00:00:00.000Z") };

const stored = (status: string) => ({
  employeeId: "emp1",
  periodStart: september.periodStart,
  status,
  totalRevenue: decimal("4000"),
  sharePercentage: decimal("50"),
  employeeShare: decimal("2000"),
  totalExpenses: decimal("300"),
  totalAdjustments: decimal("0"),
  finalAmount: decimal("1700"),
});

function expectNothingWritten() {
  for (const client of [mocks.db, mocks.tx]) {
    expect(client.employeeSettlement.create).not.toHaveBeenCalled();
    expect(client.employeeSettlement.updateMany).not.toHaveBeenCalled();
    expect(client.auditLog.create).not.toHaveBeenCalled();
  }
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  // The salon month in Dubai is 2026-10.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T08:00:00Z"));
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn(admin);
  mocks.hasPermission.mockResolvedValue(true);
  mocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(mocks.tx));
  mocks.tx.salonSettings.findUnique.mockResolvedValue({ employeeSharePercentage: decimal("50") });
  mocks.tx.invoice.groupBy.mockResolvedValue([{ employeeId: "emp1" }, { employeeId: "emp2" }]);
  mocks.tx.employeeExpense.groupBy.mockResolvedValue([{ employeeId: "emp1" }, { employeeId: "emp3" }]);
  mocks.tx.employeeSettlement.findMany.mockResolvedValue([{ employeeId: "emp2" }]);
  mocks.tx.user.findMany.mockResolvedValue([
    { id: "emp1", sharePercentage: null },
    { id: "emp3", sharePercentage: decimal("0") },
  ]);
  mocks.tx.user.findUniqueOrThrow.mockResolvedValue({ id: "emp1", sharePercentage: null });
  mocks.tx.invoice.aggregate.mockImplementation(async ({ where }: { where: { employeeId: string } }) =>
    sum(where.employeeId === "emp1" ? "5000" : null),
  );
  mocks.tx.employeeExpense.aggregate.mockImplementation(async ({ where }: { where: { employeeId: string } }) =>
    sum(where.employeeId === "emp1" ? "300" : "150"),
  );
  mocks.tx.employeeSettlement.create.mockImplementation(async ({ data }: { data: { employeeId: string } }) => ({
    id: `set-${data.employeeId}`,
  }));
  mocks.tx.employeeSettlement.findUnique.mockResolvedValue(stored("DRAFT"));
  mocks.tx.employeeSettlement.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  consoleError.mockRestore();
  vi.useRealTimers();
});

describe("generateSettlements", () => {
  const generate = (month = "2026-09") => generateSettlements(null, form({ month }));

  it("creates a DRAFT for each active employee without one, with its audit entry", async () => {
    expect(await generate()).toEqual({ success: true, created: 2 });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "settlements.create");
    // emp2 already has September; emp1 and emp3 had revenue or expenses.
    expect(mocks.tx.user.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["emp1", "emp3"] } });
    expect(mocks.tx.employeeSettlement.create).toHaveBeenCalledTimes(2);
    const first = mocks.tx.employeeSettlement.create.mock.calls[0][0].data;
    expect(first).toMatchObject({ employeeId: "emp1", ...september, status: "DRAFT", createdById: "admin1" });
    expect(first.employeeShare.toFixed(2)).toBe("2500.00");
    expect(first.finalAmount.toFixed(2)).toBe("2200.00");
    const second = mocks.tx.employeeSettlement.create.mock.calls[1][0].data;
    expect(second.sharePercentage.toFixed(2)).toBe("0.00");
    expect(second.finalAmount.toFixed(2)).toBe("-150.00");
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "settlement.generated",
        entity: "EmployeeSettlement",
        entityId: "set-emp1",
        newValue: {
          employeeId: "emp1",
          month: "2026-09",
          status: "DRAFT",
          totalRevenue: "5000.00",
          sharePercentage: "50.00",
          employeeShare: "2500.00",
          totalExpenses: "300.00",
          totalAdjustments: "0.00",
          finalAmount: "2200.00",
        },
      },
    });
    expect(mocks.db.employeeSettlement.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settlements");
  });

  it("succeeds with nothing created when every active employee is settled", async () => {
    mocks.tx.employeeSettlement.findMany.mockResolvedValue([{ employeeId: "emp1" }, { employeeId: "emp2" }, { employeeId: "emp3" }]);

    expect(await generate()).toEqual({ success: true, created: 0, nothing: "already_settled" });
    expect(mocks.tx.employeeSettlement.create).not.toHaveBeenCalled();
  });

  it("succeeds with nothing created for a month without activity", async () => {
    mocks.tx.invoice.groupBy.mockResolvedValue([]);
    mocks.tx.employeeExpense.groupBy.mockResolvedValue([]);

    expect(await generate()).toEqual({ success: true, created: 0, nothing: "no_activity" });
    expect(mocks.tx.employeeSettlement.findMany).not.toHaveBeenCalled();
  });

  it("rejects the current, a future, and a malformed month", async () => {
    for (const month of ["2026-10", "2026-11", "2026-9", "abc", ""]) {
      expect(await generate(month), month).toEqual({ success: false, error: "invalid_input" });
    }
    expectNothingWritten();
  });

  it("is forbidden without settlements.create", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await generate()).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("is forbidden to Staff even holding the permission", async () => {
    signIn(staff);

    expect(await generate()).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("reports a concurrent generate as invalid_state", async () => {
    mocks.tx.employeeSettlement.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    expect(await generate()).toEqual({ success: false, error: "invalid_state" });
  });

  it("reports anything else as unexpected", async () => {
    mocks.tx.employeeSettlement.create.mockRejectedValue(new Error("down"));

    expect(await generate()).toEqual({ success: false, error: "unexpected" });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("status actions", () => {
  const run = (action: typeof approveSettlement, id = "set1") => action(null, form({ id }));

  it("recalculates with fresh values back to DRAFT", async () => {
    mocks.tx.employeeSettlement.findUnique.mockResolvedValue(stored("CALCULATED"));

    expect(await run(recalculateSettlement)).toEqual({ success: true });
    const { where, data } = mocks.tx.employeeSettlement.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "set1", status: "CALCULATED" });
    expect(data.status).toBe("DRAFT");
    expect(data.totalRevenue.toFixed(2)).toBe("5000.00");
    expect(data.finalAmount.toFixed(2)).toBe("2200.00");
    expect(mocks.tx.invoice.aggregate.mock.calls[0][0].where.employeeId).toBe("emp1");
    const audit = mocks.tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: "settlement.recalculated", entity: "EmployeeSettlement", entityId: "set1" });
    expect(audit.oldValue).toMatchObject({ month: "2026-09", status: "CALCULATED", totalRevenue: "4000.00", finalAmount: "1700.00" });
    expect(audit.newValue).toMatchObject({ month: "2026-09", status: "DRAFT", totalRevenue: "5000.00", finalAmount: "2200.00" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settlements/set1");
  });

  it("marks a DRAFT calculated without touching its values", async () => {
    expect(await run(markSettlementCalculated)).toEqual({ success: true });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "settlements.create");
    expect(mocks.tx.employeeSettlement.updateMany).toHaveBeenCalledWith({
      where: { id: "set1", status: "DRAFT" },
      data: { status: "CALCULATED" },
    });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "settlement.calculated",
      oldValue: { employeeId: "emp1", month: "2026-09", status: "DRAFT" },
      newValue: { employeeId: "emp1", month: "2026-09", status: "CALCULATED" },
    });
  });

  it("approves as the acting user", async () => {
    mocks.tx.employeeSettlement.findUnique.mockResolvedValue(stored("CALCULATED"));

    expect(await run(approveSettlement)).toEqual({ success: true });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "settlements.approve");
    expect(mocks.tx.employeeSettlement.updateMany).toHaveBeenCalledWith({
      where: { id: "set1", status: "CALCULATED" },
      data: { status: "APPROVED", approvedById: "admin1", approvedAt: new Date("2026-10-05T08:00:00Z") },
    });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data.action).toBe("settlement.approved");
  });

  it("marks an approved settlement paid", async () => {
    mocks.tx.employeeSettlement.findUnique.mockResolvedValue(stored("APPROVED"));

    expect(await run(markSettlementPaid)).toEqual({ success: true });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "settlements.mark_paid");
    expect(mocks.tx.employeeSettlement.updateMany).toHaveBeenCalledWith({
      where: { id: "set1", status: "APPROVED" },
      data: { status: "PAID", paidAt: new Date("2026-10-05T08:00:00Z") },
    });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data.action).toBe("settlement.paid");
  });

  it("rejects a change from the wrong status, writing nothing", async () => {
    const cases: [typeof approveSettlement, string][] = [
      [recalculateSettlement, "APPROVED"],
      [recalculateSettlement, "PAID"],
      [markSettlementCalculated, "CALCULATED"],
      [approveSettlement, "DRAFT"],
      [markSettlementPaid, "CALCULATED"],
      [markSettlementPaid, "PAID"],
    ];
    for (const [action, status] of cases) {
      mocks.tx.employeeSettlement.findUnique.mockResolvedValue(stored(status));
      expect(await run(action), `${action.name} ${status}`).toEqual({ success: false, error: "invalid_state" });
    }
    expectNothingWritten();
  });

  it("rejects a stale change whose status moved meanwhile, with no audit entry", async () => {
    mocks.tx.employeeSettlement.updateMany.mockResolvedValue({ count: 0 });

    expect(await run(markSettlementCalculated)).toEqual({ success: false, error: "invalid_state" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown settlement", async () => {
    mocks.tx.employeeSettlement.findUnique.mockResolvedValue(null);

    expect(await run(approveSettlement, "ghost")).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns invalid_input for a missing id", async () => {
    expect(await approveSettlement(null, form({}))).toEqual({ success: false, error: "invalid_input" });
    expectNothingWritten();
  });

  it("is forbidden without the action's permission", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    for (const action of [recalculateSettlement, markSettlementCalculated, approveSettlement, markSettlementPaid]) {
      expect(await run(action)).toEqual({ success: false, error: "forbidden" });
    }
    expectNothingWritten();
  });

  it("is forbidden to Staff even holding every permission", async () => {
    signIn(staff);

    for (const action of [recalculateSettlement, markSettlementCalculated, approveSettlement, markSettlementPaid]) {
      expect(await run(action)).toEqual({ success: false, error: "forbidden" });
    }
    expect(mocks.tx.employeeSettlement.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("reports an unexpected failure", async () => {
    mocks.tx.employeeSettlement.updateMany.mockRejectedValue(new Error("down"));

    expect(await run(markSettlementCalculated)).toEqual({ success: false, error: "unexpected" });
    expect(consoleError).toHaveBeenCalled();
  });
});
