import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSelect } from "@/components/ui/form-select";
import { resolvePage } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  EMPLOYEE_EXPENSE_CATEGORIES,
  EMPLOYEE_EXPENSE_PAGE_SIZE,
  employeeExpenseListHref,
  employeeExpenseWhere,
  parseEmployeeExpenseFilters,
} from "@/lib/employee-expenses";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const COLUMNS = ["date", "category", "amount", "description", "createdBy"] as const;

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

interface EmployeeExpensesTabProps {
  employeeId: string;
  searchParams: Record<string, string | string[] | undefined>;
  canCreate: boolean;
}

/** One employee's deductions, for a viewer the page has checked holds `employee_expenses.view`. */
export async function EmployeeExpensesTab({ employeeId, searchParams, canCreate }: EmployeeExpensesTabProps) {
  const filters = parseEmployeeExpenseFilters(searchParams);
  const filtered = Object.keys(filters).length > 0;
  const where = employeeExpenseWhere(employeeId, filters);
  const clearHref = employeeExpenseListHref(employeeId, {});
  const newHref = `/employees/${employeeId}/expenses/new`;

  const [t, locale, { currency }, total] = await Promise.all([
    getTranslations("employeeExpenses"),
    getLocale(),
    getSalonSettings(),
    db.employeeExpense.count({ where }),
  ]);
  const totalPages = Math.ceil(total / EMPLOYEE_EXPENSE_PAGE_SIZE);
  const page = resolvePage(searchParams.page, totalPages);

  const expenses =
    total === 0
      ? []
      : await db.employeeExpense.findMany({
          where,
          // The id breaks ties, so deductions saved in the same millisecond keep one order across pages.
          orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * EMPLOYEE_EXPENSE_PAGE_SIZE,
          take: EMPLOYEE_EXPENSE_PAGE_SIZE,
          select: {
            id: true,
            category: true,
            amount: true,
            description: true,
            date: true,
            createdBy: { select: { name: true } },
          },
        });

  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  // A calendar day stored as UTC midnight; formatting it in UTC keeps the same day for every viewer.
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canCreate && (
          <Link
            href={newHref}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus aria-hidden className="size-4" />
            {t("new")}
          </Link>
        )}
      </div>

      <form
        method="get"
        action={`/employees/${employeeId}`}
        aria-label={t("filters.label")}
        className="grid min-w-0 gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card sm:grid-cols-2 lg:grid-cols-4 lg:p-6"
      >
        {/* Keeps the submitted filters on this tab. */}
        <input type="hidden" name="tab" value="expenses" />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="filter-category" className="text-sm font-medium">
            {t("filters.category")}
          </label>
          <FormSelect
            id="filter-category"
            name="category"
            defaultValue={filters.category ?? ""}
            options={[
              { value: "", label: t("filters.all") },
              ...EMPLOYEE_EXPENSE_CATEGORIES.map((category) => ({
                value: category,
                label: t(`categories.${category}`),
              })),
            ]}
          />
        </div>
        {(["from", "to"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`filter-${key}`} className="text-sm font-medium">
              {t(`filters.${key}`)}
            </label>
            <DatePicker id={`filter-${key}`} name={key} defaultValue={filters[key]} clearable />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("filters.apply")}
          </button>
          {filtered && (
            <Link href={clearHref} className={cn(linkClass, "text-sm")}>
              {t("filters.clear")}
            </Link>
          )}
        </div>
      </form>

      {/* min-w-0 lets the card shrink below the table, so the table scrolls instead of widening the page. */}
      <section className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Wallet aria-hidden className="size-5" />
            </span>
            {filtered ? (
              <>
                <h3 className="text-lg font-semibold">{t("empty.noMatchTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("empty.noMatch")}</p>
                <Link href={clearHref} className={cn(linkClass, "text-sm")}>
                  {t("filters.clear")}
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">{t("empty.title")}</h3>
                <p className="text-sm text-muted-foreground">{t(canCreate ? "empty.create" : "empty.view")}</p>
                {canCreate && (
                  <Link href={newHref} className={cn(linkClass, "text-sm")}>
                    {t("new")}
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    {COLUMNS.map((column) => (
                      <th key={column} scope="col" className="px-3 py-2.5 text-start font-medium">
                        {t(`columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <th scope="row" className="px-3 py-3 text-start font-medium whitespace-nowrap">
                        <Link href={`/employees/${employeeId}/expenses/${expense.id}`} className={linkClass}>
                          {day.format(expense.date)}
                        </Link>
                      </th>
                      <td className="px-3 py-3 whitespace-nowrap">{t(`categories.${expense.category}`)}</td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span dir="ltr">{price.format(expense.amount.toNumber())}</span>
                      </td>
                      <td className="max-w-xs px-3 py-3">
                        {expense.description ? (
                          <span dir="auto" className="block truncate">
                            {expense.description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span dir="auto" className="break-words">
                          {expense.createdBy.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav
                aria-label={t("pagination.label")}
                className="mt-4 flex items-center justify-between gap-4 border-t pt-4 text-sm"
              >
                {page > 1 ? (
                  <Link href={employeeExpenseListHref(employeeId, filters, page - 1)} className={linkClass}>
                    {t("pagination.previous")}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-muted-foreground">
                    {t("pagination.previous")}
                  </span>
                )}
                <span className="text-muted-foreground">{t("pagination.page", { page, total: totalPages })}</span>
                {page < totalPages ? (
                  <Link href={employeeExpenseListHref(employeeId, filters, page + 1)} className={linkClass}>
                    {t("pagination.next")}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-muted-foreground">
                    {t("pagination.next")}
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}
