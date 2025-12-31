import { LucideIcon } from "lucide-react";

export type modesProps = {
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

export type dashboardLinksProps = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon
}