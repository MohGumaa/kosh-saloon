import {
  FileText,
  LayoutDashboard,
  Scissors,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Translation key under the `nav` namespace. */
  key: string;
  icon?: LucideIcon;
  /** Omitted until the feature that builds the route enables the item. */
  href?: string;
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
      { key: "invoices", icon: FileText },
      { key: "salonExpenses", icon: Wallet },
    ],
  },
  {
    key: "manage",
    items: [
      { key: "employees", icon: Users },
      { key: "services", icon: Scissors },
    ],
  },
  {
    key: "reports",
    items: [
      { key: "revenue" },
      { key: "expenses" },
      { key: "employeePerformance" },
      { key: "employeeEarnings" },
      { key: "settlements" },
    ],
  },
  { key: "system", items: [{ key: "settings", icon: Settings }] },
];
