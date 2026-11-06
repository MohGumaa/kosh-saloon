import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { monthPeriod } from "@/lib/settlements";

const mocks = vi.hoisted(() => {
  // A separate transaction client, so a write made on `db` instead of `tx` fails the tests.
  const tx = {
    invoice: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createManyAndReturn: vi.fn(),
      updateMany: vi.fn(),
    },
    employeeSettlement: { findFirst: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
  };
  const db = {
    invoice: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, tx, requireSession: vi.fn(), hasPermission: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));

const { createInvoice, setInvoiceStatus, updateInvoice } = await import("@/actions/invoices");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const admin = { id: "admin1", role: "ADMIN" };
const staff = { id: "staff1", role: "STAFF" };
const signIn = (user: typeof admin) => mocks.requireSession.mockResolvedValue({ sessionId: "s1", user });

const stored = {
  employeeId: "emp1",
  serviceId: "svc1",
  amount: new Prisma.Decimal("50"),
  status: "UNPAID",
  // 14:00:45 on 15 September in Dubai.
  createdAt: new Date("2026-09-15T10:00:45.000Z"),
};

const input = {
  employeeId: "emp1",
  serviceId: "svc1",
  amount: "٥٠٫٥",
  status: "PAID",
  date: "2026-09-15",
  count: "1",
};

// 10:30 on 15 September in Dubai, the "today" of every create test.
const now = new Date("2026-09-15T06:30:00.000Z");

function expectNothingWritten() {
  for (const client of [mocks.db, mocks.tx]) {
    expect(client.invoice.create).not.toHaveBeenCalled();
    expect(client.invoice.updateMany).not.toHaveBeenCalled();
    expect(client.auditLog.create).not.toHaveBeenCalled();
  }
  expect(mocks.tx.invoice.createManyAndReturn).not.toHaveBeenCalled();
  expect(mocks.tx.auditLog.createMany).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

const uniqueViolation = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn(admin);
  mocks.hasPermission.mockResolvedValue(true);
  mocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(mocks.tx));
  mocks.db.user.findUnique.mockResolvedValue({ isActive: true });
  mocks.db.service.findUnique.mockResolvedValue({ isActive: true });
  mocks.db.invoice.findUnique.mockResolvedValue(stored);
  mocks.tx.invoice.findFirst.mockResolvedValue({ invoiceNumber: "INV-000041" });
  mocks.tx.invoice.findUnique.mockResolvedValue(stored);
  mocks.tx.invoice.create.mockResolvedValue({ id: "inv1" });
  // Echoes the rows back as inv1, inv2, … in the order they were sent.
  mocks.tx.invoice.createManyAndReturn.mockImplementation(async ({ data }: { data: { invoiceNumber: string }[] }) =>
    data.map((row, index) => ({ id: `inv${index + 1}`, invoiceNumber: row.invoiceNumber })),
  );
  mocks.tx.invoice.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.employeeSettlement.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("createInvoice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const data = { employeeId: "emp1", serviceId: "svc1", amount: "50.5", status: "PAID" };

  /** The rows sent in the one bulk invoice insert. */
  const createdRows = () => mocks.tx.invoice.createManyAndReturn.mock.calls[0][0].data;
  /** The entries sent in the one bulk audit insert. */
  const auditRows = () => mocks.tx.auditLog.createMany.mock.calls[0][0].data;

  it("stores the next number dated now with its audit entry in one transaction", async () => {
    const result = await createInvoice(null, form(input));

    expect(result).toEqual({ success: true, id: "inv1", count: 1 });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "invoices.create");
    expect(mocks.tx.invoice.createManyAndReturn).toHaveBeenCalledWith({
      data: [{ ...data, invoiceNumber: "INV-000042", createdAt: now, createdById: "admin1" }],
      select: { id: true, invoiceNumber: true },
    });
    expect(mocks.tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "admin1",
          action: "invoice.created",
          entity: "Invoice",
          entityId: "inv1",
          newValue: { invoiceNumber: "INV-000042", ...data, createdAt: now.toISOString() },
        },
      ],
    });
    // September 2026 is the month the invoice lands in.
    expect(mocks.tx.employeeSettlement.findFirst).toHaveBeenCalledWith({
      where: {
        status: { in: ["APPROVED", "PAID"] },
        OR: [{ employeeId: "emp1", periodStart: monthPeriod("2026-09").periodStart }],
      },
      select: { id: true },
    });
    expect(mocks.db.invoice.create).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("starts at INV-000001", async () => {
    mocks.tx.invoice.findFirst.mockResolvedValue(null);

    await createInvoice(null, form(input));

    expect(createdRows()).toEqual([expect.objectContaining({ invoiceNumber: "INV-000001" })]);
  });

  it("invoices a Staff user themself, ignoring the submitted employee", async () => {
    signIn(staff);

    await createInvoice(null, form({ ...input, employeeId: "someone-else" }));

    expect(mocks.db.user.findUnique).toHaveBeenCalledWith({ where: { id: "staff1" }, select: { isActive: true } });
    expect(createdRows()).toEqual([expect.objectContaining({ employeeId: "staff1", createdById: "staff1" })]);
  });

  it("lets a Staff user create only a Paid or Unpaid invoice", async () => {
    signIn(staff);

    expect(await createInvoice(null, form({ ...input, status: "UNPAID" }))).toEqual({
      success: true,
      id: "inv1",
      count: 1,
    });
    expect(createdRows()[0]).toMatchObject({ status: "UNPAID", amount: "50.5" });

    vi.clearAllMocks();
    const values = { ...input, status: "CANCELLED" };
    expect(await createInvoice(null, form(values))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { status: "invalid_input" },
      values: { ...values, employeeId: "staff1" },
    });
    expectNothingWritten();
  });

  it("refuses a user without invoices.create", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await createInvoice(null, form(input))).toEqual({ success: false, error: "forbidden", values: input });
    expectNothingWritten();
  });

  it("returns field errors and the submitted values for invalid input", async () => {
    const values = { employeeId: "", serviceId: "svc1", amount: "0", status: "CANCELLED", date: "2026-09-15", count: "1" };

    expect(await createInvoice(null, form(values))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { employeeId: "required", amount: "invalid_input", status: "invalid_input" },
      values,
    });
    expectNothingWritten();
  });

  it("reports an inactive employee and an unknown service", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ isActive: false });
    mocks.db.service.findUnique.mockResolvedValue(null);

    expect(await createInvoice(null, form(input))).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { employeeId: "not_available", serviceId: "not_available" },
    });
    expectNothingWritten();
  });

  it("takes a fresh number when another create took the same one", async () => {
    mocks.db.$transaction
      .mockRejectedValueOnce(uniqueViolation)
      .mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback(mocks.tx));

    expect(await createInvoice(null, form(input))).toEqual({ success: true, id: "inv1", count: 1 });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("creates several identical invoices in one insert, with one audit insert holding an entry each", async () => {
    expect(await createInvoice(null, form({ ...input, count: "٣" }))).toEqual({ success: true, id: "inv1", count: 3 });

    expect(createdRows()).toEqual(
      ["INV-000042", "INV-000043", "INV-000044"].map((invoiceNumber) => ({
        ...data,
        invoiceNumber,
        createdAt: now,
        createdById: "admin1",
      })),
    );
    expect(auditRows().map((entry: { entityId: string; newValue: { invoiceNumber: string } }) => [
      entry.entityId,
      entry.newValue.invoiceNumber,
    ])).toEqual([
      ["inv1", "INV-000042"],
      ["inv2", "INV-000043"],
      ["inv3", "INV-000044"],
    ]);
    // A fixed number of queries whatever the count, so a batch stays inside the transaction timeout.
    expect(mocks.tx.invoice.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(mocks.tx.auditLog.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.invoice.create).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.invoice.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns the lowest-numbered invoice even when the rows come back in another order", async () => {
    mocks.tx.invoice.createManyAndReturn.mockResolvedValue([
      { id: "invB", invoiceNumber: "INV-000043" },
      { id: "invA", invoiceNumber: "INV-000042" },
    ]);

    expect(await createInvoice(null, form({ ...input, count: "2" }))).toEqual({ success: true, id: "invA", count: 2 });
    expect(auditRows().map((entry: { entityId: string }) => entry.entityId)).toEqual(["invB", "invA"]);
  });

  it("dates a past day's invoices at 12:00 salon time and checks that day's month", async () => {
    await createInvoice(null, form({ ...input, date: "2026-08-31", count: "2" }));

    const dates = createdRows().map((row: { createdAt: Date }) => row.createdAt);
    expect(dates).toEqual([new Date("2026-08-31T08:00:00.000Z"), new Date("2026-08-31T08:00:00.000Z")]);
    expect(mocks.tx.employeeSettlement.findFirst.mock.calls[0][0].where.OR).toEqual([
      { employeeId: "emp1", periodStart: monthPeriod("2026-08").periodStart },
    ]);
  });

  it.each([
    ["a future day", { date: "2026-09-16" }, { date: "invalid_input" }],
    ["a missing day", { date: "" }, { date: "required" }],
    ["too many invoices", { count: "21" }, { count: "invalid_input" }],
    ["zero invoices", { count: "0" }, { count: "invalid_input" }],
    ["a missing count", { count: "" }, { count: "required" }],
  ])("refuses %s", async (_name, change, fieldErrors) => {
    const values = { ...input, ...change };

    expect(await createInvoice(null, form(values))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors,
      values,
    });
    expectNothingWritten();
  });

  it("refuses a month whose settlement is approved or paid, writing nothing", async () => {
    mocks.tx.employeeSettlement.findFirst.mockResolvedValue({ id: "set1" });

    expect(await createInvoice(null, form({ ...input, count: "3" }))).toEqual({
      success: false,
      error: "settlement_locked",
      values: { ...input, count: "3" },
    });
    expectNothingWritten();
  });

  it("retries the whole batch after a number collision", async () => {
    mocks.db.$transaction
      .mockRejectedValueOnce(uniqueViolation)
      .mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback(mocks.tx));

    expect(await createInvoice(null, form({ ...input, count: "2" }))).toMatchObject({ success: true, count: 2 });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.tx.invoice.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(createdRows()).toHaveLength(2);
  });

  it("gives up after three collisions", async () => {
    mocks.db.$transaction.mockRejectedValue(uniqueViolation);

    expect(await createInvoice(null, form(input))).toEqual({ success: false, error: "unexpected", values: input });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns unexpected when the database fails, without retrying", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await createInvoice(null, form(input))).toMatchObject({ success: false, error: "unexpected" });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("updateInvoice", () => {
  const edit = (values: Record<string, string> = {}) =>
    updateInvoice(
      null,
      form({ id: "inv1", employeeId: "emp1", serviceId: "svc1", amount: "50", date: "2026-09-15T14:00", ...values }),
    );

  const september = new Date("2026-09-01T00:00:00.000Z");
  const october = new Date("2026-10-01T00:00:00.000Z");
  const lockQuery = (...pairs: [string, Date][]) => ({
    where: {
      status: { in: ["APPROVED", "PAID"] },
      OR: pairs.map(([employeeId, periodStart]) => ({ employeeId, periodStart })),
    },
    select: { id: true },
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves the date with an audit entry after checking both settlement months", async () => {
    expect(await edit({ date: "2026-10-01T00:30" })).toEqual({ success: true });

    expect(mocks.tx.employeeSettlement.findFirst).toHaveBeenCalledWith(
      lockQuery(["emp1", september], ["emp1", october]),
    );
    expect(mocks.tx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv1", status: { not: "CANCELLED" } },
      data: { createdAt: new Date("2026-09-30T20:30:00.000Z") },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "invoice.updated",
        entity: "Invoice",
        entityId: "inv1",
        oldValue: { createdAt: "2026-09-15T10:00:45.000Z" },
        newValue: { createdAt: "2026-09-30T20:30:00.000Z" },
      },
    });
  });

  it("keeps the stored seconds when the minute is unchanged", async () => {
    expect(await edit()).toEqual({ success: true });

    expect(mocks.tx.employeeSettlement.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("does not check settlements for an amount or service change", async () => {
    expect(await edit({ amount: "70" })).toEqual({ success: true });

    expect(mocks.tx.employeeSettlement.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a date move when either month has an approved or paid settlement", async () => {
    mocks.tx.employeeSettlement.findFirst.mockResolvedValue({ id: "set1" });

    expect(await edit({ date: "2026-10-02T09:00", amount: "70" })).toMatchObject({
      success: false,
      error: "settlement_locked",
    });
    expectNothingWritten();
  });

  it("checks the old and new employee for the same month on an employee change", async () => {
    mocks.tx.employeeSettlement.findFirst.mockResolvedValue({ id: "set1" });

    expect(await edit({ employeeId: "emp2" })).toMatchObject({ success: false, error: "settlement_locked" });
    expect(mocks.tx.employeeSettlement.findFirst).toHaveBeenCalledWith(
      lockQuery(["emp1", september], ["emp2", september]),
    );
    expectNothingWritten();
  });

  it.each([
    ["a future time", "2026-10-19T12:01", "invalid_input"],
    ["an impossible time", "2026-09-31T10:00", "invalid_input"],
    ["an empty value", "", "required"],
  ])("returns a date field error for %s", async (_label, date, code) => {
    expect(await edit({ date })).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { date: code },
    });
    expectNothingWritten();
  });

  it("stores and audits only the changed fields on the transaction client", async () => {
    expect(await edit({ amount: "60.00", serviceId: "svc2" })).toEqual({ success: true });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "invoices.edit");
    expect(mocks.db.service.findUnique).toHaveBeenCalledWith({ where: { id: "svc2" }, select: { isActive: true } });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv1", status: { not: "CANCELLED" } },
      data: { serviceId: "svc2", amount: "60" },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "invoice.updated",
        entity: "Invoice",
        entityId: "inv1",
        oldValue: { serviceId: "svc1", amount: "50" },
        newValue: { serviceId: "svc2", amount: "60" },
      },
    });
    expect(mocks.db.invoice.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions/inv1");
  });

  it("writes nothing when no value changed, treating 50.00 as the stored 50", async () => {
    expect(await edit({ amount: "50.00" })).toEqual({ success: true });

    expect(mocks.tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps an employee and service that have since been deactivated", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ isActive: false });
    mocks.db.service.findUnique.mockResolvedValue({ isActive: false });

    expect(await edit({ amount: "70" })).toEqual({ success: true });
  });

  it("refuses a newly chosen inactive employee", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ isActive: false });

    expect(await edit({ employeeId: "emp2" })).toMatchObject({ fieldErrors: { employeeId: "not_available" } });
    expectNothingWritten();
  });

  it("refuses a user without invoices.edit", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await edit({ amount: "60" })).toMatchObject({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("refuses a Staff user even with invoices.edit", async () => {
    signIn(staff);

    expect(await edit({ amount: "60" })).toMatchObject({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("returns field errors for an invalid amount", async () => {
    expect(await edit({ amount: "50.555" })).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { amount: "invalid_input" },
    });
    expectNothingWritten();
  });

  it("returns not_found for an unknown invoice", async () => {
    mocks.db.invoice.findUnique.mockResolvedValue(null);

    expect(await edit({ id: "missing" })).toMatchObject({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("refuses to change a cancelled invoice", async () => {
    mocks.db.invoice.findUnique.mockResolvedValue({ ...stored, status: "CANCELLED" });

    expect(await edit({ amount: "60" })).toMatchObject({ success: false, error: "cancelled" });
    expectNothingWritten();
  });

  it("refuses when the invoice is cancelled while the edit runs", async () => {
    mocks.tx.invoice.updateMany.mockResolvedValue({ count: 0 });

    expect(await edit({ amount: "60" })).toMatchObject({ success: false, error: "cancelled" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await edit({ amount: "60" })).toMatchObject({ success: false, error: "unexpected" });
  });
});

describe("setInvoiceStatus", () => {
  const setStatus = (status: string, id = "inv1") => setInvoiceStatus(null, form({ id, status }));

  it.each([
    ["UNPAID", "PAID", "invoice.paid"],
    ["PAID", "UNPAID", "invoice.unpaid"],
    ["PAID", "CANCELLED", "invoice.cancelled"],
    ["UNPAID", "CANCELLED", "invoice.cancelled"],
  ])("moves %s to %s with %s", async (from, to, action) => {
    mocks.tx.invoice.findUnique.mockResolvedValue({ status: from });

    expect(await setStatus(to)).toEqual({ success: true });

    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "invoices.change_status");
    expect(mocks.tx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "inv1", status: { not: "CANCELLED" } },
      data: { status: to },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action,
        entity: "Invoice",
        entityId: "inv1",
        oldValue: { status: from },
        newValue: { status: to },
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions/inv1");
  });

  it("writes nothing when the status already matches", async () => {
    mocks.tx.invoice.findUnique.mockResolvedValue({ status: "PAID" });

    expect(await setStatus("PAID")).toEqual({ success: true });
    expect(mocks.tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("never changes a cancelled invoice", async () => {
    mocks.tx.invoice.findUnique.mockResolvedValue({ status: "CANCELLED" });

    expect(await setStatus("PAID")).toEqual({ success: false, error: "cancelled" });
    expectNothingWritten();
  });

  it("refuses when the invoice is cancelled while the change runs", async () => {
    mocks.tx.invoice.updateMany.mockResolvedValue({ count: 0 });

    expect(await setStatus("PAID")).toEqual({ success: false, error: "cancelled" });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a user without invoices.change_status", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await setStatus("PAID")).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("refuses a Staff user even with invoices.change_status", async () => {
    signIn(staff);

    expect(await setStatus("CANCELLED")).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("rejects an invalid status value", async () => {
    expect(await setStatus("REFUNDED")).toEqual({ success: false, error: "invalid_input" });
    expectNothingWritten();
  });

  it("returns not_found for an unknown invoice", async () => {
    mocks.tx.invoice.findUnique.mockResolvedValue(null);

    expect(await setStatus("PAID", "missing")).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await setStatus("PAID")).toEqual({ success: false, error: "unexpected" });
  });
});
