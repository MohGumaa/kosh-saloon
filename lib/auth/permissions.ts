/**
 * The permission catalog and role defaults. No database import, so client
 * components and tests can use it. The Permission table rows are inserted by
 * migrations and must match these keys.
 */
export const PERMISSION_GROUPS = {
  employees: ["view", "create", "edit", "delete", "activate"],
  services: ["view", "create", "edit", "delete"],
  invoices: ["view", "create", "edit", "delete", "change_status"],
  expenses: ["view", "create", "edit", "delete"],
  employee_expenses: ["view", "create", "edit", "delete"],
  reports: ["view", "view_all_employees", "view_own_performance"],
  settlements: ["view", "create", "approve", "mark_paid"],
  settings: ["view", "edit", "security"],
  permissions: ["manage"],
} as const;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;

export type PermissionKey = {
  [G in PermissionGroup]: `${G}.${(typeof PERMISSION_GROUPS)[G][number]}`;
}[PermissionGroup];

export const PERMISSION_KEYS = Object.entries(PERMISSION_GROUPS).flatMap(([group, actions]) =>
  actions.map((action) => `${group}.${action}`),
) as PermissionKey[];

type Role = "ADMIN" | "SUPERVISOR" | "STAFF";

/** What a new Supervisor or Staff user's list is filled with. An ADMIN always has every key. */
export const ROLE_DEFAULTS: Record<Exclude<Role, "ADMIN">, readonly PermissionKey[]> = {
  SUPERVISOR: [
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
  ],
  STAFF: ["services.view", "invoices.view", "invoices.create", "reports.view_own_performance", "settlements.view"],
};

/**
 * The permissions an actor may give to or remove from another user: every key
 * for an ADMIN; otherwise only keys the actor holds, and never `permissions.manage`.
 */
export function changeableKeys(actorRole: Role, actorPermissions: ReadonlySet<PermissionKey>): PermissionKey[] {
  if (actorRole === "ADMIN") return PERMISSION_KEYS;
  if (!actorPermissions.has("permissions.manage")) return [];
  return PERMISSION_KEYS.filter((key) => key !== "permissions.manage" && actorPermissions.has(key));
}
