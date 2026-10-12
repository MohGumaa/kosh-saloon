import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, HandCoins, Receipt, Tags, Users, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { ReportPeriodControls } from "@/components/reports/ReportPeriodControls";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { addDays } from "@/lib/dashboard";
import { dateValue, salonToday } from "@/lib/expenses";
import { employeeLabels } from "@/lib/names";
import {
  canViewExpenseReport,
  expenseBreakdown,
  expenseSections,
  parseRevenueReport,
  type ExpenseBreakdownRow,
} from "@/lib/reports";
import { loadExpenseReport } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenseReport");
  return { title: t("title") };
}

// min-w-0 lets a grid cell shrink below its content, so a wide table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const numberCell = "px-3 py-3 tabular-nums whitespace-nowrap";

const headCell = "px-3 py-2.5 font-medium";

function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function ExpenseReportPage({ searchParams }: PageProps<"/reports/expenses">) {
  const { user } = await requireSession();
  const permissions = await getPermissions(user);
  if (!canViewExpenseReport(user, permissions)) redirect("/forbidden");

  const today = salonToday();
  const range = parseRevenueReport(await searchParams, today);
  const sections = expenseSections(permissions);
  const [data, t, tPeriod, tSalon, tEmployee, locale] = await Promise.all([
    loadExpenseReport(range, sections),
    getTranslations("expenseReport"),
    getTranslations("reportPeriod"),
    getTranslations("expenses"),
    getTranslations("employeeExpenses"),
    getLocale(),
  ]);

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const count = new Intl.NumberFormat(locale);
  // Calendar days are stored as UTC midnight, so formatting in UTC names the same day for every viewer.
  const days = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const rangeLabel = days.formatRange(dateValue(range.from), dateValue(range.to));
  const dayLabel = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });

  const bucketLabel = (key: string): string => {
    if (range.group === "month") return monthLabel.format(dateValue(`${key}-01`));
    if (range.group === "day") return dayLabel.format(dateValue(key));
    // A week shows only its days inside the range.
    const start = key < range.from ? range.from : key;
    const sunday = addDays(key, 6);
    const end = sunday > range.to ? range.to : sunday;
    return start === end ? dayLabel.format(dateValue(start)) : dayLabel.formatRange(dateValue(start), dateValue(end));
  };

  // Salon expenses and employee deductions are different kinds of money, so they are never added together.
  const kinds = [
    data.salon && { key: "salon" as const, column: "salon" as const, icon: Receipt, ...data.salon },
    data.employee && { key: "employee" as const, column: "employeeDeductions" as const, icon: HandCoins, ...data.employee },
  ].filter((kind) => !!kind);
  const empty = kinds.every((kind) => kind.count === 0);

  const money = (amount: { toNumber(): number }) => <span dir="ltr">{price.format(amount.toNumber())}</span>;

  const salonCategories =
    data.salon &&
    expenseBreakdown(
      data.salon.byCategory,
      new Map(data.salon.byCategory.map((row) => [row.id, tSalon(`categories.${row.id}` as "categories.OTHER")])),
      (label) => label,
      locale,
    );
  const employeeCategories =
    data.employee &&
    expenseBreakdown(
      data.employee.byCategory,
      new Map(data.employee.byCategory.map((row) => [row.id, tEmployee(`categories.${row.id}` as "categories.OTHER")])),
      (label) => label,
      locale,
    );
  const employees = data.byEmployee
    ? expenseBreakdown(data.byEmployee.rows, data.byEmployee.details, (employee) => employee.name, locale)
    : null;
  const labels = employees ? employeeLabels(employees.map((row) => row.detail.name), locale) : [];
  const employeeLabel = new Map(employees?.map((row, i) => [row.id, labels[i]]));

  const breakdownTable = <T,>(
    id: "salonByCategory" | "employeeByCategory" | "byEmployee",
    rows: ExpenseBreakdownRow<T>[],
    first: "category" | "employee",
    total: { count: number; total: { toNumber(): number } },
    icon: LucideIcon,
    name: (row: ExpenseBreakdownRow<T>) => { label: string; full: string; image?: string | null; inactive?: boolean },
  ) => (
    <section aria-labelledby={`expenses-${id}`} className={panelClass}>
      <h2 id={`expenses-${id}`} className="text-lg font-semibold">
        {t(`${id}.title`)}
      </h2>
      {rows.length === 0 ? (
        <EmptyState icon={icon}>{t(`${id}.empty`)}</EmptyState>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table aria-labelledby={`expenses-${id}`} className="w-full min-w-sm text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className={cn(headCell, "text-start")}>
                  {t(`columns.${first}`)}
                </th>
                <th scope="col" className={cn(headCell, "text-center")}>
                  {t("columns.entries")}
                </th>
                <th scope="col" className={cn(headCell, "text-end")}>
                  {t("columns.amount")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const { label, full, image, inactive } = name(row);
                return (
                  <tr key={row.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <div className="flex items-center gap-3">
                        {image !== undefined && <UserAvatar name={full} image={image} className="size-8 text-xs" />}
                        <span className="min-w-0">
                          <span dir="auto" className="break-words" title={label === full ? undefined : full}>
                            {label}
                          </span>
                          {inactive && (
                            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                              {t("inactive")}
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    <td className={cn(numberCell, "text-center")}>{count.format(row.count)}</td>
                    <td className={cn(numberCell, "text-end")}>{money(row.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <th scope="row" className="px-3 py-3 text-start">
                  {t("total")}
                </th>
                <td className={cn(numberCell, "text-center")}>{count.format(total.count)}</td>
                <td className={cn(numberCell, "text-end")}>{money(total.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <ReportPeriodControls path="/reports/expenses" range={range} today={today} />

      <section aria-labelledby="expenses-period" className="flex flex-col gap-4">
        <h2 id="expenses-period" className="text-lg font-semibold">
          {tPeriod(`periods.${range.period}`)}
          <span className="ms-2 text-sm font-normal text-muted-foreground">{rangeLabel}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {kinds.map((kind) => (
            <StatCard
              key={kind.key}
              title={t(`summary.${kind.key}`)}
              value={price.format(kind.total.toNumber())}
              hint={t("hints.entries", { count: kind.count })}
              icon={kind.icon}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="expenses-over-time" className={panelClass}>
        <h2 id="expenses-over-time" className="text-lg font-semibold">
          {t("overTime.title")}
        </h2>
        {empty ? (
          <EmptyState icon={BarChart3}>{t("overTime.empty")}</EmptyState>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-sm text-sm">
              <caption className="sr-only">{t("overTime.caption", { range: rangeLabel })}</caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className={cn(headCell, "text-start")}>
                    {t("columns.period")}
                  </th>
                  {kinds.map((kind) => (
                    <th key={kind.key} scope="col" className={cn(headCell, "text-end")}>
                      {t(`columns.${kind.column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.keys.map((key, index) => (
                  <tr key={key}>
                    <th scope="row" className="px-3 py-3 text-start font-medium whitespace-nowrap">
                      {bucketLabel(key)}
                    </th>
                    {kinds.map((kind) => (
                      <td key={kind.key} className={cn(numberCell, "text-end")}>
                        {money(kind.buckets[index])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <th scope="row" className="px-3 py-3 text-start">
                    {t("total")}
                  </th>
                  {kinds.map((kind) => (
                    <td key={kind.key} className={cn(numberCell, "text-end")}>
                      {money(kind.total)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {data.salon &&
          salonCategories &&
          breakdownTable("salonByCategory", salonCategories, "category", data.salon, Tags, (row) => ({
            label: row.detail,
            full: row.detail,
          }))}
        {data.employee &&
          employeeCategories &&
          breakdownTable("employeeByCategory", employeeCategories, "category", data.employee, Tags, (row) => ({
            label: row.detail,
            full: row.detail,
          }))}
        {/* Every deduction belongs to an employee, so the section totals are the table's totals. */}
        {data.employee &&
          employees &&
          breakdownTable("byEmployee", employees, "employee", data.employee, Users, (row) => ({
            label: employeeLabel.get(row.id) ?? row.detail.name,
            full: row.detail.name,
            image: row.detail.image,
            inactive: !row.detail.isActive,
          }))}
      </div>
    </div>
  );
}
