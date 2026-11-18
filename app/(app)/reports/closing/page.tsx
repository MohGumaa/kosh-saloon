import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Receipt, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Prisma } from "@/generated/prisma/client";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { ClosingMonthSelect } from "@/components/reports/ClosingMonthSelect";
import { PrintButton } from "@/components/reports/PrintButton";
import { SettlementStatusBadge } from "@/components/settlements/SettlementStatusBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { salonMonth, shiftMonth } from "@/lib/earnings";
import { dateValue } from "@/lib/expenses";
import { SALON_TIME_ZONE } from "@/lib/invoices";
import { nameLabels } from "@/lib/names";
import { canViewClosingStatement } from "@/lib/reports";
import { loadClosingStatement } from "@/lib/reports-data";
import { parseSettlementMonth } from "@/lib/settlements";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("closingStatement");
  return { title: t("title") };
}

const numberCell = "px-3 py-2.5 text-end tabular-nums whitespace-nowrap";

const headCell = "px-3 py-2 text-xs font-medium";

const linkClass =
  "rounded-md font-medium text-primary-text underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring";

const markerClass = "ms-2 rounded-full px-2 py-0.5 text-xs font-normal whitespace-nowrap";

export default async function ClosingStatementPage({ searchParams }: PageProps<"/reports/closing">) {
  const { user } = await requireSession();
  if (!canViewClosingStatement(user, await getPermissions(user))) redirect("/forbidden");

  const current = salonMonth();
  const latest = shiftMonth(current, -1);
  const month = parseSettlementMonth((await searchParams).month, current);
  const locale = await getLocale();
  const [data, t, tSettlements, tExpenses] = await Promise.all([
    loadClosingStatement(month, locale),
    getTranslations("closingStatement"),
    getTranslations("settlements"),
    getTranslations("expenses"),
  ]);

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const count = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    dateValue(`${month}-01`),
  );
  const generatedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: SALON_TIME_ZONE,
  }).format(new Date());

  const money = (amount: Prisma.Decimal, strong = false) => (
    <span dir="ltr" className={cn(strong && "font-semibold", amount.isNegative() && "text-destructive")}>
      {price.format(amount.toNumber())}
    </span>
  );
  const dash = (
    <>
      <span aria-hidden>–</span>
      <span className="sr-only">{t("notApplicable")}</span>
    </>
  );
  const employeeLabel = nameLabels(
    data.employees.map((row) => row.employee),
    locale,
  );
  const settlementsHref = `/settlements?month=${month}`;

  const summary: { key: string; value: Prisma.Decimal; tone?: "net" }[] = [
    { key: "paidRevenue", value: data.paidRevenue },
    { key: "employeeEarnings", value: data.employeeEarnings },
    { key: "salonExpenses", value: data.salonExpenses },
    { key: "net", value: data.net, tone: "net" },
    { key: "stillToPay", value: data.stillToPay },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 print:max-w-none print:gap-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <PrintButton label={t("print")} />
      </div>

      <ClosingMonthSelect month={month} latest={latest} firstMonth={data.firstMonth} />

      {data.provisional && (
        <div
          role="status"
          className="flex gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm print:border-black print:bg-white"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning print:text-black" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("provisional.title")}</p>
            {data.unsettledCount > 0 && <p>{t("provisional.unsettled", { count: data.unsettledCount })}</p>}
            {data.outOfDateCount > 0 && <p>{t("provisional.outOfDate", { count: data.outOfDateCount })}</p>}
            <p className="print:hidden">
              <Link href={settlementsHref} className={linkClass}>
                {t("provisional.open")}
              </Link>
            </p>
          </div>
        </div>
      )}

      <article
        aria-labelledby="closing-title"
        className="min-w-0 rounded-2xl border bg-card p-6 text-card-foreground shadow-card sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-foreground pb-6">
          <div className="flex min-w-0 items-center gap-4">
            {data.salon.logo && (
              <Image
                src={data.salon.logo}
                alt={data.salon.name}
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-lg object-contain"
              />
            )}
            <div className="min-w-0">
              <p dir="auto" className="text-lg font-semibold break-words">
                {data.salon.name}
              </p>
              {data.salon.licenseNumber && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("license")} <span dir="auto">{data.salon.licenseNumber}</span>
                </p>
              )}
            </div>
          </div>
          <div className="text-end">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("sheetLabel")}</p>
            <h2 id="closing-title" className="mt-1 text-xl font-semibold">
              {monthName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("generated", { date: generatedAt })}</p>
          </div>
        </header>

        <section aria-labelledby="closing-revenue" className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 id="closing-revenue" className="font-semibold">
              {t("revenue.title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("revenue.invoices", { count: data.invoiceCount })}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{money(data.paidRevenue)}</p>
        </section>

        <section aria-labelledby="closing-employees" className="mt-8">
          <h3 id="closing-employees" className="font-semibold">
            {t("employees.title")}
          </h3>
          {data.employees.length === 0 ? (
            <EmptyState icon={Users} description={t("employees.empty")} headingLevel="h3" />
          ) : (
            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table aria-labelledby="closing-employees" className="w-full min-w-4xl text-sm print:min-w-0">
                <thead>
                  <tr className="border-b-2 border-foreground/70 text-muted-foreground">
                    <th scope="col" className={cn(headCell, "text-start")}>
                      {tSettlements("columns.employee")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {tSettlements("columns.revenue")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {tSettlements("columns.sharePercentage")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {t("columns.earned")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {t("columns.advances")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {tSettlements("columns.adjustments")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {tSettlements("columns.final")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {tSettlements("columns.status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.employees.map((row) => {
                    const label = employeeLabel.get(row.employee.id) ?? row.employee.name;
                    return (
                      <tr key={row.employee.id} className="break-inside-avoid">
                        <th scope="row" className="px-3 py-2.5 text-start font-medium">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={row.employee.name}
                              image={row.employee.image}
                              className="size-7 text-xs print:hidden"
                            />
                            <span className="min-w-0">
                              <span dir="auto" className="break-words">
                                {label}
                              </span>
                              {row.settled && row.outOfDate && (
                                <span className={cn(markerClass, "bg-warning-soft text-warning")}>
                                  {t("outOfDate")}
                                </span>
                              )}
                            </span>
                          </div>
                        </th>
                        <td className={numberCell}>{money(row.revenue)}</td>
                        {row.settled ? (
                          <>
                            <td className={numberCell}>
                              <span dir="ltr">{percent.format(row.sharePercentage.dividedBy(100).toNumber())}</span>
                            </td>
                            <td className={numberCell}>{money(row.earned)}</td>
                            <td className={numberCell}>{money(row.advances.negated())}</td>
                            <td className={numberCell}>{money(row.adjustments)}</td>
                            <td className={numberCell}>{money(row.final, true)}</td>
                            <td className="px-3 py-2.5 text-end">
                              <SettlementStatusBadge status={row.status} label={tSettlements(`statuses.${row.status}`)} />
                            </td>
                          </>
                        ) : (
                          <>
                            {Array.from({ length: 5 }, (_, index) => (
                              <td key={index} className={numberCell}>
                                {dash}
                              </td>
                            ))}
                            <td className="px-3 py-2.5 text-end">
                              <span className={cn(markerClass, "ms-0 bg-warning-soft font-medium text-warning")}>
                                {t("notSettled")}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/70 font-semibold">
                    <th scope="row" className="px-3 py-2.5 text-start">
                      {t("total")}
                    </th>
                    <td className={numberCell}>{money(data.employeeTotals.revenue)}</td>
                    <td />
                    <td className={numberCell}>{money(data.employeeTotals.earned)}</td>
                    <td className={numberCell}>{money(data.employeeTotals.advances.negated())}</td>
                    <td className={numberCell}>{money(data.employeeTotals.adjustments)}</td>
                    <td className={numberCell}>{money(data.employeeTotals.final, true)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("employees.note")}</p>
        </section>

        <section aria-labelledby="closing-expenses" className="mt-8">
          <h3 id="closing-expenses" className="font-semibold">
            {t("expenses.title")}
          </h3>
          {data.expenses.length === 0 ? (
            <EmptyState icon={Receipt} description={t("expenses.empty")} headingLevel="h3" />
          ) : (
            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table aria-labelledby="closing-expenses" className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/70 text-muted-foreground">
                    <th scope="col" className={cn(headCell, "text-start")}>
                      {t("columns.category")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {t("columns.entries")}
                    </th>
                    <th scope="col" className={cn(headCell, "text-end")}>
                      {t("columns.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.expenses.map((row) => (
                    <tr key={row.category} className="break-inside-avoid">
                      <th scope="row" className="px-3 py-2.5 text-start font-normal">
                        {tExpenses(`categories.${row.category}`)}
                      </th>
                      <td className={numberCell}>{count.format(row.count)}</td>
                      <td className={numberCell}>{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/70 font-semibold">
                    <th scope="row" className="px-3 py-2.5 text-start">
                      {t("total")}
                    </th>
                    <td />
                    <td className={numberCell}>{money(data.salonExpenses, true)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{t("expenses.ownerCostsNote")}</p>
        </section>

        <section aria-labelledby="closing-summary" className="mt-10">
          <h3 id="closing-summary" className="sr-only">
            {t("summary.title")}
          </h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
            {summary.map((item) => {
              const net = item.tone === "net";
              const negative = item.value.isNegative();
              return (
                <div
                  key={item.key}
                  className={cn(
                    "flex min-w-0 break-inside-avoid flex-col gap-1 rounded-xl border p-4",
                    net && (negative ? "border-2 border-destructive" : "border-2 border-success"),
                  )}
                >
                  <dt className="text-xs font-medium text-muted-foreground">
                    {t(`summary.${item.key}`)}
                    {net && data.provisional && (
                      <span className={cn(markerClass, "bg-warning-soft text-warning")}>{t("provisional.badge")}</span>
                    )}
                  </dt>
                  <dd
                    className={cn(
                      "text-xl font-semibold tabular-nums break-words",
                      net && (negative ? "text-destructive" : "text-success"),
                    )}
                  >
                    <span dir="ltr">{price.format(item.value.toNumber())}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("summary.formula")}</p>
        </section>
      </article>
    </div>
  );
}
