import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() });
  // A separate transaction client, so a write made on `db` instead of `tx` fails the tests.
  const tx = { user: { findUnique: vi.fn() }, employeeExpense: model(), auditLog: { create: vi.fn() } };
  const db = {
    user: { findUnique: vi.fn() },
    employeeExpense: model(),
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, tx, requireSession: vi.fn(), hasPermission: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));

const { createEmployeeExpense, deleteEmployeeExpense, updateEmployeeExpense } = await import(
  "@/actions/employee-expenses"
);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const admin = { id: "admin1", role: "ADMIN" };
const supervisor = { id: "super1", role: "SUPERVISOR" };
const signIn = (user: typeof admin) => mocks.requireSession.mockResolvedValue({ sessionId: "s1", user });

const stored = {
  employeeId: "emp1",
  category: "CASH_ADVANCE",
  amount: new Prisma.Decimal("300"),
  description: null,
  date: new Date("2026-10-01T00:00:00.000Z"),
  createdById: "admin1",
};

const input = { category: "CASH_ADVANCE", amount: "٣٠٠", description: "", date: "2026-10-01" };

function expectNothingWritten() {
  for (const client of [mocks.db, mocks.tx]) {
    expect(client.employeeExpense.create).not.toHaveBeenCalled();
    expect(client.employeeExpense.updateMany).not.toHaveBeenCalled();
    expect(client.employeeExpense.deleteMany).not.toHaveBeenCalled();
    expect(client.auditLog.create).not.toHaveBeenCalled();
  }
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  // "Today" in Dubai is 2026-10-05.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T08:00:00Z"));
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn(admin);
  mocks.hasPermission.mockResolvedValue(true);
  mocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(mocks.tx));
  mocks.tx.user.findUnique.mockResolvedValue({ id: "emp1" });
  mocks.tx.employeeExpense.findUnique.mockResolvedValue(stored);
  mocks.tx.employeeExpense.create.mockResolvedValue({ id: "ded1" });
  mocks.tx.employeeExpense.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.employeeExpense.deleteMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  consoleError.mockRestore();
  vi.useRealTimers();
});

