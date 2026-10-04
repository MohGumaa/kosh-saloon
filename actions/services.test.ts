import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  const db = {
    service: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, requireSession: vi.fn(), hasPermission: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));

const { createService, setServiceActive, updateService } = await import("@/actions/services");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const haircut = {
  id: "svc1",
  nameEn: "Haircut",
  nameAr: "حلاقة شعر",
  defaultPrice: new Prisma.Decimal("50"),
  isActive: true,
};

const input = { nameEn: " Beard ", nameAr: " دقن ", defaultPrice: "٢٥٫٥" };

function expectNothingWritten() {
  expect(mocks.db.service.create).not.toHaveBeenCalled();
  expect(mocks.db.service.update).not.toHaveBeenCalled();
  expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

const uniqueViolation = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireSession.mockResolvedValue({ sessionId: "s1", user: { id: "admin1", role: "ADMIN" } });
  mocks.hasPermission.mockResolvedValue(true);
  mocks.db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? arg(mocks.db) : Promise.all(arg as unknown[]),
  );
  mocks.db.service.findMany.mockResolvedValue([]);
  mocks.db.service.findUnique.mockResolvedValue(haircut);
  mocks.db.service.create.mockResolvedValue({ id: "new1" });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("createService", () => {
  it("stores the normalized service with its audit entry", async () => {
    const result = await createService(null, form(input));

    expect(result).toEqual({ success: true, id: "new1" });
    const data = { nameEn: "Beard", nameAr: "دقن", defaultPrice: "25.5" };
    expect(mocks.db.service.create).toHaveBeenCalledWith({ data, select: { id: true } });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "service.created", entity: "Service", entityId: "new1", newValue: data },
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith({ id: "admin1", role: "ADMIN" }, "services.create");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/services");
  });

  it("refuses a user without services.create", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const result = await createService(null, form(input));

    expect(result).toEqual({ success: false, error: "forbidden", values: input });
    expectNothingWritten();
  });

  it("returns field errors and the submitted values for invalid input", async () => {
    const values = { nameEn: "", nameAr: "دقن", defaultPrice: "-1" };

    const result = await createService(null, form(values));

    expect(result).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { nameEn: "required", defaultPrice: "invalid_input" },
      values,
    });
    expectNothingWritten();
  });

  it("reports names another service already uses, ignoring English case", async () => {
    mocks.db.service.findMany.mockResolvedValue([{ nameEn: "BEARD", nameAr: "لحية" }]);

    const result = await createService(null, form(input));

    expect(result).toMatchObject({ success: false, error: "invalid_input", fieldErrors: { nameEn: "name_taken" } });
    expect(mocks.db.service.findMany).toHaveBeenCalledWith({
      where: { OR: [{ nameEn: { equals: "Beard", mode: "insensitive" } }, { nameAr: "دقن" }] },
      select: { nameEn: true, nameAr: true },
    });
    expectNothingWritten();
  });

  it("reports the name the unique index rejected when two creates race", async () => {
    mocks.db.service.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ nameEn: "Other", nameAr: "دقن" }]);
    mocks.db.$transaction.mockRejectedValue(uniqueViolation);

    const result = await createService(null, form(input));

    expect(result).toMatchObject({ success: false, error: "invalid_input", fieldErrors: { nameAr: "name_taken" } });
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    const result = await createService(null, form(input));

    expect(result).toEqual({ success: false, error: "unexpected", values: input });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateService", () => {
  const edit = (values: Partial<typeof input> & { id?: string }) =>
    updateService(null, form({ id: "svc1", nameEn: "Haircut", nameAr: "حلاقة شعر", defaultPrice: "50", ...values }));

  it("stores and audits only the changed fields", async () => {
    const result = await edit({ defaultPrice: "60.00" });

    expect(result).toEqual({ success: true });
    expect(mocks.hasPermission).toHaveBeenCalledWith({ id: "admin1", role: "ADMIN" }, "services.edit");
    expect(mocks.db.service.update).toHaveBeenCalledWith({ where: { id: "svc1" }, data: { defaultPrice: "60" } });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "service.updated",
        entity: "Service",
        entityId: "svc1",
        oldValue: { defaultPrice: "50" },
        newValue: { defaultPrice: "60" },
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/services");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/services/svc1");
  });

  it("writes nothing when no value changed, treating 50.00 as the stored 50", async () => {
    const result = await edit({ nameEn: " Haircut ", defaultPrice: "50.00" });

    expect(result).toEqual({ success: true });
    expect(mocks.db.service.update).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("lets a service keep its own names", async () => {
    await edit({ nameAr: "حلاقة" });

    expect(mocks.db.service.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ nameEn: { equals: "Haircut", mode: "insensitive" } }, { nameAr: "حلاقة" }],
        id: { not: "svc1" },
      },
      select: { nameEn: true, nameAr: true },
    });
  });

  it("refuses a user without services.edit", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await edit({ defaultPrice: "60" })).toMatchObject({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("returns not_found for an unknown service", async () => {
    mocks.db.service.findUnique.mockResolvedValue(null);

    expect(await edit({ id: "missing" })).toMatchObject({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns field errors for an invalid price", async () => {
    expect(await edit({ defaultPrice: "50.555" })).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { defaultPrice: "invalid_input" },
    });
    expectNothingWritten();
  });

  it("reports a name another service uses", async () => {
    mocks.db.service.findMany.mockResolvedValue([{ nameEn: "Beard", nameAr: "دقن" }]);

    expect(await edit({ nameAr: "دقن" })).toMatchObject({ fieldErrors: { nameAr: "name_taken" } });
    expectNothingWritten();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await edit({ defaultPrice: "60" })).toMatchObject({ success: false, error: "unexpected" });
  });
});

describe("setServiceActive", () => {
  const setActive = (active: string, id = "svc1") => setServiceActive(null, form({ id, active }));

  it("deactivates an active service with its audit entry", async () => {
    expect(await setActive("false")).toEqual({ success: true });

    expect(mocks.db.service.update).toHaveBeenCalledWith({ where: { id: "svc1" }, data: { isActive: false } });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "service.deactivated", entity: "Service", entityId: "svc1" },
    });
  });

  it("activates an inactive service with its audit entry", async () => {
    mocks.db.service.findUnique.mockResolvedValue({ ...haircut, isActive: false });

    expect(await setActive("true")).toEqual({ success: true });

    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "service.activated", entity: "Service", entityId: "svc1" },
    });
  });

  it("writes nothing when the status already matches", async () => {
    expect(await setActive("true")).toEqual({ success: true });

    expect(mocks.db.service.update).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a user without services.edit", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    expect(await setActive("false")).toEqual({ success: false, error: "forbidden" });
    expect(mocks.hasPermission).toHaveBeenCalledWith({ id: "admin1", role: "ADMIN" }, "services.edit");
    expectNothingWritten();
  });

  it("rejects an invalid status value", async () => {
    expect(await setActive("maybe")).toEqual({ success: false, error: "invalid_input" });
    expectNothingWritten();
  });

  it("returns not_found for an unknown service", async () => {
    mocks.db.service.findUnique.mockResolvedValue(null);

    expect(await setActive("false", "missing")).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("returns unexpected when the database fails", async () => {
    mocks.db.$transaction.mockRejectedValue(new Error("connection lost"));

    expect(await setActive("false")).toEqual({ success: false, error: "unexpected" });
  });
});
