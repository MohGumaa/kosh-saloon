import { describe, expect, it } from "vitest";
import {
  ROLES,
  canChangeEmployeeRole,
  canManageEmployee,
  canManageEmployeeAccess,
  createEmployeeSchema,
  employeeIdSchema,
  setEmployeePasswordSchema,
  updateEmployeeSchema,
} from "@/lib/employees";

const account = (id: string, role: (typeof ROLES)[number]) => ({ id, role });

describe("canManageEmployee", () => {
  it("lets an ADMIN manage every role, and themself", () => {
    const admin = account("a1", "ADMIN");
    for (const role of ROLES) expect(canManageEmployee(admin, account("u2", role)), role).toBe(true);
    expect(canManageEmployee(admin, admin)).toBe(true);
  });

  it.each(["SUPERVISOR", "STAFF"] as const)("lets a %s manage only another STAFF user", (role) => {
    const actor = account("u1", role);
    expect(canManageEmployee(actor, account("u2", "STAFF"))).toBe(true);
    expect(canManageEmployee(actor, account("u2", "SUPERVISOR"))).toBe(false);
    expect(canManageEmployee(actor, account("u2", "ADMIN"))).toBe(false);
    expect(canManageEmployee(actor, actor)).toBe(false);
  });
});

describe("canManageEmployeeAccess", () => {
  it("follows the same rule but never allows the actor's own account", () => {
    const admin = account("a1", "ADMIN");
    for (const role of ROLES) expect(canManageEmployeeAccess(admin, account("u2", role)), role).toBe(true);
    expect(canManageEmployeeAccess(admin, admin)).toBe(false);

    const supervisor = account("s1", "SUPERVISOR");
    expect(canManageEmployeeAccess(supervisor, account("u2", "STAFF"))).toBe(true);
    expect(canManageEmployeeAccess(supervisor, account("u2", "SUPERVISOR"))).toBe(false);
    expect(canManageEmployeeAccess(supervisor, account("u2", "ADMIN"))).toBe(false);
    expect(canManageEmployeeAccess(supervisor, supervisor)).toBe(false);

    const staff = account("st1", "STAFF");
    expect(canManageEmployeeAccess(staff, staff)).toBe(false);
  });
});

describe("canChangeEmployeeRole", () => {
  it("allows only an ADMIN, and never on their own account", () => {
    const admin = account("a1", "ADMIN");
    for (const role of ROLES) expect(canChangeEmployeeRole(admin, account("u2", role)), role).toBe(true);
    expect(canChangeEmployeeRole(admin, admin)).toBe(false);
    expect(canChangeEmployeeRole(account("s1", "SUPERVISOR"), account("u2", "STAFF"))).toBe(false);
    expect(canChangeEmployeeRole(account("st1", "STAFF"), account("u2", "STAFF"))).toBe(false);
  });
});

const valid = {
  name: "Sara Ali",
  username: "sara.ali",
  email: "sara@kosh.ae",
  phone: "",
  password: "correct-horse",
  confirmPassword: "correct-horse",
  role: "STAFF",
};

const invalidFields = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  [...new Set(result.error?.issues.map((issue) => issue.path[0]))].sort();

describe("createEmployeeSchema", () => {
  it("normalizes the name, username, email, and phone", () => {
    const parsed = createEmployeeSchema.parse({
      ...valid,
      name: "  Sara Ali ",
      username: " Sara.Ali ",
      email: " Sara@Kosh.AE ",
      phone: " ٠٥٠ 123 4567 ",
    });

    expect(parsed).toMatchObject({
      name: "Sara Ali",
      username: "sara.ali",
      email: "sara@kosh.ae",
      phone: "050 123 4567",
      role: "STAFF",
    });
  });

  it("stores an empty phone as null", () => {
    expect(createEmployeeSchema.parse(valid).phone).toBeNull();
  });

  it("rejects a username with characters outside letters, digits, dot, underscore, and hyphen", () => {
    for (const username of ["sara ali", "sara@kosh", "سارة", "sara/ali", ""]) {
      expect(invalidFields(createEmployeeSchema.safeParse({ ...valid, username })), username).toEqual(["username"]);
    }
    expect(createEmployeeSchema.safeParse({ ...valid, username: "sara_ali-2.x" }).success).toBe(true);
  });

  it("rejects an invalid email, name, phone, and role", () => {
    expect(
      invalidFields(
        createEmployeeSchema.safeParse({ ...valid, email: "sara", name: "  ", phone: "call me", role: "OWNER" }),
      ),
    ).toEqual(["email", "name", "phone", "role"]);
    expect(invalidFields(createEmployeeSchema.safeParse({ ...valid, name: "12345" }))).toEqual(["name"]);
    expect(invalidFields(createEmployeeSchema.safeParse({ ...valid, name: "Sara\nAli" }))).toEqual(["name"]);
  });

  it("requires a password of 8 to 128 characters that matches its confirmation", () => {
    const withPassword = (password: string, confirmPassword = password) =>
      createEmployeeSchema.safeParse({ ...valid, password, confirmPassword });

    expect(invalidFields(withPassword("short"))).toEqual(["password"]);
    expect(invalidFields(withPassword("x".repeat(129)))).toEqual(["password"]);
    expect(withPassword("x".repeat(128)).success).toBe(true);

    const mismatch = withPassword("correct-horse", "correct-house");
    expect(invalidFields(mismatch)).toEqual(["confirmPassword"]);
    expect(mismatch.error?.issues[0].code).toBe("custom");
  });
});

describe("updateEmployeeSchema", () => {
  const details = { name: valid.name, username: valid.username, email: valid.email, phone: "+971 50 123 4567" };

  it("accepts details without a role and has no password fields", () => {
    expect(updateEmployeeSchema.parse({ ...details, password: "ignored-entirely" })).toEqual(details);
  });

  it("accepts a known role and rejects an unknown one", () => {
    expect(updateEmployeeSchema.parse({ ...details, role: "SUPERVISOR" }).role).toBe("SUPERVISOR");
    expect(invalidFields(updateEmployeeSchema.safeParse({ ...details, role: "" }))).toEqual(["role"]);
  });
});

describe("setEmployeePasswordSchema", () => {
  it("applies the same length and match rules", () => {
    expect(setEmployeePasswordSchema.safeParse({ password: "correct-horse", confirmPassword: "correct-horse" }).success).toBe(
      true,
    );
    expect(invalidFields(setEmployeePasswordSchema.safeParse({ password: "short", confirmPassword: "short" }))).toEqual([
      "password",
    ]);
    expect(
      invalidFields(setEmployeePasswordSchema.safeParse({ password: "correct-horse", confirmPassword: "" })),
    ).toEqual(["confirmPassword"]);
  });
});

describe("employeeIdSchema", () => {
  it("rejects an empty, oversized, or non-string id", () => {
    expect(employeeIdSchema.safeParse("ckv1").success).toBe(true);
    for (const id of ["", "x".repeat(101), null, undefined]) expect(employeeIdSchema.safeParse(id).success).toBe(false);
  });
});
