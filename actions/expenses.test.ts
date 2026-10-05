import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  // A separate transaction client, so a write made on `db` instead of `tx` fails the tests.
  const tx = {
    salonExpense: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const db = {
    salonExpense: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, tx, requireSession: vi.fn(), hasPermission: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));

const { createExpense, deleteExpense, updateExpense } = await import("@/actions/expenses");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const admin = { id: "admin1", role: "ADMIN" };
const supervisor = { id: "super1", role: "SUPERVISOR" };
const signIn = (user: typeof admin) => mocks.requireSession.mockResolvedValue({ sessionId: "s1", user });

const stored = {
  title: "October rent",
  description: null,
  category: "RENT",
  amount: new Prisma.Decimal("4500"),
  date: new Date("2026-10-01T00:00:00.000Z"),
  createdById: "admin1",
};

const input = { title: " October rent ", description: "", category: "RENT", amount: "٤٥٠٠", date: "2026-10-01" };

function expectNothingWritten() {
  for (const client of [mocks.db, mocks.tx]) {
    expect(client.salonExpense.create).not.toHaveBeenCalled();
    expect(client.salonExpense.updateMany).not.toHaveBeenCalled();
    expect(client.salonExpense.deleteMany).not.toHaveBeenCalled();
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
  mocks.tx.salonExpense.findUnique.mockResolvedValue(stored);
  mocks.tx.salonExpense.create.mockResolvedValue({ id: "exp1" });
  mocks.tx.salonExpense.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.salonExpense.deleteMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  consoleError.mockRestore();
  vi.useRealTimers();
});

describe("createExpense", () => {
  it("stores the expense with its audit entry on the transaction client", async () => {
    const result = await createExpense(null, form({ ...input, createdById: "someone-else" }));

    expect(result).toEqual({ success: true, id: "exp1" });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "expenses.create");
    const data = { title: "October rent", description: null, category: "RENT", amount: "4500", date: "2026-10-01" };
    expect(mocks.tx.salonExpense.create).toHaveBeenCalledWith({
      data: { ...data, date: new Date("2026-10-01T00:00:00.000Z"), createdById: "admin1" },
      select: { id: true },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "expense.created", entity: "SalonExpense", entityId: "exp1", newValue: data },
    });
    expect(mocks.db.salonExpense.create).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expenses/exp1");
  });

  it("accepts today in the salon time zone", async () => {
    expect(await createExpense(null, form({ ...input, date: "2026-10-05" }))).toEqual({ success: true, id: "exp1" });
  });

  it("refuses a user without expenses.create", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await createExpense(null, form(input))).toEqual({ success: false, error: "forbidden", values: input });
    expectNothingWritten();
  });

  it("returns field errors and the submitted values for invalid input", async () => {
    const values = { title: "", description: "", category: "UTILITIES", amount: "0", date: "2026-10-06" };

    expect(await createExpense(null, form(values))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { title: "required", category: "invalid_input", amount: "invalid_input", date: "invalid_input" },
      values,
    });
    expectNothingWritten();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await createExpense(null, form(input))).toEqual({ success: false, error: "unexpected", values: input });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateExpense", () => {
  const unchanged = { id: "exp1", title: "October rent", description: "", category: "RENT", amount: "4500", date: "2026-10-01" };
  const edit = (values: Record<string, string> = {}) => updateExpense(null, form({ ...unchanged, ...values }));

  it("stores and audits only the changed fields", async () => {
    expect(await edit({ amount: "4600.50", date: "2026-09-30", description: "Paid late" })).toEqual({ success: true });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "expenses.edit");
    expect(mocks.tx.salonExpense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp1" },
      data: { description: "Paid late", amount: "4600.5", date: new Date("2026-09-30T00:00:00.000Z") },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "expense.updated",
        entity: "SalonExpense",
        entityId: "exp1",
        oldValue: { description: null, amount: "4500", date: "2026-10-01" },
        newValue: { description: "Paid late", amount: "4600.5", date: "2026-09-30" },
      },
    });
    expect(mocks.db.salonExpense.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expenses/exp1");
  });

  it("writes nothing when no value changed, treating 4500.00 as the stored 4500", async () => {
    expect(await edit({ amount: "4500.00", title: "  October rent " })).toEqual({ success: true });

    expect(mocks.tx.salonExpense.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a user without expenses.edit", async () => {
    signIn(supervisor);
    mocks.hasPermission.mockResolvedValue(false);

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "forbidden" });
    expect(mocks.hasPermission).toHaveBeenCalledWith(supervisor, "expenses.edit");
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
    expect(await updateExpense(null, form({ ...unchanged, id: "" }))).toMatchObject({ error: "invalid_input" });
    expectNothingWritten();
  });

  it("returns not_found for an unknown expense", async () => {
    mocks.tx.salonExpense.findUnique.mockResolvedValue(null);

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns not_found when the expense is deleted while the edit runs", async () => {
    mocks.tx.salonExpense.updateMany.mockResolvedValue({ count: 0 });

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "not_found" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await edit({ amount: "1" })).toMatchObject({ success: false, error: "unexpected" });
  });
});

describe("deleteExpense", () => {
  const remove = (id = "exp1") => deleteExpense(null, form({ id }));

  it("removes the expense and keeps the full record in the audit entry", async () => {
    expect(await remove()).toEqual({ success: true });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "expenses.delete");
    expect(mocks.tx.salonExpense.deleteMany).toHaveBeenCalledWith({ where: { id: "exp1" } });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "expense.deleted",
        entity: "SalonExpense",
        entityId: "exp1",
        oldValue: {
          title: "October rent",
          description: null,
          category: "RENT",
          amount: "4500",
          date: "2026-10-01",
          createdById: "admin1",
        },
      },
    });
    expect(mocks.db.salonExpense.deleteMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expenses");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/expenses/exp1");
  });

  it("returns not_found for an expense already deleted, writing nothing", async () => {
    mocks.tx.salonExpense.findUnique.mockResolvedValue(null);

    expect(await remove()).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns not_found when another delete wins the race", async () => {
    mocks.tx.salonExpense.deleteMany.mockResolvedValue({ count: 0 });

    expect(await remove()).toEqual({ success: false, error: "not_found" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a user without expenses.delete", async () => {
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
