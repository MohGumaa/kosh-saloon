import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmployeeCreateForm } from "@/components/employees/EmployeeCreateForm";
import { requirePermission } from "@/lib/auth/authorize";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("employees");
  return { title: t("create.title") };
}

export default async function NewEmployeePage() {
  const { user, permissions } = await requirePermission("employees.create");
  const t = await getTranslations("employees");
  const canView = permissions.has("employees.view");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {canView && (
        <Link
          href="/employees"
          className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("back")}
        </Link>
      )}

      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-7">
        <h1 className="text-2xl font-semibold">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("create.description")}</p>
        <div className="mt-6">
          <EmployeeCreateForm canAssignRole={user.role === "ADMIN"} canView={canView} />
        </div>
      </section>
    </div>
  );
}
