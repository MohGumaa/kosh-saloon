import { DashboardLinkProps, ModesProps } from "@/types";
import { Banknote, FileText, ClipboardList, House, MonitorCog, Moon, ScanEye, Scissors, Sun, Users } from "lucide-react";

export const MODES: ModesProps[] = [
  { id: "system", label: "system", icon: MonitorCog },
  { id: "light", label: "light", icon: Sun },
  { id: "dark", label: "dark", icon: Moon }
]

export const DASHBOARD_LINKS: DashboardLinkProps[] = [
  {
    id: "dashboard",
    label: "لوحة التحكم",
    href: "/dashboard",
    icon: House,
    allowedRoles: ["ADMIN", "SUPERVISOR", "STAFF"],
  },
  {
    id: "create-invoice",
    label: "إنشاء معاملة جديدة",
    href: "/dashboard/invoices/create",
    icon: FileText,
    allowedRoles: ["ADMIN", "SUPERVISOR", "STAFF"],
  },
  {
    id: "invoices",
    label: "المعاملات",
    href: "/dashboard/invoices",
    icon: Banknote,
    allowedRoles: ["ADMIN", "SUPERVISOR", "STAFF"],
  },
  {
    id: "reports",
    label: "التقارير",
    href: "/dashboard/reports",
    icon: ClipboardList,
    allowedRoles: ["ADMIN", "SUPERVISOR", "STAFF"],
  },
  {
    id: "services-catalog",
    label: "الخدمات",
    href: "/dashboard/services",
    icon: Scissors,
    allowedRoles: ["ADMIN", "SUPERVISOR"],
  },
  {
    id: "staff",
    label: "الموظفين",
    href: "/dashboard/our-staff",
    icon: Users,
    allowedRoles: ["ADMIN"],
  },
  {
    id: "access",
    label: "صلاحيات الوصول",
    href: "/dashboard/access",
    icon: ScanEye,
    allowedRoles: ["ADMIN"],
  },
];

// const { user } = useAuthContext(); // user.role: "ADMIN" | "SUPERVISOR" | "STAFF"
export const user: any = {name: "Mohamed", role: "ADMIN"};