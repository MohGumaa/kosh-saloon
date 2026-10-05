import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ROLE_DEFAULTS } from "@/lib/auth/permissions";

const mocks = vi.hoisted(() => {
  const db = {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    permission: { findMany: vi.fn() },
    userPermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    db,
    requireSession: vi.fn(),
    hasPermission: vi.fn(),
    hashPassword: vi.fn(),
    revalidatePath: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, del: mocks.del }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/auth/authorize", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));

const {
  createEmployee,
  removeEmployeeImage,
  setEmployeeActive,
  setEmployeePassword,
  setEmployeeShare,
  updateEmployee,
  updateEmployeeImage,
} = await import("@/actions/employees");

type Role = "ADMIN" | "SUPERVISOR" | "STAFF";

function form(values: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function signInAs(id: string, role: Role) {
  mocks.requireSession.mockResolvedValue({ sessionId: "s1", user: { id, role } });
}

const storedKeys = (...keys: string[]) => keys.map((key) => ({ permission: { key } }));

const sara = {
  id: "staff1",
  name: "Sara Ali",
  username: "sara",
  email: "sara@kosh.ae",
  phone: null as string | null,
  role: "STAFF" as Role,
  isActive: true,
  image: null as string | null,
  permissions: storedKeys("services.view", "invoices.view"),
};

/** The row every lookup of the target returns, inside and outside a transaction. */
function target(overrides: Partial<typeof sara> = {}) {
  mocks.db.user.findUnique.mockResolvedValue({ ...sara, ...overrides });
}

const details = { name: "Sara Ali", username: "sara", email: "sara@kosh.ae", phone: "", role: "" };
const newEmployee = {
  name: " Lina Omar ",
  username: "Lina",
  email: "Lina@Kosh.ae",
  phone: "",
  role: "SUPERVISOR",
  password: "correct-horse",
  confirmPassword: "correct-horse",
};
const newEmployeeValues = { name: " Lina Omar ", username: "Lina", email: "Lina@Kosh.ae", phone: "", role: "SUPERVISOR" };

function expectNothingWritten() {
  expect(mocks.db.user.create).not.toHaveBeenCalled();
  expect(mocks.db.user.update).not.toHaveBeenCalled();
  expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  expect(mocks.db.userPermission.deleteMany).not.toHaveBeenCalled();
  expect(mocks.db.session.deleteMany).not.toHaveBeenCalled();
  expect(mocks.db.passwordResetToken.deleteMany).not.toHaveBeenCalled();
  expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();
  expect(mocks.del).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  signInAs("admin1", "ADMIN");
  mocks.hasPermission.mockResolvedValue(true);
  mocks.hashPassword.mockImplementation(async (password: string) => `hashed:${password}`);
  mocks.db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? arg(mocks.db) : Promise.all(arg as unknown[]),
  );
  mocks.db.user.findMany.mockResolvedValue([]);
  mocks.db.user.create.mockResolvedValue({ id: "new1" });
  mocks.db.permission.findMany.mockImplementation(async ({ where }: { where: { key: { in: string[] } } }) =>
    where.key.in.map((key) => ({ id: `id:${key}` })),
  );
  mocks.put.mockResolvedValue({ url: "https://store.public.blob.vercel-storage.com/employees/new.png" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("createEmployee", () => {
  it("checks employees.create for the session user and writes nothing without it", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await createEmployee(null, form(newEmployee))).toEqual({
      success: false,
      error: "forbidden",
      values: newEmployeeValues,
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith({ id: "admin1", role: "ADMIN" }, "employees.create");
    expectNothingWritten();
  });

  it("creates the user with normalized details, a hashed password, role defaults, and an audit entry", async () => {
    expect(await createEmployee(null, form(newEmployee))).toEqual({ success: true, id: "new1" });

    const data = { name: "Lina Omar", username: "lina", email: "lina@kosh.ae", phone: null, role: "SUPERVISOR" };
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.db.user.create).toHaveBeenCalledWith({
      data: {
        ...data,
        passwordHash: "hashed:correct-horse",
        permissions: { create: ROLE_DEFAULTS.SUPERVISOR.map((key) => ({ permissionId: `id:${key}` })) },
      },
      select: { id: true },
    });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "user.created", entity: "User", entityId: "new1", newValue: data },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees");
  });

  it("gives a new ADMIN no stored permission rows", async () => {
    await createEmployee(null, form({ ...newEmployee, role: "ADMIN" }));

    expect(mocks.db.permission.findMany).not.toHaveBeenCalled();
    expect(mocks.db.user.create.mock.calls[0][0].data).toMatchObject({ role: "ADMIN", permissions: { create: [] } });
  });

  it("stores STAFF for a non-admin creator, whatever role the form sends", async () => {
    signInAs("sup1", "SUPERVISOR");

    expect(await createEmployee(null, form({ ...newEmployee, role: "ADMIN" }))).toEqual({ success: true, id: "new1" });
    expect(mocks.db.user.create.mock.calls[0][0].data).toMatchObject({
      role: "STAFF",
      permissions: { create: ROLE_DEFAULTS.STAFF.map((key) => ({ permissionId: `id:${key}` })) },
    });
    expect(mocks.db.auditLog.create.mock.calls[0][0].data.newValue.role).toBe("STAFF");
  });

  it("returns field errors and the typed details, never the password", async () => {
    const result = await createEmployee(
      null,
      form({ name: "", username: "Lina Omar", email: "nope", phone: "x", role: "", password: "short", confirmPassword: "" }),
    );

    expect(result).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: {
        name: "required",
        username: "invalid_input",
        email: "invalid_input",
        phone: "invalid_input",
        role: "required",
        // The confirmation is compared only once every field is valid on its own.
        password: "password_length",
      },
      values: { name: "", username: "Lina Omar", email: "nope", phone: "x", role: "" },
    });
    expect(JSON.stringify(result)).not.toContain("short");
    expectNothingWritten();
  });

  it("reports mismatched passwords on the confirmation field", async () => {
    const result = await createEmployee(null, form({ ...newEmployee, confirmPassword: "correct-house" }));

    expect(result).toMatchObject({ success: false, fieldErrors: { confirmPassword: "password_mismatch" } });
    expectNothingWritten();
  });

  it("reports a taken username and email before writing", async () => {
    mocks.db.user.findMany.mockResolvedValueOnce([
      { username: "lina", email: "other@kosh.ae" },
      { username: "other", email: "lina@kosh.ae" },
    ]);

    expect(await createEmployee(null, form(newEmployee))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { username: "username_taken", email: "email_taken" },
      values: newEmployeeValues,
    });
    expect(mocks.db.user.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ username: "lina" }, { email: "lina@kosh.ae" }],
    });
    expectNothingWritten();
  });

  it("maps a unique-index race to the same field error", async () => {
    mocks.db.user.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    mocks.db.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ username: "lina", email: "x@kosh.ae" }]);

    expect(await createEmployee(null, form(newEmployee))).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { username: "username_taken" },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unexpected error when the write fails or the catalog is incomplete", async () => {
    mocks.db.user.create.mockRejectedValueOnce(new Error("db down"));
    expect(await createEmployee(null, form(newEmployee))).toEqual({
      success: false,
      error: "unexpected",
      values: newEmployeeValues,
    });

    mocks.db.permission.findMany.mockResolvedValueOnce([]);
    expect(await createEmployee(null, form(newEmployee))).toMatchObject({ success: false, error: "unexpected" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the password and its hash out of the audit entry", async () => {
    await createEmployee(null, form(newEmployee));

    const entry = JSON.stringify(mocks.db.auditLog.create.mock.calls[0][0]);
    expect(entry).not.toContain("correct-horse");
    expect(entry).not.toContain("passwordHash");
  });

  it("requires a session before anything else", async () => {
    mocks.requireSession.mockRejectedValueOnce(new Error("REDIRECT:/login"));

    await expect(createEmployee(null, form(newEmployee))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.hasPermission).not.toHaveBeenCalled();
    expectNothingWritten();
  });
});

