import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CircleCheck, Clock, HandCoins, ListChecks, Users, Wallet, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@/generated/prisma/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { ReportEmptyState } from "@/components/reports/ReportEmptyState";
import { SettlementReportControls } from "@/components/reports/SettlementReportControls";
import { SettlementStatusBadge } from "@/components/settlements/SettlementStatusBadge";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { salonMonth, shiftMonth } from "@/lib/earnings";
import { dateValue } from "@/lib/expenses";
import { isOwnScope } from "@/lib/invoices";
import { nameLabels } from "@/lib/names";
import { parseSettlementReport, settlementReportScope, type SettlementSums } from "@/lib/reports";
import { loadSettlementReport } from "@/lib/reports-data";
import type { SettlementStatusValue } from "@/lib/settlements";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settlementReport");
  return { title: t("title") };
}

// min-w-0 lets the panel shrink below its table, so the table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const numberCell = "px-3 py-3 text-end tabular-nums whitespace-nowrap";

const headCell = "px-3 py-2.5 font-medium";

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

/** The money columns every table shares, in order. */
const SUM_COLUMNS = ["revenue", "earnings", "expenses", "adjustments", "final"] as const;

export default async function SettlementReportPage({ searchParams }: PageProps<"/reports/settlements">) {
  const { user } = await requireSession();
  const permissions = await getPermissions(user);
  const scope = settlementReportScope(user, permissions);
  if (!scope) {
    // The sidebar shows the report to anyone with settlements.view; without reports.view they get the list.
    redirect(!isOwnScope(user) && permissions.has("settlements.view") ? "/settlements" : "/forbidden");
  }

  const latest = shiftMonth(salonMonth(), -1);
  const range = parseSettlementReport(await searchParams, latest);
  const locale = await getLocale();
  const [data, t, tSettlements] = await Promise.all([
    loadSettlementReport(range, scope, user.id, locale),
    getTranslations("settlementReport"),
    getTranslations("settlements"),
  ]);

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const count = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  // The first of the month at UTC midnight, formatted in UTC, names the same month for every viewer.
  const months = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const monthStart = (month: string) => dateValue(`${month}-01`);
  const rangeLabel =
    range.from === range.to
      ? months.format(monthStart(range.from))
      : months.formatRange(monthStart(range.from), monthStart(range.to));

  const money = (amount: Prisma.Decimal, strong = false) => (
    <span dir="ltr" className={cn(strong && "font-semibold", amount.isNegative() && "text-destructive")}>
      {price.format(amount.toNumber())}
    </span>
  );
  const sumCells = (sums: SettlementSums, paid: boolean) => (
    <>
      {SUM_COLUMNS.map((column) => (
        <td key={column} className={numberCell}>
          {money(sums[column], column === "final")}
        </td>
      ))}
      {paid && <td className={numberCell}>{money(sums.paid)}</td>}
    </>
  );
  const sumHeads = (paid: boolean) => (
    <>
      {SUM_COLUMNS.map((column) => (
        <th key={column} scope="col" className={cn(headCell, "text-end")}>
          {tSettlements(`columns.${column}`)}
        </th>
      ))}
      {paid && (
        <th scope="col" className={cn(headCell, "text-end")}>
          {t("columns.paid")}
        </th>
      )}
    </>
  );

  const hint = (sums: SettlementSums) => t("hints.settlements", { count: sums.count });
  const statusSums = (status: SettlementStatusValue) => data.byStatus.find((row) => row.status === status)!;
  const cards: { key: "final" | "paid" | "awaitingPayment" | "awaitingApproval"; sums: SettlementSums; icon: LucideIcon }[] = [
    { key: "final", sums: data.total, icon: HandCoins },
    { key: "paid", sums: statusSums("PAID"), icon: CircleCheck },
    { key: "awaitingPayment", sums: statusSums("APPROVED"), icon: Wallet },
    { key: "awaitingApproval", sums: data.awaitingApproval, icon: Clock },
  ];

  const employeeLabel = nameLabels(data.byEmployee.map((row) => row.employee), locale);
  const share = (value: Prisma.Decimal) => percent.format(value.dividedBy(100).toNumber());
  const shareLabel = (min: Prisma.Decimal, max: Prisma.Decimal) =>
    min.equals(max) ? share(min) : `${share(min)} – ${share(max)}`;

  const panel = (id: "byStatus" | "byMonth" | "byEmployee", icon: LucideIcon, empty: boolean, table: ReactNode) => (
    <section aria-labelledby={`settlements-${id}`} className={panelClass}>
      <h2 id={`settlements-${id}`} className="text-lg font-semibold">
        {t(`${id}.title`)}
      </h2>
      {empty ? <ReportEmptyState icon={icon}>{t(`${id}.empty`)}</ReportEmptyState> : <div className="mt-4 overflow-x-auto">{table}</div>}
    </section>
  );

  const totalRow = (columns: number, paid: boolean) => (
    <tfoot>
      <tr className="border-t font-semibold">
        <th scope="row" className="px-3 py-3 text-start">
          {t("total")}
        </th>
        <td className={numberCell}>{count.format(data.total.count)}</td>
        {Array.from({ length: columns }, (_, index) => (
          <td key={index} />
        ))}
        {sumCells(data.total, paid)}
      </tr>
    </tfoot>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Link href="/settlements" className={cn(linkClass, "text-sm")}>
          {t("openSettlements")}
        </Link>
      </div>

      <SettlementReportControls range={range} latest={latest} firstMonth={data.firstMonth} />

      <section aria-labelledby="settlements-period" className="flex flex-col gap-4">
        <h2 id="settlements-period" className="text-lg font-semibold">
          {range.period === "year" ? (
            <span dir="ltr">{latest.slice(0, 4)}</span>
          ) : (
            t(`periods.${range.period}`)
          )}
          <span className="ms-2 text-sm font-normal text-muted-foreground">{rangeLabel}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard
              key={card.key}
              title={t(`summary.${card.key}`)}
              value={price.format(card.sums.final.toNumber())}
              hint={hint(card.sums)}
              icon={card.icon}
            />
          ))}
        </div>
      </section>

      {panel(
        "byStatus",
        ListChecks,
        data.total.count === 0,
        <table aria-labelledby="settlements-byStatus" className="w-full min-w-3xl text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className={cn(headCell, "text-start")}>
                {tSettlements("columns.status")}
              </th>
              <th scope="col" className={cn(headCell, "text-end")}>
                {t("columns.settlements")}
              </th>
              {sumHeads(false)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.byStatus.map((row) => (
              <tr key={row.status}>
                <th scope="row" className="px-3 py-3 text-start font-medium">
                  <SettlementStatusBadge status={row.status} label={tSettlements(`statuses.${row.status}`)} />
                </th>
                <td className={numberCell}>{count.format(row.count)}</td>
                {sumCells(row, false)}
              </tr>
            ))}
          </tbody>
          {totalRow(0, false)}
        </table>,
      )}

      {panel(
        "byMonth",
        CalendarDays,
        data.byMonth.length === 0,
        <table aria-labelledby="settlements-byMonth" className="w-full min-w-4xl text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className={cn(headCell, "text-start")}>
                {t("columns.month")}
              </th>
              <th scope="col" className={cn(headCell, "text-end")}>
                {t("columns.settlements")}
              </th>
              {sumHeads(true)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.byMonth.map((row) => (
              <tr key={row.month}>
                <th scope="row" className="px-3 py-3 text-start font-medium whitespace-nowrap">
                  <Link href={`/settlements?month=${row.month}`} className={linkClass}>
                    {months.format(monthStart(row.month))}
                  </Link>
                </th>
                <td className={numberCell}>{count.format(row.count)}</td>
                {sumCells(row, true)}
              </tr>
            ))}
          </tbody>
          {totalRow(0, true)}
        </table>,
      )}

      {scope === "all" &&
        panel(
          "byEmployee",
          Users,
          data.byEmployee.length === 0,
          <table aria-labelledby="settlements-byEmployee" className="w-full min-w-5xl text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className={cn(headCell, "text-start")}>
                  {tSettlements("columns.employee")}
                </th>
                <th scope="col" className={cn(headCell, "text-end")}>
                  {t("columns.months")}
                </th>
                <th scope="col" className={cn(headCell, "text-end")}>
                  {tSettlements("columns.sharePercentage")}
                </th>
                {sumHeads(true)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byEmployee.map((row) => {
                const label = employeeLabel.get(row.employee.id) ?? row.employee.name;
                return (
                  <tr key={row.employee.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={row.employee.name} image={row.employee.image} className="size-8 text-xs" />
                        <span className="min-w-0">
                          <span
                            dir="auto"
                            className="break-words"
                            title={label === row.employee.name ? undefined : row.employee.name}
                          >
                            {label}
                          </span>
                          {!row.employee.isActive && (
                            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                              {t("inactive")}
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    <td className={numberCell}>{count.format(row.count)}</td>
                    <td className={numberCell}>
                      <span dir="ltr">{shareLabel(row.minShare, row.maxShare)}</span>
                    </td>
                    {sumCells(row, true)}
                  </tr>
                );
              })}
            </tbody>
            {totalRow(1, true)}
          </table>,
        )}
    </div>
  );
}
