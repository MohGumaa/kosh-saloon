import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn() },
    permission: { findMany: vi.fn() },
    userPermission: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
  requireSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));

const { updateUserPermissions } = await import("@/actions/permissions");

function form(userId: string, permissions: string[]) {
  const data = new FormData();
  data.set("userId", userId);
  for (const key of permissions) data.append("permissions", key);
  return data;
}

const stored = (...keys: string[]) => keys.map((key) => ({ permission: { key } }));

function signInAs(id: string, role: "ADMIN" | "SUPERVISOR" | "STAFF", ...keys: string[]) {
  mocks.requireSession.mockResolvedValue({ sessionId: "s1", user: { id, role } });
  mocks.db.userPermission.findMany.mockResolvedValue(stored(...keys));
}

function target(id: string, role: "ADMIN" | "SUPERVISOR" | "STAFF", ...keys: string[]) {
  mocks.db.user.findUnique.mockResolvedValue({ id, role, permissions: stored(...keys) });
}

function expectNothingWritten() {
  expect(mocks.db.$transaction).not.toHaveBeenCalled();
  expect(mocks.db.userPermission.deleteMany).not.toHaveBeenCalled();
  expect(mocks.db.userPermission.createMany).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.permission.findMany.mockImplementation(async ({ where }: { where: { key: { in: string[] } } }) =>
    where.key.in.map((key) => ({ id: `id:${key}` })),
  );
});

describe("updateUserPermissions as an ADMIN", () => {
  beforeEach(() => signInAs("admin1", "ADMIN"));

  it("replaces a Staff user's list in one transaction", async () => {
    target("staff1", "STAFF", "services.view", "invoices.view");
    // Distinct return values prove the transaction received these two writes, not other values.
    mocks.db.userPermission.deleteMany.mockReturnValueOnce("delete-op");
    mocks.db.userPermission.createMany.mockReturnValueOnce("create-op");

    const result = await updateUserPermissions(null, form("staff1", ["invoices.view", "settings.view", "permissions.manage"]));

    expect(result).toEqual({ success: true });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.db.$transaction.mock.calls[0][0]).toEqual(["delete-op", "create-op"]);
    expect(mocks.db.userPermission.deleteMany).toHaveBeenCalledWith({
      where: { userId: "staff1", permission: { key: { in: ["services.view"] } } },
    });
    expect(mocks.db.userPermission.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "staff1", permissionId: "id:settings.view" },
        { userId: "staff1", permissionId: "id:permissions.manage" },
      ],
      skipDuplicates: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/staff1");
  });

  it("removes every permission when none is submitted", async () => {
    target("staff1", "STAFF", "services.view", "invoices.view");

    expect(await updateUserPermissions(null, form("staff1", []))).toEqual({ success: true });
    expect(mocks.db.userPermission.deleteMany.mock.calls[0][0].where.permission.key.in).toEqual([
      "services.view",
      "invoices.view",
    ]);
    expect(mocks.db.userPermission.createMany.mock.calls[0][0].data).toEqual([]);
  });

  it("writes nothing when the list is unchanged", async () => {
    target("staff1", "STAFF", "services.view");

    expect(await updateUserPermissions(null, form("staff1", ["services.view"]))).toEqual({ success: true });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to change an ADMIN, including themselves", async () => {
    target("admin2", "ADMIN");
    expect(await updateUserPermissions(null, form("admin2", []))).toEqual({ success: false, error: "forbidden" });

    target("admin1", "ADMIN");
    expect(await updateUserPermissions(null, form("admin1", []))).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("reports an unknown user", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    expect(await updateUserPermissions(null, form("ghost", []))).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("rejects an unknown permission key or a missing user id", async () => {
    target("staff1", "STAFF");
    expect(await updateUserPermissions(null, form("staff1", ["invoices.view", "invoices.destroy"]))).toEqual({
      success: false,
      error: "invalid_input",
    });
    expect(await updateUserPermissions(null, form("", ["invoices.view"]))).toEqual({
      success: false,
      error: "invalid_input",
    });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("reports an unexpected error when the write fails", async () => {
    target("staff1", "STAFF");
    mocks.db.$transaction.mockRejectedValueOnce(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await updateUserPermissions(null, form("staff1", ["invoices.view"]))).toEqual({
      success: false,
      error: "unexpected",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("updateUserPermissions as a limited manager", () => {
  beforeEach(() => signInAs("sup1", "SUPERVISOR", "permissions.manage", "invoices.view", "services.view"));

  it("changes only permissions the manager holds and keeps the rest as stored", async () => {
    // The target holds one key the manager cannot touch (settings.view) and one they can (services.view).
    target("staff1", "STAFF", "settings.view", "services.view");

    const result = await updateUserPermissions(
      null,
      form("staff1", ["invoices.view", "employees.edit", "permissions.manage"]),
    );

    expect(result).toEqual({ success: true });
    // services.view was unticked and is the manager's to remove; settings.view was not submitted but stays.
    expect(mocks.db.userPermission.deleteMany.mock.calls[0][0].where.permission.key.in).toEqual(["services.view"]);
    // employees.edit and permissions.manage were submitted but are not the manager's to give.
    expect(mocks.db.userPermission.createMany.mock.calls[0][0].data).toEqual([
      { userId: "staff1", permissionId: "id:invoices.view" },
    ]);
  });

  it("never removes permission management from another manager", async () => {
    target("sup2", "SUPERVISOR", "permissions.manage");

    expect(await updateUserPermissions(null, form("sup2", []))).toEqual({ success: true });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to change their own list or an ADMIN", async () => {
    target("sup1", "SUPERVISOR", "permissions.manage");
    expect(await updateUserPermissions(null, form("sup1", ["invoices.view"]))).toEqual({
      success: false,
      error: "forbidden",
    });

    target("admin1", "ADMIN");
    expect(await updateUserPermissions(null, form("admin1", []))).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });
});

describe("updateUserPermissions without permission management", () => {
  it("refuses before looking up the target", async () => {
    signInAs("sup3", "SUPERVISOR", "employees.view", "invoices.view");

    expect(await updateUserPermissions(null, form("staff1", ["invoices.view"]))).toEqual({
      success: false,
      error: "forbidden",
    });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("requires a session before reading the form", async () => {
    mocks.requireSession.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(updateUserPermissions(null, form("staff1", []))).rejects.toThrow("REDIRECT:/login");
    expectNothingWritten();
  });
});
