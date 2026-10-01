import {
  FileText,
  LayoutDashboard,
  Scissors,
  ScrollText,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";

export interface NavItem {
  /** Translation key under the `nav` namespace. */
  key: string;
  icon?: LucideIcon;
  /** Omitted until the feature that builds the route enables the item. */
  href?: string;
  /** The item is hidden unless the user holds one of these; none means everyone sees it. */
  permissions?: PermissionKey[];
  /** Shown to an ADMIN only, whatever permissions another user holds. */
  adminOnly?: boolean;
}

export interface NavGroup {
  /** Translation key under `nav.groups`, or none for the ungrouped top items. */
  key?: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  { items: [{ key: "dashboard", icon: LayoutDashboard, href: "/dashboard" }] },
  {
    key: "transactions",
    items: [
      { key: "invoices", icon: FileText, permissions: ["invoices.view"] },
      { key: "salonExpenses", icon: Wallet, permissions: ["expenses.view"] },
    ],
  },
  {
    key: "manage",
    items: [
      { key: "employees", icon: Users, href: "/employees", permissions: ["employees.view"] },
      { key: "services", icon: Scissors, permissions: ["services.view"] },
    ],
  },
  {
    key: "reports",
    items: [
      { key: "revenue", permissions: ["reports.view"] },
      { key: "expenses", permissions: ["reports.view"] },
      { key: "employeePerformance", permissions: ["reports.view", "reports.view_own_performance"] },
      { key: "employeeEarnings", permissions: ["reports.view"] },
      { key: "settlements", permissions: ["settlements.view"] },
    ],
  },
  {
    key: "system",
    items: [
      { key: "settings", icon: Settings, permissions: ["settings.view"] },
      { key: "auditLog", icon: ScrollText, href: "/audit-log", adminOnly: true },
    ],
  },
];

/** Keys of the items a user with this role and these permissions may see. Computed on the server. */
export function visibleNavKeys(permissions: ReadonlySet<PermissionKey>, role: SessionUser["role"]): string[] {
  return NAVIGATION.flatMap((group) => group.items)
    .filter((item) => !item.adminOnly || role === "ADMIN")
    .filter((item) => !item.permissions || item.permissions.some((key) => permissions.has(key)))
    .map((item) => item.key);
}

/** The navigation limited to those keys; a group with no visible items is dropped with its heading. */
export function visibleNavGroups(navKeys: readonly string[]): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => navKeys.includes(item.key)),
  })).filter((group) => group.items.length > 0);
}