describe("updateEmployee", () => {
  const update = (values: Record<string, string>, userId = "staff1") =>
    updateEmployee(null, form({ userId, ...details, ...values }));

  beforeEach(() => target());

  it("returns forbidden without employees.edit, before looking up the target", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await update({ name: "Sara A." })).toEqual({
      success: false,
      error: "forbidden",
      values: { ...details, name: "Sara A." },
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith({ id: "admin1", role: "ADMIN" }, "employees.edit");
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("writes nothing and audits nothing when no field changed", async () => {
    expect(await update({ name: " Sara Ali ", email: "SARA@kosh.ae" })).toEqual({ success: true });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("stores only the changed fields and audits their old and new values", async () => {
    expect(await update({ name: "Sara A.", phone: "+971 50 123 4567" })).toEqual({ success: true });

    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.db.user.update).toHaveBeenCalledWith({
      where: { id: "staff1" },
      data: { name: "Sara A.", phone: "+971 50 123 4567" },
    });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "user.updated",
        entity: "User",
        entityId: "staff1",
        oldValue: { name: "Sara Ali", phone: null },
        newValue: { name: "Sara A.", phone: "+971 50 123 4567" },
      },
    });
    expect(mocks.db.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.userPermission.deleteMany).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/staff1");
  });

  it("deletes the employee's reset tokens when the email changes", async () => {
    expect(await update({ email: "Sara.Ali@Kosh.ae" })).toEqual({ success: true });
    expect(mocks.db.user.update.mock.calls[0][0].data).toEqual({ email: "sara.ali@kosh.ae" });
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
  });

  it("replaces the stored permissions with the new role's defaults on a role change", async () => {
    expect(await update({ role: "SUPERVISOR" })).toEqual({ success: true });

    expect(mocks.db.userPermission.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
    expect(mocks.db.userPermission.createMany).toHaveBeenCalledWith({
      data: ROLE_DEFAULTS.SUPERVISOR.map((key) => ({ userId: "staff1", permissionId: `id:${key}` })),
    });
    expect(mocks.db.user.update.mock.calls[0][0].data).toEqual({ role: "SUPERVISOR" });
    expect(mocks.db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      oldValue: { role: "STAFF", permissions: ["services.view", "invoices.view"] },
      newValue: { role: "SUPERVISOR", permissions: [...ROLE_DEFAULTS.SUPERVISOR] },
    });
  });

  it("removes every stored permission when the new role is ADMIN", async () => {
    await update({ role: "ADMIN" });

    expect(mocks.db.userPermission.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
    expect(mocks.db.userPermission.createMany).toHaveBeenCalledWith({ data: [] });
    expect(mocks.db.auditLog.create.mock.calls[0][0].data.newValue).toEqual({ role: "ADMIN", permissions: [] });
  });

  it("lets an ADMIN edit their own details but not their own role", async () => {
    target({ id: "admin1", role: "ADMIN", permissions: [] });

    expect(await update({ name: "Head Admin" }, "admin1")).toEqual({ success: true });
    // The shared layout shows the actor's own name.
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");

    mocks.db.user.update.mockClear();
    expect(await update({ role: "STAFF" }, "admin1")).toMatchObject({ success: false, error: "forbidden" });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a non-admin who targets a Supervisor, an ADMIN, or themself", async () => {
    signInAs("sup1", "SUPERVISOR");

    for (const [id, role] of [["sup2", "SUPERVISOR"], ["admin1", "ADMIN"], ["sup1", "SUPERVISOR"]] as const) {
      target({ id, role });
      expect(await update({ name: "Changed" }, id), id).toMatchObject({ success: false, error: "forbidden" });
    }
    expectNothingWritten();
  });

  it("lets a non-admin edit a Staff user but never change the role", async () => {
    signInAs("sup1", "SUPERVISOR");

    expect(await update({ name: "Sara A." })).toEqual({ success: true });
    expect(mocks.db.user.update.mock.calls[0][0].data).toEqual({ name: "Sara A." });

    mocks.db.user.update.mockClear();
    expect(await update({ role: "SUPERVISOR" })).toMatchObject({ success: false, error: "forbidden" });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.userPermission.deleteMany).not.toHaveBeenCalled();
  });

  it("reports an unknown employee and an invalid id", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    expect(await update({}, "ghost")).toMatchObject({ success: false, error: "not_found" });
    expect(await update({}, "")).toMatchObject({ success: false, error: "invalid_input" });
    expectNothingWritten();
  });

  it("returns field errors and the submitted values without writing", async () => {
    const values = { name: " ", username: "sara ali", email: "nope", phone: "call", role: "OWNER" };

    expect(await update(values)).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: {
        name: "required",
        username: "invalid_input",
        email: "invalid_input",
        phone: "invalid_input",
        role: "invalid_input",
      },
      values,
    });
    expectNothingWritten();
  });

  it("reports a username or email another account holds, ignoring the employee's own row", async () => {
    mocks.db.user.findMany.mockResolvedValueOnce([{ username: "lina", email: "lina@kosh.ae" }]);

    expect(await update({ username: "lina" })).toMatchObject({
      success: false,
      error: "invalid_input",
      fieldErrors: { username: "username_taken" },
    });
    expect(mocks.db.user.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ username: "lina" }, { email: "sara@kosh.ae" }],
      id: { not: "staff1" },
    });
    expectNothingWritten();
  });

  it("maps a unique-index race to the field error and anything else to unexpected", async () => {
    mocks.db.user.update.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    mocks.db.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ username: "x", email: "lina@kosh.ae" }]);
    expect(await update({ email: "lina@kosh.ae" })).toMatchObject({
      success: false,
      fieldErrors: { email: "email_taken" },
    });

    mocks.db.user.update.mockRejectedValueOnce(new Error("db down"));
    expect(await update({ name: "Sara A." })).toMatchObject({ success: false, error: "unexpected" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setEmployeeActive", () => {
  const setActive = (active: string, userId = "staff1") => setEmployeeActive(null, form({ userId, active }));

  beforeEach(() => target());

  it("returns forbidden without employees.activate", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await setActive("false")).toEqual({ success: false, error: "forbidden" });
    expect(mocks.hasPermission).toHaveBeenCalledWith({ id: "admin1", role: "ADMIN" }, "employees.activate");
    expectNothingWritten();
  });

  it("deactivates, signs the employee out, and deletes reset tokens in one transaction", async () => {
    mocks.db.user.update.mockReturnValueOnce("update-op");
    mocks.db.session.deleteMany.mockReturnValueOnce("sessions-op");
    mocks.db.passwordResetToken.deleteMany.mockReturnValueOnce("tokens-op");
    mocks.db.auditLog.create.mockReturnValueOnce("audit-op");

    expect(await setActive("false")).toEqual({ success: true });
    expect(mocks.db.$transaction.mock.calls[0][0]).toEqual(["update-op", "sessions-op", "tokens-op", "audit-op"]);
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: "staff1" }, data: { isActive: false } });
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "user.deactivated", entity: "User", entityId: "staff1" },
    });
  });

  it("activates without touching sessions", async () => {
    target({ isActive: false });

    expect(await setActive("true")).toEqual({ success: true });
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: "staff1" }, data: { isActive: true } });
    expect(mocks.db.session.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create.mock.calls[0][0].data.action).toBe("user.activated");
  });

  it("writes nothing when the status is already as requested", async () => {
    expect(await setActive("true")).toEqual({ success: true });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses the actor's own account, even for an ADMIN", async () => {
    target({ id: "admin1", role: "ADMIN" });

    expect(await setActive("false", "admin1")).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("refuses a non-admin who targets anyone but another Staff user", async () => {
    signInAs("sup1", "SUPERVISOR");
    target({ id: "sup2", role: "SUPERVISOR" });
    expect(await setActive("false", "sup2")).toEqual({ success: false, error: "forbidden" });

    target({ id: "admin1", role: "ADMIN" });
    expect(await setActive("false", "admin1")).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();

    target();
    expect(await setActive("false")).toEqual({ success: true });
  });

  it("reports an unknown employee, a bad value, and a failed write", async () => {
    expect(await setActive("maybe")).toEqual({ success: false, error: "invalid_input" });

    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    expect(await setActive("false", "ghost")).toEqual({ success: false, error: "not_found" });

    mocks.db.$transaction.mockRejectedValueOnce(new Error("db down"));
    expect(await setActive("false")).toEqual({ success: false, error: "unexpected" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setEmployeeShare", () => {
  const setShare = (sharePercentage: string, userId = "staff1") =>
    setEmployeeShare(null, form({ userId, sharePercentage }));
  const stored = (value: string | null) =>
    mocks.db.user.findUnique.mockResolvedValue({ sharePercentage: value === null ? null : new Prisma.Decimal(value) });

  beforeEach(() => {
    stored(null);
    mocks.db.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it.each(["SUPERVISOR", "STAFF"] as const)("returns forbidden for a %s, even with employees.edit", async (role) => {
    signInAs("other1", role);

    expect(await setShare("0")).toEqual({ success: false, error: "forbidden" });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("sets 0% and audits the change from the salon default", async () => {
    expect(await setShare("٠")).toEqual({ success: true });
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: "staff1", sharePercentage: null },
      data: { sharePercentage: "0" },
    });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "user.share_updated",
        entity: "User",
        entityId: "staff1",
        oldValue: { sharePercentage: null },
        newValue: { sharePercentage: "0" },
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/staff1");
  });

  it("changes 0% to 62.5%, guarded by the value it read", async () => {
    stored("0");

    expect(await setShare("62.50")).toEqual({ success: true });
    expect(mocks.db.user.updateMany.mock.calls[0][0].where.sharePercentage.toString()).toBe("0");
    expect(mocks.db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      oldValue: { sharePercentage: "0" },
      newValue: { sharePercentage: "62.5" },
    });
  });

  it("clears the employee's own percentage when empty", async () => {
    stored("40");

    expect(await setShare("")).toEqual({ success: true });
    expect(mocks.db.user.updateMany.mock.calls[0][0].data).toEqual({ sharePercentage: null });
    expect(mocks.db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      oldValue: { sharePercentage: "40" },
      newValue: { sharePercentage: null },
    });
  });

  it.each([
    ["the same value", "50", "50.00"],
    ["no value", null, ""],
  ])("writes nothing for %s", async (_label, value, submitted) => {
    stored(value);

    expect(await setShare(submitted)).toEqual({ success: true });
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(["101", "-1", "abc", "1.234"])("rejects %j with a field error", async (value) => {
    expect(await setShare(value)).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { sharePercentage: "invalid_input" },
    });
    expectNothingWritten();
  });

  it("returns not_found for a missing employee", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);

    expect(await setShare("0", "ghost")).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("fails without auditing when the value changed during the save", async () => {
    mocks.db.user.updateMany.mockResolvedValue({ count: 0 });

    expect(await setShare("0")).toEqual({ success: false, error: "unexpected" });
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setEmployeePassword", () => {
  const setPassword = (password: string, confirmPassword = password, userId = "staff1") =>
    setEmployeePassword(null, form({ userId, password, confirmPassword }));

  beforeEach(() => target());

  it("returns forbidden without employees.edit", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await setPassword("correct-horse")).toEqual({ success: false, error: "forbidden" });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it("stores the hash, signs the employee out everywhere, and audits without the password", async () => {
    mocks.db.user.update.mockReturnValueOnce("update-op");
    mocks.db.session.deleteMany.mockReturnValueOnce("sessions-op");
    mocks.db.passwordResetToken.deleteMany.mockReturnValueOnce("tokens-op");
    mocks.db.auditLog.create.mockReturnValueOnce("audit-op");

    const result = await setPassword("correct-horse");

    expect(result).toEqual({ success: true });
    expect(mocks.db.$transaction.mock.calls[0][0]).toEqual(["update-op", "sessions-op", "tokens-op", "audit-op"]);
    expect(mocks.db.user.update).toHaveBeenCalledWith({
      where: { id: "staff1" },
      data: { passwordHash: "hashed:correct-horse" },
    });
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff1" } });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin1", action: "user.password_set", entity: "User", entityId: "staff1" },
    });
  });

  it("returns field errors without echoing the password", async () => {
    const short = await setPassword("short");
    expect(short).toEqual({ success: false, error: "invalid_input", fieldErrors: { password: "password_length" } });

    const mismatch = await setPassword("correct-horse", "correct-house");
    expect(mismatch).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { confirmPassword: "password_mismatch" },
    });
    expectNothingWritten();
  });

  it("refuses the actor's own account and a non-admin's disallowed targets", async () => {
    target({ id: "admin1", role: "ADMIN" });
    expect(await setPassword("correct-horse", "correct-horse", "admin1")).toEqual({ success: false, error: "forbidden" });

    signInAs("sup1", "SUPERVISOR");
    target({ id: "sup2", role: "SUPERVISOR" });
    expect(await setPassword("correct-horse", "correct-horse", "sup2")).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("reports an unknown employee and a failed write", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    expect(await setPassword("correct-horse")).toEqual({ success: false, error: "not_found" });

    mocks.db.$transaction.mockRejectedValueOnce(new Error("db down"));
    expect(await setPassword("correct-horse")).toEqual({ success: false, error: "unexpected" });
  });
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const NEW_URL = "https://store.public.blob.vercel-storage.com/employees/new.png";
const OLD_URL = "https://store.public.blob.vercel-storage.com/employees/old.png";

function imageFile(bytes: number[], type = "image/png", name = "me.png") {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("updateEmployeeImage", () => {
  const upload = (image: File | string, userId = "staff1") => updateEmployeeImage(null, form({ userId, image }));

  beforeEach(() => target());

  it("returns forbidden without employees.edit and uploads nothing", async () => {
    mocks.hasPermission.mockResolvedValueOnce(false);

    expect(await upload(imageFile(PNG))).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("refuses a target the actor may not manage and reports an unknown one", async () => {
    signInAs("sup1", "SUPERVISOR");
    target({ id: "sup2", role: "SUPERVISOR" });
    expect(await upload(imageFile(PNG), "sup2")).toEqual({ success: false, error: "forbidden" });

    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    expect(await upload(imageFile(PNG), "ghost")).toEqual({ success: false, error: "not_found" });
    expectNothingWritten();
  });

  it("rejects a missing, oversized, or non-image file before any upload", async () => {
    expect(await upload("https://evil.example/x.png")).toEqual({ success: false, error: "file_required" });
    expect(await upload(imageFile([]))).toEqual({ success: false, error: "file_required" });

    const big = new File([new Uint8Array(1024 * 1024 + 1)], "me.png", { type: "image/png" });
    expect(await upload(big)).toEqual({ success: false, error: "file_too_large" });

    const svg = [..."<svg onload='alert(1)'>"].map((char) => char.charCodeAt(0));
    expect(await upload(imageFile(svg))).toEqual({ success: false, error: "file_type" });
    expectNothingWritten();
  });

  it("reports that storage is unavailable when the token is missing", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    expect(await upload(imageFile(PNG))).toEqual({ success: false, error: "storage_unavailable" });
    expectNothingWritten();
  });

  it("uploads under a server-chosen path and type, stores the URL, and audits it", async () => {
    // A JPEG that claims to be a PNG is stored as what its bytes say.
    expect(await upload(imageFile([0xff, 0xd8, 0xff, 0xe0], "image/png", "../../evil.png"))).toEqual({ success: true });

    const [pathname, , options] = mocks.put.mock.calls[0];
    expect(pathname).toBe("employees/staff1.jpg");
    expect(options).toEqual({ access: "public", addRandomSuffix: true, contentType: "image/jpeg" });
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: "staff1" }, data: { image: NEW_URL } });
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin1",
        action: "user.updated",
        entity: "User",
        entityId: "staff1",
        oldValue: { image: null },
        newValue: { image: NEW_URL },
      },
    });
    expect(mocks.del).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/employees/staff1");
  });

  it("deletes the previous blob after the new one is stored, and survives a failed delete", async () => {
    target({ image: OLD_URL });
    mocks.del.mockRejectedValueOnce(new Error("blob down"));

    expect(await upload(imageFile(PNG))).toEqual({ success: true });
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(mocks.del).toHaveBeenCalledWith(OLD_URL);
  });

  it("deletes the new blob and reports an unexpected error when the database write fails", async () => {
    mocks.db.user.update.mockRejectedValueOnce(new Error("db down"));

    expect(await upload(imageFile(PNG))).toEqual({ success: false, error: "unexpected" });
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(mocks.del).toHaveBeenCalledWith(NEW_URL);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("lets an ADMIN set their own image and refreshes the layout", async () => {
    target({ id: "admin1", role: "ADMIN" });

    expect(await upload(imageFile(PNG), "admin1")).toEqual({ success: true });
    expect(mocks.put.mock.calls[0][0]).toBe("employees/admin1.png");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("removeEmployeeImage", () => {
  const remove = (userId = "staff1") => removeEmployeeImage(null, form({ userId }));

  it("returns forbidden without employees.edit or for a disallowed target", async () => {
    target({ image: OLD_URL });
    mocks.hasPermission.mockResolvedValueOnce(false);
    expect(await remove()).toEqual({ success: false, error: "forbidden" });

    signInAs("staff2", "STAFF");
    target({ id: "admin1", role: "ADMIN", image: OLD_URL });
    expect(await remove("admin1")).toEqual({ success: false, error: "forbidden" });
    expectNothingWritten();
  });

  it("clears the image, audits it, and deletes the blob", async () => {
    target({ image: OLD_URL });

    expect(await remove()).toEqual({ success: true });
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: "staff1" }, data: { image: null } });
    expect(mocks.db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "user.updated",
      oldValue: { image: OLD_URL },
      newValue: { image: null },
    });
    expect(mocks.del).toHaveBeenCalledWith(OLD_URL);
  });

  it("writes nothing when there is no image", async () => {
    target();

    expect(await remove()).toEqual({ success: true });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("keeps the blob and reports an unexpected error when the database write fails", async () => {
    target({ image: OLD_URL });
    mocks.db.user.update.mockRejectedValueOnce(new Error("db down"));

    expect(await remove()).toEqual({ success: false, error: "unexpected" });
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
