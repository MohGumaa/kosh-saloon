import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  const tx = {
    salonSettings: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
    requireSession: vi.fn(),
    hasPermission: vi.fn(),
    revalidatePath: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, del: mocks.del }));
vi.mock("@/lib/db", () => ({ db: { ...mocks.tx, $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));

const { removeSalonLogo, updateFinancialSettings, updateSalonInformation, updateSalonLogo } = await import(
  "@/actions/settings"
);

const user = { id: "u1", role: "SUPERVISOR" };

const stored = {
  id: "salon",
  name: "Kosh Salon",
  licenseNumber: "",
  address: "",
  phone: "",
  email: "",
  taxId: "",
  logo: null as string | null,
  currency: "AED",
  taxRate: new Prisma.Decimal("0"),
  employeeSharePercentage: new Prisma.Decimal("50"),
};

const information = { name: "Kosh Salon", licenseNumber: "", address: "", phone: "", email: "", taxId: "" };
const financial = { currency: "AED", taxRate: "0", employeeSharePercentage: "50" };

function form(values: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function logoFile(bytes: number[], type = "image/png", name = "logo.png") {
  return new File([new Uint8Array(bytes)], name, { type });
}

function expectNothingWritten() {
  expect(mocks.tx.salonSettings.update).not.toHaveBeenCalled();
  expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireSession.mockResolvedValue({ sessionId: "s1", user });
  mocks.hasPermission.mockResolvedValue(true);
  mocks.tx.salonSettings.findUnique.mockResolvedValue(stored);
  mocks.put.mockResolvedValue({ url: "https://store.public.blob.vercel-storage.com/salon/logo-new.png" });
  mocks.del.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("updateSalonInformation", () => {
  it("checks settings.edit for the session user and writes nothing when it is missing", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);
    const values = { ...information, name: "New name" };

    expect(await updateSalonInformation(null, form(values))).toEqual({ success: false, error: "forbidden", values });
    expect(mocks.hasPermission).toHaveBeenCalledWith(user, "settings.edit");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("returns field errors and the submitted values without writing", async () => {
    const values = { ...information, name: "  ", email: "nope", phone: "call us" };

    expect(await updateSalonInformation(null, form(values))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { name: "required", email: "invalid_input", phone: "invalid_input" },
      values,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("writes no update and no audit entry when nothing changed", async () => {
    expect(await updateSalonInformation(null, form({ ...information, name: " Kosh Salon " }))).toEqual({
      success: true,
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.salonSettings.update).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("stores only the changed fields and audits them inside one transaction", async () => {
    const data = form({ ...information, name: " Kosh Downtown ", phone: "+971 4 000 0000", email: "Info@Kosh.AE" });
    // Fields outside the form are ignored, whatever the request sends.
    data.set("employeeSharePercentage", "99");
    data.set("logo", "https://evil.example/x.png");

    expect(await updateSalonInformation(null, data)).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.salonSettings.update).toHaveBeenCalledWith({
      where: { id: "salon" },
      data: { name: "Kosh Downtown", phone: "+971 4 000 0000", email: "info@kosh.ae" },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        action: "settings.updated",
        entity: "SalonSettings",
        entityId: "salon",
        oldValue: { salonName: "Kosh Salon", salonPhone: "", email: "" },
        newValue: { salonName: "Kosh Downtown", salonPhone: "+971 4 000 0000", email: "info@kosh.ae" },
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("creates the settings row inside the transaction when it does not exist yet", async () => {
    mocks.tx.salonSettings.findUnique.mockResolvedValueOnce(null);
    mocks.tx.salonSettings.upsert.mockResolvedValueOnce(stored);

    expect(await updateSalonInformation(null, form({ ...information, taxId: "100200300" }))).toEqual({ success: true });
    expect(mocks.tx.salonSettings.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.tx.salonSettings.update.mock.calls[0][0].data).toEqual({ taxId: "100200300" });
  });

  it("reports an unexpected error when the database write fails", async () => {
    mocks.tx.salonSettings.update.mockRejectedValueOnce(new Error("db down"));
    const values = { ...information, name: "Kosh Downtown" };

    expect(await updateSalonInformation(null, form(values))).toEqual({ success: false, error: "unexpected", values });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires a session before anything else", async () => {
    mocks.requireSession.mockRejectedValueOnce(new Error("REDIRECT:/login"));

    await expect(updateSalonInformation(null, form(information))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.hasPermission).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("updateFinancialSettings", () => {
  it("returns forbidden and writes nothing without settings.edit", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);
    const values = { ...financial, employeeSharePercentage: "60" };

    expect(await updateFinancialSettings(null, form(values))).toEqual({ success: false, error: "forbidden", values });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("returns field errors and the submitted values without writing", async () => {
    const values = { currency: "XYZ", taxRate: "", employeeSharePercentage: "100.01" };

    expect(await updateFinancialSettings(null, form(values))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { currency: "invalid_input", taxRate: "required", employeeSharePercentage: "invalid_input" },
      values,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("treats 50.0 as unchanged when 50 is stored", async () => {
    const values = { currency: "aed", taxRate: "0.00", employeeSharePercentage: "50.0" };

    expect(await updateFinancialSettings(null, form(values))).toEqual({ success: true });
    expect(mocks.tx.salonSettings.update).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("audits a changed share percentage with its old and new values as decimal strings", async () => {
    expect(await updateFinancialSettings(null, form({ ...financial, employeeSharePercentage: "60" }))).toEqual({
      success: true,
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.salonSettings.update).toHaveBeenCalledWith({
      where: { id: "salon" },
      data: { employeeSharePercentage: "60" },
    });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data).toEqual({
      userId: "u1",
      action: "settings.updated",
      entity: "SalonSettings",
      entityId: "salon",
      oldValue: { employeeSharePercentage: "50" },
      newValue: { employeeSharePercentage: "60" },
    });
  });

  it("stores a changed currency and tax rate together", async () => {
    await updateFinancialSettings(null, form({ currency: "usd", taxRate: "٥٫٥", employeeSharePercentage: "50" }));

    expect(mocks.tx.salonSettings.update.mock.calls[0][0].data).toEqual({ currency: "USD", taxRate: "5.5" });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      oldValue: { currency: "AED", taxRate: "0" },
      newValue: { currency: "USD", taxRate: "5.5" },
    });
  });

  it("reports an unexpected error when the database write fails", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("db down"));
    const values = { ...financial, employeeSharePercentage: "60" };

    expect(await updateFinancialSettings(null, form(values))).toEqual({ success: false, error: "unexpected", values });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateSalonLogo", () => {
  const upload = (file: File | string) => updateSalonLogo(null, form({ logo: file }));

  it("returns forbidden without settings.edit and uploads nothing", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await upload(logoFile(PNG))).toEqual({ success: false, error: "forbidden" });
    expect(mocks.put).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("rejects a missing or empty file before any upload", async () => {
    expect(await updateSalonLogo(null, new FormData())).toEqual({ success: false, error: "file_required" });
    expect(await upload("https://evil.example/x.png")).toEqual({ success: false, error: "file_required" });
    expect(await upload(logoFile([]))).toEqual({ success: false, error: "file_required" });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects a file over 1 MB before any upload", async () => {
    const big = new File([new Uint8Array(1024 * 1024 + 1)], "logo.png", { type: "image/png" });

    expect(await upload(big)).toEqual({ success: false, error: "file_too_large" });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects a file whose bytes are not an accepted image, whatever type it claims", async () => {
    const svg = [..."<svg onload='alert(1)'>"].map((char) => char.charCodeAt(0));

    expect(await upload(logoFile(svg, "image/png", "logo.png"))).toEqual({ success: false, error: "file_type" });
    expect(mocks.put).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("reports that storage is unavailable when the token is missing", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    expect(await upload(logoFile(PNG))).toEqual({ success: false, error: "storage_unavailable" });
    expect(mocks.put).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("uploads under a server-chosen path and type, stores the URL, and audits it", async () => {
    // A JPEG that claims to be a PNG is stored as what its bytes say.
    expect(await upload(logoFile([0xff, 0xd8, 0xff, 0xe0], "image/png", "../../evil.png"))).toEqual({ success: true });

    const [pathname, body, options] = mocks.put.mock.calls[0];
    expect(pathname).toBe("salon/logo.jpg");
    expect([...(body as Uint8Array)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(options).toEqual({ access: "public", addRandomSuffix: true, contentType: "image/jpeg" });

    const url = "https://store.public.blob.vercel-storage.com/salon/logo-new.png";
    expect(mocks.tx.salonSettings.update).toHaveBeenCalledWith({ where: { id: "salon" }, data: { logo: url } });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      action: "settings.updated",
      oldValue: { logo: null },
      newValue: { logo: url },
    });
    // No previous logo, so nothing to delete.
    expect(mocks.del).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("deletes the previous blob after the new one is stored", async () => {
    const old = "https://store.public.blob.vercel-storage.com/salon/logo-old.png";
    mocks.tx.salonSettings.findUnique.mockResolvedValueOnce({ ...stored, logo: old });

    expect(await upload(logoFile(PNG))).toEqual({ success: true });
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(mocks.del).toHaveBeenCalledWith(old);
    expect(mocks.del.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.tx.salonSettings.update.mock.invocationCallOrder[0],
    );
  });

  it("still succeeds when the previous blob cannot be deleted", async () => {
    mocks.tx.salonSettings.findUnique.mockResolvedValueOnce({ ...stored, logo: "https://store/old.png" });
    mocks.del.mockRejectedValueOnce(new Error("blob down"));

    expect(await upload(logoFile(PNG))).toEqual({ success: true });
  });

  it("deletes the new blob and reports an unexpected error when the database write fails", async () => {
    mocks.tx.salonSettings.update.mockRejectedValueOnce(new Error("db down"));

    expect(await upload(logoFile(PNG))).toEqual({ success: false, error: "unexpected" });
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(mocks.del).toHaveBeenCalledWith("https://store.public.blob.vercel-storage.com/salon/logo-new.png");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unexpected error when the upload itself fails", async () => {
    mocks.put.mockRejectedValueOnce(new Error("blob down"));

    expect(await upload(logoFile(PNG))).toEqual({ success: false, error: "unexpected" });
    expect(mocks.del).not.toHaveBeenCalled();
    expectNothingWritten();
  });
});

describe("removeSalonLogo", () => {
  const old = "https://store.public.blob.vercel-storage.com/salon/logo-old.png";

  it("returns forbidden without settings.edit and changes nothing", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await removeSalonLogo()).toEqual({ success: false, error: "forbidden" });
    expect(mocks.del).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("clears the logo, audits it, and deletes the blob", async () => {
    mocks.tx.salonSettings.findUnique.mockResolvedValueOnce({ ...stored, logo: old });

    expect(await removeSalonLogo()).toEqual({ success: true });
    expect(mocks.tx.salonSettings.update).toHaveBeenCalledWith({ where: { id: "salon" }, data: { logo: null } });
    expect(mocks.tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "settings.updated",
      oldValue: { logo: old },
      newValue: { logo: null },
    });
    expect(mocks.del).toHaveBeenCalledWith(old);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("writes nothing when there is no logo", async () => {
    expect(await removeSalonLogo()).toEqual({ success: true });
    expect(mocks.tx.salonSettings.update).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("reports an unexpected error and keeps the blob when the database write fails", async () => {
    mocks.tx.salonSettings.findUnique.mockResolvedValueOnce({ ...stored, logo: old });
    mocks.tx.salonSettings.update.mockRejectedValueOnce(new Error("db down"));

    expect(await removeSalonLogo()).toEqual({ success: false, error: "unexpected" });
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
