import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmployeeExpenseCreateForm } from "@/components/employee-expenses/EmployeeExpenseCreateForm";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { employeeExpenseListHref } from "@/lib/employee-expenses";
import { salonToday } from "@/lib/expenses";
import { getSalonSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("employeeExpenses");
  return { title: t("create.title") };
}

export default async function NewEmployeeExpensePage({ params }: PageProps<"/employees/[id]/expenses/new">) {
  const { permissions } = await requirePermission("employee_expenses.create");
  const { id } = await params;
  const [t, { currency }, employee] = await Promise.all([
    getTranslations("employeeExpenses"),
    getSalonSettings(),
    db.user.findUnique({ where: { id }, select: { id: true, name: true } }),
  ]);
  if (!employee) notFound();

  const canView = permissions.has("employee_expenses.view");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {canView && (
        <Link
          href={employeeExpenseListHref(employee.id, {})}
          className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("back")}
        </Link>
      )}

      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-7">
        <h1 className="text-2xl font-semibold">{t("create.title")}</h1>
        <p className="mt-1 text-lg font-medium break-words" dir="auto">
          {employee.name}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("create.description")}</p>
        <div className="mt-6">
          <EmployeeExpenseCreateForm
            employeeId={employee.id}
            currency={currency}
            today={salonToday()}
            canView={canView}
          />
        </div>
      </section>
    </div>
  );
}
