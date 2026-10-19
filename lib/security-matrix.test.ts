/**
 * The role contract from the project overview, checked across every pure access
 * gate at once. Each row is one actor; expectations come from the overview's role
 * table, so a gate that drifts from it fails here even if its own tests pass.
 */
import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS, changeableKeys, type PermissionKey } from "@/lib/auth/permissions";
import { canViewSalonDashboard } from "@/lib/dashboard";
import { canChangeEmployeeRole, canManageEmployee, canManageEmployeeAccess, type Role } from "@/lib/employees";
import { canManageInvoices, canViewEmployeeInvoices } from "@/lib/invoices";
import { visibleNavKeys } from "@/lib/navigation";
import {
  canViewEmployeePerformance,
  canViewExpenseReport,
  canViewRevenueReport,
  employeeReportScope,
  settlementReportScope,
} from "@/lib/reports";
import {
  SETTLEMENT_TRANSITIONS,
  canAdjustSettlement,
  canManageSettlements,
  canRunSettlementAction,
  type SettlementAction,
} from "@/lib/settlements";

interface Actor {
  id: string;
  role: Role;
  permissions: ReadonlySet<PermissionKey>;
}

const actor = (id: string, role: Role, keys: readonly PermissionKey[]): Actor => ({
  id,
  role,
  permissions: new Set(keys),
});

const ACTORS = {
  admin: actor("admin", "ADMIN", PERMISSION_KEYS),
  supervisor: actor("supervisor", "SUPERVISOR", ROLE_DEFAULTS.SUPERVISOR),
  staff: actor("staff", "STAFF", ROLE_DEFAULTS.STAFF),
  staffGrantedAll: actor("staffAll", "STAFF", PERMISSION_KEYS),
  supervisorWithNone: actor("supervisorNone", "SUPERVISOR", []),
};

type ActorName = keyof typeof ACTORS;
type Row<T> = Record<ActorName, T>;

const OTHER = "someone-else";

/** Runs `gate` for each actor and compares the whole row, so a failure shows every role at once. */
function expectRow<T>(gate: (actor: Actor) => T, expected: Row<T>) {
  const actual = Object.fromEntries(
    (Object.keys(ACTORS) as ActorName[]).map((name) => [name, gate(ACTORS[name])]),
  );
  expect(actual).toEqual(expected);
}

describe("role defaults", () => {
  it("never give a Supervisor approval, payment, settings, permission, or account-management keys", () => {
    const explicitOnly: PermissionKey[] = [
      "settlements.approve",
      "settlements.mark_paid",
      "settings.view",
      "settings.edit",
      "settings.security",
      "permissions.manage",
      "employees.create",
      "employees.edit",
      "employees.delete",
      "employees.activate",
    ];
    for (const key of explicitOnly) expect(ROLE_DEFAULTS.SUPERVISOR).not.toContain(key);
  });

  it("give Staff only their own invoices, services, own performance, and own settlements", () => {
    expect([...ROLE_DEFAULTS.STAFF].sort()).toEqual(
      ["invoices.create", "invoices.view", "reports.view_own_performance", "services.view", "settlements.view"].sort(),
    );
  });
});

describe("invoices", () => {
  it("lets only non-Staff roles edit or change status", () => {
    expectRow((a) => canManageInvoices(a), {
      admin: true,
      supervisor: true,
      staff: false,
      staffGrantedAll: false,
      supervisorWithNone: true, // the role gate only; the action still needs the permission
    });
  });

  it("shows another employee's invoices only to non-Staff holding invoices.view", () => {
    expectRow((a) => canViewEmployeeInvoices(a, a.permissions, OTHER), {
      admin: true,
      supervisor: true,
      staff: false,
      staffGrantedAll: false,
      supervisorWithNone: false,
    });
  });

  it("shows a user their own invoices with invoices.view", () => {
    expectRow((a) => canViewEmployeeInvoices(a, a.permissions, a.id), {
      admin: true,
      supervisor: true,
      staff: true,
      staffGrantedAll: true,
      supervisorWithNone: false,
    });
  });
});

describe("salon-wide dashboard and reports", () => {
  const salonWide: Row<boolean> = {
    admin: true,
    supervisor: true,
    staff: false,
    staffGrantedAll: false,
    supervisorWithNone: false,
  };

  it("never shows Staff the salon dashboard", () => {
    expectRow((a) => canViewSalonDashboard(a, a.permissions), salonWide);
  });

  it("never shows Staff the revenue report", () => {
    expectRow((a) => canViewRevenueReport(a, a.permissions), salonWide);
  });

  it("never shows Staff the expense report", () => {
    expectRow((a) => canViewExpenseReport(a, a.permissions), salonWide);
  });

  it("limits Staff to their own performance, whatever they hold", () => {
    expectRow((a) => employeeReportScope(a, a.permissions), {
      admin: "all",
      supervisor: "all",
      staff: "own",
      staffGrantedAll: "own",
      supervisorWithNone: null,
    });
    expectRow((a) => canViewEmployeePerformance(a, a.permissions, OTHER), salonWide);
    expectRow((a) => canViewEmployeePerformance(a, a.permissions, a.id), {
      admin: true,
      supervisor: true,
      staff: true,
      staffGrantedAll: true,
      supervisorWithNone: false,
    });
  });

  it("limits Staff to their own settlement report, whatever they hold", () => {
    expectRow((a) => settlementReportScope(a, a.permissions), {
      admin: "all",
      supervisor: "all",
      staff: "own",
      staffGrantedAll: "own",
      supervisorWithNone: null,
    });
  });
});

