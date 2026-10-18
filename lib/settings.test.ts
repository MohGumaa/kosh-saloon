import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { salonSettings: { findUnique: mocks.findUnique, upsert: mocks.upsert } } }));

const { SETTINGS_ID, getSalonSettings, resolveSettingsTab } = await import("@/lib/settings");

beforeEach(() => vi.clearAllMocks());

describe("resolveSettingsTab", () => {
  const withSecurity = new Set(["settings.view", "settings.security"] as const);
  const viewOnly = new Set(["settings.view"] as const);

  it("opens Security only with settings.security", () => {
    expect(resolveSettingsTab("security", withSecurity)).toBe("security");
    expect(resolveSettingsTab("security", viewOnly)).toBe("information");
  });

  it("opens Financial for anyone who can view settings", () => {
    expect(resolveSettingsTab("financial", viewOnly)).toBe("financial");
  });

  it("opens Notifications for anyone who can view settings, with or without settings.security", () => {
    expect(resolveSettingsTab("notifications", viewOnly)).toBe("notifications");
    expect(resolveSettingsTab("notifications", withSecurity)).toBe("notifications");
  });

  it("falls back to Information for a missing, unknown, or repeated value", () => {
    expect(resolveSettingsTab(undefined, withSecurity)).toBe("information");
    expect(resolveSettingsTab("backup", withSecurity)).toBe("information");
    expect(resolveSettingsTab(["security", "financial"], withSecurity)).toBe("information");
  });
});

describe("getSalonSettings", () => {
  it("returns the stored row without writing", async () => {
    const row = { id: SETTINGS_ID, name: "Kosh Salon" };
    mocks.findUnique.mockResolvedValueOnce(row);

    expect(await getSalonSettings()).toBe(row);
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: "salon" } });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("creates the row with the schema defaults when none exists", async () => {
    const created = { id: SETTINGS_ID, name: "Kosh Salon" };
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.upsert.mockResolvedValueOnce(created);

    expect(await getSalonSettings()).toBe(created);
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { id: "salon" }, update: {}, create: { id: "salon" } });
  });

  it("reads through the given transaction client instead of the shared one", async () => {
    const tx = { salonSettings: { findUnique: vi.fn().mockResolvedValue({ id: SETTINGS_ID }), upsert: vi.fn() } };

    await getSalonSettings(tx as never);
    expect(tx.salonSettings.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
