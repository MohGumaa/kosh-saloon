import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, FileText, Hourglass, Scissors, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { RevenueReportControls } from "@/components/reports/RevenueReportControls";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { addDays } from "@/lib/dashboard";
import { dateValue, salonToday } from "@/lib/expenses";
import { employeeLabels } from "@/lib/names";
import { breakdownRows, canViewRevenueReport, parseRevenueReport, revenueSections, type BreakdownRow } from "@/lib/reports";
import { loadRevenueReport } from "@/lib/reports-data";
import { getDirection, isLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("revenueReport");
  return { title: t("title") };
}

// min-w-0 lets a grid cell shrink below its content, so a wide table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const numberCell = "px-3 py-3 tabular-nums whitespace-nowrap";

const TIME_COLUMNS = ["invoices", "paid", "unpaid", "gross"] as const;

/** The service and employee tables leave out unpaid; their gross still includes it. */
const BREAKDOWN_COLUMNS = ["invoices", "paid", "gross"] as const;

type AmountColumn = (typeof TIME_COLUMNS)[number];

// The invoice count is centered; money lines up at the end of its column.
const align = (column: AmountColumn) => (column === "invoices" ? "text-center" : "text-end");

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

interface Amounts {
  count: number;
  paid: { toNumber(): number };
  unpaid: { toNumber(): number };
  gross: { toNumber(): number };
}

export default async function RevenueReportPage({ searchParams }: PageProps<"/reports/revenue">) {
  const { user } = await requireSession();
  const permissions = await getPermissions(user);
  if (!canViewRevenueReport(user, permissions)) redirect("/forbidden");

  const today = salonToday();
  const range = parseRevenueReport(await searchParams, today);
  const sections = revenueSections(permissions);
  const [data, t, locale] = await Promise.all([
    loadRevenueReport(range, sections),
    getTranslations("revenueReport"),
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

  const timeRows = data.buckets.map((bucket) => ({
    key: bucket.key,
    label: bucketLabel(bucket.key),
    count: bucket.paidCount + bucket.unpaidCount,
    paid: bucket.paid,
    unpaid: bucket.unpaid,
    gross: bucket.paid.plus(bucket.unpaid),
  }));
  const empty = data.totals.count === 0;

  const serviceName = (service: { nameEn: string; nameAr: string }) => (locale === "ar" ? service.nameAr : service.nameEn);
  const services = breakdownRows(data.byService.rows, data.byService.details, serviceName, locale);
  const employees = data.byEmployee
    ? breakdownRows(data.byEmployee.rows, data.byEmployee.details, (employee) => employee.name, locale)
    : null;
  const labels = employees ? employeeLabels(employees.map((row) => row.detail.name), locale) : [];
  const employeeLabel = new Map(employees?.map((row, i) => [row.id, labels[i]]));

  const summary: { key: string; value: string; icon: LucideIcon }[] = [
    { key: "gross", value: price.format(data.totals.gross.toNumber()), icon: Wallet },
    { key: "paid", value: price.format(data.totals.paid.toNumber()), icon: TrendingUp },
    { key: "unpaid", value: price.format(data.totals.unpaid.toNumber()), icon: Hourglass },
    { key: "invoices", value: count.format(data.totals.count), icon: FileText },
  ];

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

  const headings = (first: "period" | "service" | "employee", columns: readonly AmountColumn[]) => (
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
        {amountCells(data.totals, columns)}
      </tr>
    </tfoot>
  );

  const breakdownTable = <T,>(
    id: string,
    rows: BreakdownRow<T>[],
    first: "service" | "employee",
    nameOf: (detail: T) => string,
    isActive: (detail: T) => boolean,
    icon: LucideIcon,
    imageOf?: (detail: T) => string | null,
    labelOf?: (row: BreakdownRow<T>) => string,
  ) => (
    <section aria-labelledby={id} className={panelClass}>
      <h2 id={id} className="text-lg font-semibold">
        {t(first === "service" ? "byService.title" : "byEmployee.title")}
      </h2>
      {rows.length === 0 ? (
        <EmptyState icon={icon}>{t(first === "service" ? "byService.empty" : "byEmployee.empty")}</EmptyState>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            {headings(first, BREAKDOWN_COLUMNS)}
            <tbody className="divide-y">
              {rows.map((row) => {
                const name = nameOf(row.detail);
                const label = labelOf?.(row) ?? name;
                return (
                  <tr key={row.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <div className="flex items-center gap-3">
                        {imageOf && <UserAvatar name={name} image={imageOf(row.detail)} className="size-8 text-xs" />}
                        <span className="min-w-0">
                          <span dir="auto" className="break-words" title={label === name ? undefined : name}>
                            {label}
                          </span>
                          {!isActive(row.detail) && (
                            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                              {t("inactive")}
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    {amountCells(row, BREAKDOWN_COLUMNS)}
                  </tr>
                );
              })}
            </tbody>
            {totalsRow(BREAKDOWN_COLUMNS)}
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

      <RevenueReportControls range={range} today={today} />

      <section aria-labelledby="revenue-period" className="flex flex-col gap-4">
        <h2 id="revenue-period" className="text-lg font-semibold">
          {t(`periods.${range.period}`)}
          <span className="ms-2 text-sm font-normal text-muted-foreground">{rangeLabel}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map(({ key, value, icon }) => (
            <StatCard key={key} title={t(`summary.${key}`)} value={value} hint={t(`hints.${key}`)} icon={icon} />
          ))}
        </div>
      </section>

      <section aria-labelledby="revenue-over-time" className={panelClass}>
        <h2 id="revenue-over-time" className="text-lg font-semibold">
          {t("overTime.title")}
        </h2>
        {empty ? (
          <EmptyState icon={BarChart3}>{t("overTime.empty")}</EmptyState>
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

      <div className={cn("grid gap-6", employees && "xl:grid-cols-2")}>
        {breakdownTable("revenue-by-service", services, "service", serviceName, (service) => service.isActive, Scissors)}
        {employees &&
          breakdownTable(
            "revenue-by-employee",
            employees,
            "employee",
            (employee) => employee.name,
            (employee) => employee.isActive,
            Users,
            (employee) => employee.image,
            (row) => employeeLabel.get(row.id) ?? row.detail.name,
          )}
      </div>
    </div>
  );
}