describe("settlements", () => {
  it("let a default Supervisor create but not approve or pay, and Staff do nothing", () => {
    const manage = (key: PermissionKey) => (a: Actor) => canManageSettlements(a.permissions, a, key);
    expectRow(manage("settlements.create"), {
      admin: true,
      supervisor: true,
      staff: false,
      staffGrantedAll: false,
      supervisorWithNone: false,
    });
    for (const key of ["settlements.approve", "settlements.mark_paid"] as const) {
      expectRow(manage(key), {
        admin: true,
        supervisor: false,
        staff: false,
        staffGrantedAll: false,
        supervisorWithNone: false,
      });
    }
  });

  it("run each status action only for a non-Staff actor holding its permission", () => {
    for (const action of Object.keys(SETTLEMENT_TRANSITIONS) as SettlementAction[]) {
      const { from, permission } = SETTLEMENT_TRANSITIONS[action];
      expectRow((a) => canRunSettlementAction(action, from[0], a.permissions, a), {
        admin: true,
        supervisor: ROLE_DEFAULTS.SUPERVISOR.includes(permission),
        staff: false,
        staffGrantedAll: false,
        supervisorWithNone: false,
      });
    }
  });

  it("let only an actor who may pay adjust a paid settlement", () => {
    expectRow((a) => canAdjustSettlement("PAID", a.permissions, a), {
      admin: true,
      supervisor: false,
      staff: false,
      staffGrantedAll: false,
      supervisorWithNone: false,
    });
  });
});

describe("employee accounts", () => {
  const targets = {
    admin: { id: "target-admin", role: "ADMIN" as const },
    supervisor: { id: "target-supervisor", role: "SUPERVISOR" as const },
    staff: { id: "target-staff", role: "STAFF" as const },
  };

  /** What `rule` allows this actor to do to each kind of target, themself included. */
  const reach = (rule: typeof canManageEmployee) => (a: Actor) => ({
    admin: rule(a, targets.admin),
    supervisor: rule(a, targets.supervisor),
    staff: rule(a, targets.staff),
    self: rule(a, a),
  });

  // These are target rules; each action also checks its `employees.*` permission. An Admin's
  // explicit grant of that permission to a Staff user is honored (features 06 and 28).
  it("let only an ADMIN manage Admins and Supervisors; anyone else only other Staff", () => {
    const otherStaffOnly = { admin: false, supervisor: false, staff: true, self: false };
    expectRow(reach(canManageEmployee), {
      admin: { admin: true, supervisor: true, staff: true, self: true },
      supervisor: otherStaffOnly,
      staff: otherStaffOnly,
      staffGrantedAll: otherStaffOnly,
      supervisorWithNone: otherStaffOnly,
    });
  });

  it("never let anyone change their own status or password here", () => {
    const otherStaffOnly = { admin: false, supervisor: false, staff: true, self: false };
    expectRow(reach(canManageEmployeeAccess), {
      admin: { admin: true, supervisor: true, staff: true, self: false },
      supervisor: otherStaffOnly,
      staff: otherStaffOnly,
      staffGrantedAll: otherStaffOnly,
      supervisorWithNone: otherStaffOnly,
    });
  });

  it("let only an ADMIN assign a role, never their own", () => {
    const none = { admin: false, supervisor: false, staff: false, self: false };
    expectRow(reach(canChangeEmployeeRole), {
      admin: { admin: true, supervisor: true, staff: true, self: false },
      supervisor: none,
      staff: none,
      staffGrantedAll: none,
      supervisorWithNone: none,
    });
  });
});

describe("permission management", () => {
  it("never lets a non-admin grant permissions.manage or a key they lack", () => {
    expectRow((a) => changeableKeys(a.role, a.permissions), {
      admin: PERMISSION_KEYS,
      supervisor: [],
      staff: [],
      staffGrantedAll: PERMISSION_KEYS.filter((key) => key !== "permissions.manage"),
      supervisorWithNone: [],
    });
  });
});

describe("navigation", () => {
  it("shows the audit log to an ADMIN only and settings to no default role", () => {
    expectRow((a) => visibleNavKeys(a.permissions, a.role), {
      admin: [
        "dashboard",
        "invoices",
        "salonExpenses",
        "employees",
        "services",
        "revenue",
        "expenses",
        "employeePerformance",
        "employeeEarnings",
        "settlements",
        "settings",
        "auditLog",
      ],
      supervisor: [
        "dashboard",
        "invoices",
        "salonExpenses",
        "employees",
        "services",
        "revenue",
        "expenses",
        "employeePerformance",
        "employeeEarnings",
        "settlements",
      ],
      staff: ["dashboard", "invoices", "services", "employeePerformance", "settlements"],
      // Links only: the report pages still refuse Staff (open finding F-50 covers the dead links).
      staffGrantedAll: [
        "dashboard",
        "invoices",
        "salonExpenses",
        "employees",
        "services",
        "revenue",
        "expenses",
        "employeePerformance",
        "employeeEarnings",
        "settlements",
        "settings",
      ],
      supervisorWithNone: ["dashboard"],
    });
  });
});