describe("createEmployeeExpense", () => {
  const create = (values: Record<string, string> = {}) =>
    createEmployeeExpense(null, form({ employeeId: "emp1", ...input, ...values }));

  it("stores the deduction with its audit entry on the transaction client", async () => {
    const result = await create({ createdById: "someone-else" });

    expect(result).toEqual({ success: true, id: "ded1" });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "employee_expenses.create");
    expect(mocks.tx.user.findUnique).toHaveBeenCalledWith({ where: { id: "emp1" }, select: { id: true } });
    const data = { category: "CASH_ADVANCE", amount: "300", description: null, date: "2026-10-01" };
    expect(mocks.tx.employeeExpense.create).toHaveBeenCalledWith({
      data: { ...data, employeeId: "emp1", date: new Date("2026-10-01T00:00:00.000Z"), createdById: "admin1" },
      select: { id: true },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "employee_expense.created",
        entity: "EmployeeExpense",
        entityId: "ded1",
        newValue: { employeeId: "emp1", ...data },
      },
    });
    expect(mocks.db.employeeExpense.create).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/emp1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/emp1/expenses/ded1");
  });

  it("records a deduction for an inactive employee, who only has to exist", async () => {
    // The lookup checks existence only; it never filters on isActive.
    expect(await create()).toEqual({ success: true, id: "ded1" });
    expect(mocks.tx.user.findUnique.mock.calls[0][0].where).toEqual({ id: "emp1" });
  });

  it("returns not_found for an unknown employee, writing nothing", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(null);

    expect(await create({ employeeId: "ghost" })).toMatchObject({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("rejects a missing employee id", async () => {
    expect(await create({ employeeId: "" })).toMatchObject({ success: false, error: "invalid_input" });
    expectNothingWritten();
  });

  it("refuses a user without employee_expenses.create", async () => {
    signIn(supervisor);
    mocks.hasPermission.mockResolvedValue(false);

    expect(await create()).toEqual({ success: false, error: "forbidden", values: input });
    expect(mocks.hasPermission).toHaveBeenCalledWith(supervisor, "employee_expenses.create");
    expectNothingWritten();
  });

  it("returns field errors and the submitted values for invalid input", async () => {
    const values = { category: "RENT", amount: "0", description: "", date: "2026-10-06" };

    expect(await create(values)).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { category: "invalid_input", amount: "invalid_input", date: "invalid_input" },
      values,
    });
    expect(await create({ category: "", amount: "" })).toMatchObject({
      fieldErrors: { category: "required", amount: "required" },
    });
    expectNothingWritten();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await create()).toEqual({ success: false, error: "unexpected", values: input });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateEmployeeExpense", () => {
  const unchanged = { id: "ded1", category: "CASH_ADVANCE", amount: "300", description: "", date: "2026-10-01" };
  const edit = (values: Record<string, string> = {}) => updateEmployeeExpense(null, form({ ...unchanged, ...values }));

  it("stores and audits only the changed fields, never the employee", async () => {
    expect(
      await edit({ category: "WITHDRAWAL", amount: "350.50", date: "2026-09-30", employeeId: "emp2" }),
    ).toEqual({ success: true });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "employee_expenses.edit");
    expect(mocks.tx.employeeExpense.updateMany).toHaveBeenCalledWith({
      where: { id: "ded1" },
      data: { category: "WITHDRAWAL", amount: "350.5", date: new Date("2026-09-30T00:00:00.000Z") },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "employee_expense.updated",
        entity: "EmployeeExpense",
        entityId: "ded1",
        oldValue: { category: "CASH_ADVANCE", amount: "300", date: "2026-10-01" },
        newValue: { category: "WITHDRAWAL", amount: "350.5", date: "2026-09-30" },
      },
    });
    expect(mocks.db.employeeExpense.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/emp1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/emp1/expenses/ded1");
  });

  it("writes nothing when no value changed, treating 300.00 as the stored 300", async () => {
    expect(await edit({ amount: "300.00", description: "  " })).toEqual({ success: true });

    expect(mocks.tx.employeeExpense.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a user without employee_expenses.edit", async () => {
    signIn(supervisor);
    mocks.hasPermission.mockResolvedValue(false);

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "forbidden" });
    expect(mocks.hasPermission).toHaveBeenCalledWith(supervisor, "employee_expenses.edit");
    expectNothingWritten();
  });

  it("returns field errors for a future date", async () => {
    expect(await edit({ date: "2026-10-06" })).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { date: "invalid_input" },
      values: { date: "2026-10-06" },
    });
    expectNothingWritten();
  });

  it("rejects a missing id", async () => {
    expect(await edit({ id: "" })).toMatchObject({ error: "invalid_input" });
    expectNothingWritten();
  });

  it("returns not_found for an unknown deduction", async () => {
    mocks.tx.employeeExpense.findUnique.mockResolvedValue(null);

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns not_found when the deduction is deleted while the edit runs", async () => {
    mocks.tx.employeeExpense.updateMany.mockResolvedValue({ count: 0 });

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "not_found" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "unexpected" });
  });
});

describe("deleteEmployeeExpense", () => {
  const remove = (id = "ded1") => deleteEmployeeExpense(null, form({ id }));

  it("removes the deduction and keeps the full record in the audit entry", async () => {
    expect(await remove()).toEqual({ success: true });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "employee_expenses.delete");
    expect(mocks.tx.employeeExpense.deleteMany).toHaveBeenCalledWith({ where: { id: "ded1" } });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "employee_expense.deleted",
        entity: "EmployeeExpense",
        entityId: "ded1",
        oldValue: {
          employeeId: "emp1",
          category: "CASH_ADVANCE",
          amount: "300",
          description: null,
          date: "2026-10-01",
          createdById: "admin1",
        },
      },
    });
    expect(mocks.db.employeeExpense.deleteMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/emp1");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/employees/emp1/expenses/ded1");
  });

  it("returns not_found for a deduction already deleted, writing nothing", async () => {
    mocks.tx.employeeExpense.findUnique.mockResolvedValue(null);

    expect(await remove()).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns not_found when another delete wins the race", async () => {
    mocks.tx.employeeExpense.deleteMany.mockResolvedValue({ count: 0 });

    expect(await remove()).toEqual({ success: false, error: "not_found" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a user without employee_expenses.delete", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await remove()).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("rejects a missing id", async () => {
    expect(await remove("")).toEqual({ success: false, error: "invalid_input" });
    expectNothingWritten();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await remove()).toEqual({ success: false, error: "unexpected" });
  });
});
