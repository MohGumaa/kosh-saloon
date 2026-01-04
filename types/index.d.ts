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


export type DashboardLinkProps = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon
  allowedRoles: UserRole[];
}

export type UserRole = "ADMIN" | "SUPERVISOR" | "STAFF";

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  image_url?: string;
  role: UserRole;
};

export type Services = {
  id: string;
  name_en: string;
  name_ar: string;
  is_active: boolean;
  created_by_id: string;
};

export type Revenue = {
  month: string;
  revenue: number;
};

export type Invoice = {
  id: string;
  service_id: string;
  user_id: string;
  amount: number;
  status: 'paid' | 'pending';
  date: string;
  notes?: string;
};

export type LatestInvoice = {
  id: string;
  name: string;
  image_url: string;
  email: string;
  amount: string;
};

// The database returns a number for amount, but we later format it to a string with the formatCurrency function
export type LatestInvoiceRaw = Omit<LatestInvoice, 'amount'> & {
  amount: number;
};
