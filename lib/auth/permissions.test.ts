import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS, changeableKeys, type PermissionKey } from "@/lib/auth/permissions";

describe("permission catalog", () => {
  it("has exactly the 33 keys from the project overview", () => {
    expect([...PERMISSION_KEYS].sort()).toEqual(
      [
        "employees.view",
        "employees.create",
        "employees.edit",
        "employees.delete",
        "employees.activate",
        "services.view",
        "services.create",
        "services.edit",
        "services.delete",
        "invoices.view",
        "invoices.create",
        "invoices.edit",
        "invoices.delete",
        "invoices.change_status",
        "expenses.view",
        "expenses.create",
        "expenses.edit",
        "expenses.delete",
        "employee_expenses.view",
        "employee_expenses.create",
        "employee_expenses.edit",
        "employee_expenses.delete",
        "reports.view",
        "reports.view_all_employees",
        "reports.view_own_performance",
        "settlements.view",
        "settlements.create",
        "settlements.approve",
        "settlements.mark_paid",
        "settings.view",
        "settings.edit",
        "settings.security",
        "permissions.manage",
      ].sort(),
    );
    expect(new Set(PERMISSION_KEYS).size).toBe(33);
  });

  it("matches the rows inserted by the migrations", () => {
    const migrations = join(process.cwd(), "prisma", "migrations");
    const inserted = readdirSync(migrations, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const sql = readFileSync(join(migrations, entry.name, "migration.sql"), "utf8");
        return [...sql.matchAll(/^\s*\(gen_random_uuid\(\)::text, '([a-z_]+\.[a-z_]+)',/gm)].map((match) => match[1]);
      });

    expect(inserted.sort()).toEqual([...PERMISSION_KEYS].sort());
  });
});

describe("role defaults", () => {
  it("gives a Supervisor the overview's default set", () => {
    expect([...ROLE_DEFAULTS.SUPERVISOR].sort()).toEqual(
      [
        "employees.view",
        "services.view",
        "invoices.view",
        "invoices.create",
        "invoices.edit",
        "invoices.change_status",
        "expenses.view",
        "expenses.create",
        "employee_expenses.view",
        "employee_expenses.create",
        "reports.view",
        "reports.view_all_employees",
        "settlements.view",
        "settlements.create",
      ].sort(),
    );
  });

  it("gives Staff the overview's default set", () => {
    expect([...ROLE_DEFAULTS.STAFF].sort()).toEqual(
      ["services.view", "invoices.create", "invoices.view", "reports.view_own_performance", "settlements.view"].sort(),
    );
  });

  it("never includes permission management, settings, or settlement approval by default", () => {
    for (const key of [...ROLE_DEFAULTS.SUPERVISOR, ...ROLE_DEFAULTS.STAFF]) {
      expect(key).not.toMatch(/^(permissions|settings)\.|^settlements\.(approve|mark_paid)$/);
    }
  });
});

describe("changeableKeys", () => {
  const held = new Set<PermissionKey>(["permissions.manage", "invoices.view", "services.view"]);

  it("lets an ADMIN change every key", () => {
    expect(changeableKeys("ADMIN", new Set())).toEqual(PERMISSION_KEYS);
  });

  it("limits a manager to keys they hold, never permission management", () => {
    expect(changeableKeys("SUPERVISOR", held).sort()).toEqual(["invoices.view", "services.view"]);
  });

  it("gives nothing to a user without permission management", () => {
    expect(changeableKeys("SUPERVISOR", new Set<PermissionKey>(["invoices.view"]))).toEqual([]);
  });
});
