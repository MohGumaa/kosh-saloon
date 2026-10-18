import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { user: { update: mocks.update } } }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentSession: mocks.getCurrentSession }));

const { saveThemePreference } = await import("@/actions/preferences");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentSession.mockResolvedValue({ sessionId: "s1", user: { id: "u1" } });
});

describe("saveThemePreference", () => {
  it("saves the theme on the signed-in user's own row", async () => {
    expect(await saveThemePreference("light")).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { theme: "LIGHT" } });
  });

  it("rejects anything but the three theme values without writing", async () => {
    for (const value of ["LIGHT", "blue", "", null, { theme: "dark" }]) {
      expect(await saveThemePreference(value)).toEqual({ success: false, error: "invalid_theme" });
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("succeeds without writing when signed out", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    expect(await saveThemePreference("system")).toEqual({ success: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("reports an unexpected error when the save fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.update.mockRejectedValue(new Error("db down"));
    expect(await saveThemePreference("dark")).toEqual({ success: false, error: "unexpected" });
  });
});
