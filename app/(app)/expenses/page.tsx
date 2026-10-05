import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { resolvePage } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAGE_SIZE,
  expenseListHref,
  expenseWhere,
  parseExpenseFilters,
} from "@/lib/expenses";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: t("title") };
}

const COLUMNS = ["date", "title", "category", "amount", "createdBy"] as const;

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

const controlClass =
  "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const { permissions } = await requirePermission("expenses.view");
  const canCreate = permissions.has("expenses.create");

  const params = await searchParams;
  const filters = parseExpenseFilters(params);
  const filtered = Object.keys(filters).length > 0;
  const where = expenseWhere(filters);

  const [t, locale, { currency }, total] = await Promise.all([
    getTranslations("expenses"),
    getLocale(),
    getSalonSettings(),
    db.salonExpense.count({ where }),
  ]);
  const totalPages = Math.ceil(total / EXPENSE_PAGE_SIZE);
  const page = resolvePage(params.page, totalPages);

  const expenses =
    total === 0
      ? []
      : await db.salonExpense.findMany({
          where,
          // The id breaks ties, so expenses saved in the same millisecond keep one order across pages.
          orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * EXPENSE_PAGE_SIZE,
          take: EXPENSE_PAGE_SIZE,
          select: {
            id: true,
            title: true,
            category: true,
            amount: true,
            date: true,
            createdBy: { select: { name: true } },
          },
        });

  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  // A calendar day stored as UTC midnight; formatting it in UTC keeps the same day for every viewer.
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canCreate && (
          <Link
            href="/expenses/new"
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus aria-hidden className="size-4" />
            {t("new")}
          </Link>
        )}
      </div>

      <form
        method="get"
        action="/expenses"
        aria-label={t("filters.label")}
        className="grid min-w-0 gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card sm:grid-cols-2 lg:grid-cols-4 lg:p-6"
      >
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="filter-q" className="text-sm font-medium">
            {t("filters.q")}
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            maxLength={100}
            dir="auto"
            defaultValue={filters.q}
            placeholder={t("filters.qPlaceholder")}
            className={controlClass}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="filter-category" className="text-sm font-medium">
            {t("filters.category")}
          </label>
          <select id="filter-category" name="category" defaultValue={filters.category ?? ""} className={controlClass}>
            <option value="">{t("filters.all")}</option>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category}`)}
              </option>
            ))}
          </select>
        </div>
        {(["from", "to"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`filter-${key}`} className="text-sm font-medium">
              {t(`filters.${key}`)}
            </label>
            <input
              id={`filter-${key}`}
              name={key}
              type="date"
              dir="ltr"
              defaultValue={filters[key]}
              className={controlClass}
            />
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
            <Link href="/expenses" className={cn(linkClass, "text-sm")}>
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
                <h2 className="text-lg font-semibold">{t("empty.noMatchTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("empty.noMatch")}</p>
                <Link href="/expenses" className={cn(linkClass, "text-sm")}>
                  {t("filters.clear")}
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
                <p className="text-sm text-muted-foreground">{t(canCreate ? "empty.create" : "empty.view")}</p>
                {canCreate && (
                  <Link href="/expenses/new" className={cn(linkClass, "text-sm")}>
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
                      <td className="px-3 py-3 whitespace-nowrap">{day.format(expense.date)}</td>
                      <th scope="row" className="px-3 py-3 text-start font-medium">
                        <Link href={`/expenses/${expense.id}`} className={cn(linkClass, "break-words")} dir="auto">
                          {expense.title}
                        </Link>
                      </th>
                      <td className="px-3 py-3 whitespace-nowrap">{t(`categories.${expense.category}`)}</td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span dir="ltr">{price.format(expense.amount.toNumber())}</span>
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
                  <Link href={expenseListHref(filters, page - 1)} className={linkClass}>
                    {t("pagination.previous")}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-muted-foreground">
                    {t("pagination.previous")}
                  </span>
                )}
                <span className="text-muted-foreground">{t("pagination.page", { page, total: totalPages })}</span>
                {page < totalPages ? (
                  <Link href={expenseListHref(filters, page + 1)} className={linkClass}>
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
    </div>
  );
}
