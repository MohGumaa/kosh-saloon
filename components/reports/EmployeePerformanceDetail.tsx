import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Coins,
  Hourglass,
  Percent,
  Scissors,
  TrendingUp,
  Wallet,
  WalletMinimal,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { ReportEmptyState } from "@/components/reports/ReportEmptyState";
import { addDays } from "@/lib/dashboard";
import { dateValue } from "@/lib/expenses";
import { breakdownRows, type RevenueReportRange } from "@/lib/reports";
import type { EmployeePerformanceData } from "@/lib/reports-data";
import { getDirection, isLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

// min-w-0 lets a grid cell shrink below its content, so a wide table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const numberCell = "px-3 py-3 tabular-nums whitespace-nowrap";

const TIME_COLUMNS = ["invoices", "paid", "unpaid", "gross"] as const;

/** The service table leaves out unpaid; its gross still includes it. */
const SERVICE_COLUMNS = ["invoices", "paid", "gross"] as const;

type AmountColumn = (typeof TIME_COLUMNS)[number];

// The invoice count is centered; money lines up at the end of its column.
const align = (column: AmountColumn) => (column === "invoices" ? "text-center" : "text-end");

interface Amounts {
  count: number;
  paid: { toNumber(): number };
  unpaid: { toNumber(): number };
  gross: { toNumber(): number };
}

/** One employee's figures, revenue trend, and service performance for the period. */
export async function EmployeePerformanceDetail({
  data,
  range,
  locale,
  rangeLabel,
  showExpenses,
  backHref,
  showEmployee = true,
}: {
  data: EmployeePerformanceData;
  range: Pick<RevenueReportRange, "from" | "to" | "group">;
  locale: string;
  rangeLabel: string;
  /** Deductions and payout; the data has none otherwise. */
  showExpenses: boolean;
  /** Back to every employee, only when the viewer may see them. */
  backHref?: string;
  /** The employee header; off where the page already shows the employee, such as the profile. */
  showEmployee?: boolean;
}) {
  const [t, tRoles] = await Promise.all([getTranslations("employeeReport"), getTranslations("auth.roles")]);
  const { employee, figures } = data;

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const count = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
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

  const timeRows = data.buckets.map((bucket) => ({
    key: bucket.key,
    label: bucketLabel(bucket.key),
    count: bucket.paidCount + bucket.unpaidCount,
    paid: bucket.paid,
    unpaid: bucket.unpaid,
    gross: bucket.paid.plus(bucket.unpaid),
  }));
  const totals: Amounts = {
    count: figures.paidCount + figures.unpaidCount,
    paid: figures.paid,
    unpaid: figures.unpaid,
    gross: figures.paid.plus(figures.unpaid),
  };

  const serviceName = (service: { nameEn: string; nameAr: string }) => (locale === "ar" ? service.nameAr : service.nameEn);
  const services = breakdownRows(data.byService.rows, data.byService.details, serviceName, locale);

  const summary: { key: string; value: string; hint: string; icon: LucideIcon }[] = [
    {
      key: "paid",
      value: price.format(figures.paid.toNumber()),
      hint: t("hints.paid", { count: figures.paidCount }),
      icon: TrendingUp,
    },
    {
      key: "unpaid",
      value: price.format(figures.unpaid.toNumber()),
      hint: t("hints.unpaid", { count: figures.unpaidCount }),
      icon: Hourglass,
    },
    {
      key: "share",
      value: percent.format(figures.sharePercentage.toNumber() / 100),
      hint: t(figures.shareSource === "employee" ? "hints.shareEmployee" : "hints.shareSalon"),
      icon: Percent,
    },
    { key: "earnings", value: price.format(figures.earnings.toNumber()), hint: t("hints.earnings"), icon: Coins },
  ];
  if (showExpenses) {
    summary.push(
      {
        key: "expenses",
        value: price.format(figures.expenses.toNumber()),
        hint: t("hints.expenses", { count: figures.expenseCount }),
        icon: WalletMinimal,
      },
      { key: "payout", value: price.format(figures.payout.toNumber()), hint: t("hints.payout"), icon: Wallet },
    );
  }

  const amountCells = (row: Amounts, columns: readonly AmountColumn[]) =>
    columns.map((column) => (
      <td key={column} className={cn(numberCell, align(column))}>
        {column === "invoices" ? (
          count.format(row.count)
        ) : (
          <span dir="ltr">{price.format(row[column].toNumber())}</span>
        )}
      </td>
    ));

  const headings = (first: "period" | "service", columns: readonly AmountColumn[]) => (
    <thead>
      <tr className="border-b text-muted-foreground">
        <th scope="col" className="px-3 py-2.5 text-start font-medium">
          {t(`columns.${first}`)}
        </th>
        {columns.map((column) => (
          <th key={column} scope="col" className={cn("px-3 py-2.5 font-medium", align(column))}>
            {t(`columns.${column}`)}
          </th>
        ))}
      </tr>
    </thead>
  );

  const totalsRow = (columns: readonly AmountColumn[]) => (
    <tfoot>
      <tr className="border-t font-semibold">
        <th scope="row" className="px-3 py-3 text-start">
          {t("total")}
        </th>
        {amountCells(totals, columns)}
      </tr>
    </tfoot>
  );

  return (
    <>
      {showEmployee && (
        <section aria-labelledby="employee-performance-name" className={panelClass}>
          {backHref && (
            <Link
              href={backHref}
              className="mb-4 inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
              {t("back")}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar name={employee.name} image={employee.image} className="size-12" />
            <h2 id="employee-performance-name" dir="auto" className="min-w-0 flex-1 text-xl font-semibold break-words">
              {employee.name}
            </h2>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium">{tRoles(employee.role)}</span>
            {!employee.isActive && (
              <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                {t("inactive")}
              </span>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="employee-performance-figures" className="flex flex-col gap-4">
        <h2 id="employee-performance-figures" className="sr-only">
          {t("summary.title")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summary.map(({ key, value, hint, icon }) => (
            <StatCard key={key} title={t(`summary.${key}`)} value={value} hint={hint} icon={icon} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("estimatedNote")}</p>
      </section>

      <section aria-labelledby="employee-performance-trend" className={panelClass}>
        <h2 id="employee-performance-trend" className="text-lg font-semibold">
          {t("overTime.title")}
        </h2>
        {totals.count === 0 ? (
          <ReportEmptyState icon={BarChart3}>{t("overTime.empty")}</ReportEmptyState>
        ) : (
          <>
            <div className="mt-6">
              <RevenueChart
                data={timeRows.map((row) => ({ label: row.label, paid: row.paid.toNumber(), unpaid: row.unpaid.toNumber() }))}
                locale={locale}
                currency={data.currency}
                rtl={isLocale(locale) && getDirection(locale) === "rtl"}
                showExpenses={false}
                labels={{
                  period: t("columns.period"),
                  paid: t("columns.paid"),
                  unpaid: t("columns.unpaid"),
                  expenses: "",
                  empty: t("overTime.empty"),
                  caption: t("overTime.caption", { range: rangeLabel }),
                }}
              />
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-lg text-sm">
                <caption className="sr-only">{t("overTime.caption", { range: rangeLabel })}</caption>
                {headings("period", TIME_COLUMNS)}
                <tbody className="divide-y">
                  {timeRows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="px-3 py-3 text-start font-medium whitespace-nowrap">
                        {row.label}
                      </th>
                      {amountCells(row, TIME_COLUMNS)}
                    </tr>
                  ))}
                </tbody>
                {totalsRow(TIME_COLUMNS)}
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="employee-performance-services" className={panelClass}>
        <h2 id="employee-performance-services" className="text-lg font-semibold">
          {t("byService.title")}
        </h2>
        {services.length === 0 ? (
          <ReportEmptyState icon={Scissors}>{t("byService.empty")}</ReportEmptyState>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-md text-sm">
              {headings("service", SERVICE_COLUMNS)}
              <tbody className="divide-y">
                {services.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <span dir="auto" className="break-words">
                        {serviceName(row.detail)}
                      </span>
                      {!row.detail.isActive && (
                        <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          {t("inactive")}
                        </span>
                      )}
                    </th>
                    {amountCells(row, SERVICE_COLUMNS)}
                  </tr>
                ))}
              </tbody>
              {totalsRow(SERVICE_COLUMNS)}
            </table>
          </div>
        )}
      </section>
    </>
  );
}
