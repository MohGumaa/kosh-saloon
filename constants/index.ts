import { dashboardLinksProps, modesProps } from "@/types";
import { Banknote, BookLock, House, Key, MonitorCog, Moon, Receipt, ScanEye, Sun, Users } from "lucide-react";

export const MODES: modesProps[] = [
  { id: "system", label: "system", icon: MonitorCog },
  { id: "light", label: "light", icon: Sun },
  { id: "dark", label: "dark", icon: Moon }
]

export const DASHBOARDLINKS: dashboardLinksProps[] = [
  { id: 'ho',
    label: 'Home',
    href: '/dashboard',
    icon: House },
  { 
    id: 'id',
    label: 'Customers',
    href: '/dashboard/customers',
    icon: Users 
  },
  {
    id: 'tr',
    label: 'Transactions',
    href: '/dashboard/transactions',
    icon: Receipt,
  },
  { 
    id: 'billing',
    label: 'Billing', 
    href: '/dashboard/billing',
    icon: Banknote 
  },
  { id: 'is',
    label: 'API keys', 
    href: '/dashboard/api-keys',
    icon: Key 
  },
  { 
    id: 'log',
    label: 'Logs', 
    href: '/dashboard/logs',
    icon: BookLock 
  },
  { 
    id: 'co',
    label: 'Cost',
    href: '/dashboard/cost',
    icon: ScanEye 
  },
];
