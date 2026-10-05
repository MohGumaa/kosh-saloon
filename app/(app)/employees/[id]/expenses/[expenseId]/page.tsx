import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Clock,
  FileText,
  Pencil,
  Tag,
  Trash2,
  UserPen,
  UserRound,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmployeeExpenseDeleteForm } from "@/components/employee-expenses/EmployeeExpenseDeleteForm";
import { EmployeeExpenseEditForm } from "@/components/employee-expenses/EmployeeExpenseEditForm";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { Detail, Panel } from "@/components/layout/Panel";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { employeeExpenseListHref } from "@/lib/employee-expenses";
import { dayOf, salonToday } from "@/lib/expenses";
import { getSalonSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("employeeExpenses");
  return { title: t("detail.title") };
}

export default async function EmployeeExpensePage({
  params,
}: PageProps<"/employees/[id]/expenses/[expenseId]">) {
  const { permissions } = await requirePermission("employee_expenses.view");
  const { id, expenseId } = await params;
  const [t, locale, { currency }, expense] = await Promise.all([
    getTranslations("employeeExpenses"),
    getLocale(),
    getSalonSettings(),
    // Both ids, so a URL never shows one employee's deduction under another employee.
    db.employeeExpense.findFirst({
      where: { id: expenseId, employeeId: id },
      select: {
        id: true,
        employeeId: true,
        category: true,
        amount: true,
        description: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);
  if (!expense) notFound();

  const canEdit = permissions.has("employee_expenses.edit");
  const canDelete = permissions.has("employee_expenses.delete");
  const listHref = employeeExpenseListHref(expense.employeeId, {});
  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  // A calendar day stored as UTC midnight; formatting it in UTC keeps the same day for every viewer.
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href={listHref}
        className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("back")}
      </Link>

      <h1 className="text-2xl font-semibold break-words lg:text-3xl">
        {t(`categories.${expense.category}`)} · <span dir="auto">{expense.employee.name}</span>
      </h1>

      <Panel icon={Wallet} title={t("detail.title")} description={t("detail.description")}>
        <dl className="-my-4 grid gap-x-8 sm:grid-cols-2">
          <Detail icon={UserRound} label={t("detail.employee")}>
            <span dir="auto">{expense.employee.name}</span>
          </Detail>
          <Detail icon={Tag} label={t("detail.category")}>
            {t(`categories.${expense.category}`)}
          </Detail>
          <Detail icon={Banknote} label={t("detail.amount")}>
            <span dir="ltr" className="tabular-nums">
              {price.format(expense.amount.toNumber())}
            </span>
          </Detail>
          <Detail icon={CalendarDays} label={t("detail.date")}>
            {day.format(expense.date)}
          </Detail>
          <Detail icon={UserPen} label={t("detail.createdBy")}>
            <span dir="auto">{expense.createdBy.name}</span>
          </Detail>
          <Detail icon={Clock} label={t("detail.createdAt")}>
            <LocalDateTime iso={expense.createdAt.toISOString()} timeStyle="short" />
          </Detail>
          <Detail icon={Clock} label={t("detail.updatedAt")}>
            <LocalDateTime iso={expense.updatedAt.toISOString()} timeStyle="short" />
          </Detail>
          <div className="sm:col-span-2">
            <Detail icon={FileText} label={t("detail.descriptionLabel")}>
              {expense.description ? (
                <span dir="auto" className="break-words whitespace-pre-line">
                  {expense.description}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("detail.noDescription")}</span>
              )}
            </Detail>
          </div>
        </dl>
      </Panel>

      {canEdit && (
        <Panel icon={Pencil} title={t("edit.title")} description={t("edit.description")}>
          <EmployeeExpenseEditForm
            id={expense.id}
            values={{
              category: expense.category,
              amount: expense.amount.toString(),
              description: expense.description ?? "",
              date: dayOf(expense.date),
            }}
            currency={currency}
            today={salonToday()}
          />
        </Panel>
      )}

      {canDelete && (
        <Panel icon={Trash2} title={t("deleteForm.title")} description={t("deleteForm.description")}>
          <EmployeeExpenseDeleteForm id={expense.id} listHref={listHref} />
        </Panel>
      )}
    </div>
  );
}
