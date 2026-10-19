import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  // A separate transaction client, so a write made on `db` instead of `tx` fails the tests.
  const tx = {
    invoice: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    employeeSettlement: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
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

const input = { employeeId: "emp1", serviceId: "svc1", amount: "٥٠٫٥", status: "PAID" };

function expectNothingWritten() {
  for (const client of [mocks.db, mocks.tx]) {
    expect(client.invoice.create).not.toHaveBeenCalled();
    expect(client.invoice.updateMany).not.toHaveBeenCalled();
    expect(client.auditLog.create).not.toHaveBeenCalled();
  }
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
  mocks.tx.invoice.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.employeeSettlement.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("createInvoice", () => {
  it("stores the next number with its audit entry in one transaction", async () => {
    const result = await createInvoice(null, form(input));

    expect(result).toEqual({ success: true, id: "inv1" });
    expect(mocks.hasPermission).toHaveBeenCalledWith(admin, "invoices.create");
    const data = { employeeId: "emp1", serviceId: "svc1", amount: "50.5", status: "PAID" };
    expect(mocks.tx.invoice.create).toHaveBeenCalledWith({
      data: { ...data, invoiceNumber: "INV-000042", createdById: "admin1" },
      select: { id: true },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "invoice.created",
        entity: "Invoice",
        entityId: "inv1",
        newValue: { invoiceNumber: "INV-000042", ...data },
      },
    });
    expect(mocks.db.invoice.create).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("starts at INV-000001", async () => {
    mocks.tx.invoice.findFirst.mockResolvedValue(null);

    await createInvoice(null, form(input));

    expect(mocks.tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoiceNumber: "INV-000001" }) }),
    );
  });

  it("invoices a Staff user themself, ignoring the submitted employee", async () => {
    signIn(staff);

    await createInvoice(null, form({ ...input, employeeId: "someone-else" }));

    expect(mocks.db.user.findUnique).toHaveBeenCalledWith({ where: { id: "staff1" }, select: { isActive: true } });
    expect(mocks.tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ employeeId: "staff1", createdById: "staff1" }) }),
    );
  });

  it("lets a Staff user create only a Paid or Unpaid invoice", async () => {
    signIn(staff);

    expect(await createInvoice(null, form({ ...input, status: "UNPAID" }))).toEqual({ success: true, id: "inv1" });
    expect(mocks.tx.invoice.create.mock.calls[0][0].data).toMatchObject({ status: "UNPAID", amount: "50.5" });

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
    const values = { employeeId: "", serviceId: "svc1", amount: "0", status: "CANCELLED" };

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

    expect(await createInvoice(null, form(input))).toEqual({ success: true, id: "inv1" });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(2);
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
