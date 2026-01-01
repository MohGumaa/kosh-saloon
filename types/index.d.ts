import { LucideIcon } from "lucide-react";

export type ModesProps = {
  id: string;
  label: string;
  icon: LucideIcon
}

export type LogoProps = {
  label?: string;
  ClassName?: string;
  labelClassName?: string;
  iconClassName?: string;
};

export type UserRole = "ADMIN" | "SUPERVISOR" | "STAFF";

export type DashboardLinkProps = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon
  allowedRoles: UserRole[];
}
