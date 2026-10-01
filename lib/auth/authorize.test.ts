import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSION_KEYS } from "@/lib/auth/permissions";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/db", () => ({ db: { userPermission: { findMany: mocks.findMany } } }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));

const { getPermissions, hasPermission, requirePermission } = await import("@/lib/auth/authorize");

const stored = (...keys: string[]) => keys.map((key) => ({ permission: { key } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPermissions", () => {
  it("gives an ADMIN every key without a query", async () => {
    const permissions = await getPermissions({ id: "a1", role: "ADMIN" });
    expect([...permissions].sort()).toEqual([...PERMISSION_KEYS].sort());
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("gives anyone else exactly their stored keys", async () => {
    mocks.findMany.mockResolvedValue(stored("invoices.view", "services.view"));
    const permissions = await getPermissions({ id: "u1", role: "SUPERVISOR" });

    expect([...permissions].sort()).toEqual(["invoices.view", "services.view"]);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });

  it("gives a user with no stored rows nothing, whatever their role", async () => {
    mocks.findMany.mockResolvedValue([]);
    expect((await getPermissions({ id: "u2", role: "STAFF" })).size).toBe(0);
  });
});

describe("hasPermission", () => {
  it("reports denial without throwing", async () => {
    mocks.findMany.mockResolvedValue(stored("invoices.view"));
    expect(await hasPermission({ id: "u3", role: "STAFF" }, "invoices.view")).toBe(true);
    expect(await hasPermission({ id: "u3", role: "STAFF" }, "invoices.edit")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("returns the session and permissions when the key is held", async () => {
    mocks.requireSession.mockResolvedValue({ sessionId: "s1", user: { id: "u4", role: "SUPERVISOR" } });
    mocks.findMany.mockResolvedValue(stored("employees.view"));

    const result = await requirePermission("employees.view");
    expect(result.user.id).toBe("u4");
    expect(result.permissions.has("employees.view")).toBe(true);
  });

  it("redirects a user without the permission to the access-denied page", async () => {
    mocks.requireSession.mockResolvedValue({ sessionId: "s1", user: { id: "u5", role: "STAFF" } });
    mocks.findMany.mockResolvedValue(stored("services.view"));

    await expect(requirePermission("employees.view")).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("requires a session first", async () => {
    mocks.requireSession.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(requirePermission("employees.view")).rejects.toThrow("REDIRECT:/login");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
