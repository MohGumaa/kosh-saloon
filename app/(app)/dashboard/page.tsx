import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  Calculator,
  FileText,
  HandCoins,
  Hourglass,
  Percent,
  PieChart,
  Receipt,
  Scissors,
  Sun,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { StatCard } from "@/components/dashboard/StatCard";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { averageBill, canViewSalonDashboard, dashboardSections, parseDashboardPeriod } from "@/lib/dashboard";
import { loadDashboard } from "@/lib/dashboard-data";
import { db } from "@/lib/db";
import { dateValue, salonToday } from "@/lib/expenses";
import { getDirection, isLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

// min-w-0 lets a grid cell shrink below its content, so the invoices table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

const INVOICE_COLUMNS = ["invoice", "employee", "date", "amount", "status"] as const;

function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { user } = await requireSession();
  const permissions = await getPermissions(user);
  const salonView = canViewSalonDashboard(user, permissions);

  const [t, tRoles, locale, account] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("auth.roles"),
    getLocale(),
    salonView ? null : db.user.findUnique({ where: { id: user.id }, select: { username: true, lastLoginAt: true } }),
  ]);

  const welcome = (
    <section className={cn(panelClass, "relative overflow-hidden")}>
      <div aria-hidden className="absolute -end-16 -top-20 size-56 rounded-full bg-primary-soft blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <UserAvatar name={user.name} image={user.image} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            <LocalDateTime iso={new Date().toISOString()} dateStyle="full" />
          </p>
          <h1 className="text-2xl font-semibold break-words lg:text-3xl">{t("welcome", { name: user.name })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(salonView ? "welcomeBody" : "personalBody")}</p>
        </div>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium">{tRoles(user.role)}</span>
      </div>
    </section>
  );

  if (!salonView) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {welcome}
        <section className={cn(panelClass, "max-w-md")}>
          <h2 className="text-lg font-semibold">{t("account.title")}</h2>
          <div className="mt-5 flex items-center gap-3">
            <UserAvatar name={user.name} image={user.image} className="size-12 text-base" />
            <div className="min-w-0">
              <div className="truncate font-medium">{user.name}</div>
              <div className="truncate text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t("account.username")}</dt>
              <dd className="truncate font-medium" dir="ltr">
                {account?.username}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t("account.role")}</dt>
              <dd className="font-medium">{tRoles(user.role)}</dd>
            </div>
            {account?.lastLoginAt && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("lastSignIn")}</dt>
                <dd className="font-medium">
                  <LocalDateTime iso={account.lastLoginAt.toISOString()} timeStyle="short" />
                </dd>
              </div>
            )}
          </dl>
          <Link href="/account" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6 h-10 w-full")}>
            {t("account.viewProfile")}
          </Link>
        </section>
      </div>
    );
  }

  const today = salonToday();
  const range = parseDashboardPeriod(await searchParams, today);
  const sections = dashboardSections(permissions);
  const [data, tInvoices] = await Promise.all([loadDashboard(permissions, range, today), getTranslations("invoices")]);

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  const count = new Intl.NumberFormat(locale);
  // Calendar days are stored as UTC midnight, so formatting in UTC names the same day for every viewer.
  const rangeLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).formatRange(
    dateValue(range.from),
    dateValue(range.to),
  );
  const bucketLabel =
    range.granularity === "day"
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })
      : new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const average = averageBill(data.period.billsTotal, data.period.bills);
  const serviceName = (service: { nameEn: string; nameAr: string }) => (locale === "ar" ? service.nameAr : service.nameEn);
  const topAmount = data.topServices[0]?.amount;

  const periodCards: { key: string; value: string; icon: LucideIcon }[] = [
    { key: "paidRevenue", value: price.format(data.period.paidRevenue.toNumber()), icon: TrendingUp },
    { key: "bills", value: count.format(data.period.bills), icon: FileText },
    { key: "pendingRevenue", value: price.format(data.period.pendingRevenue.toNumber()), icon: Hourglass },
    { key: "averageBill", value: average ? price.format(average.toNumber()) : t("noValue"), icon: Calculator },
    ...(data.period.salonExpenses
      ? [{ key: "salonExpenses", value: price.format(data.period.salonExpenses.toNumber()), icon: Wallet }]
      : []),
    ...(data.period.employeePayouts
      ? [{ key: "employeePayouts", value: price.format(data.period.employeePayouts.toNumber()), icon: HandCoins }]
      : []),
  ];

  const fixedCards: { key: string; value: string; icon: LucideIcon }[] = [
    { key: "todayRevenue", value: price.format(data.fixed.todayRevenue.toNumber()), icon: Sun },
    { key: "weekRevenue", value: price.format(data.fixed.weekRevenue.toNumber()), icon: CalendarRange },
    { key: "monthRevenue", value: price.format(data.fixed.monthRevenue.toNumber()), icon: CalendarDays },
    { key: "activeStaff", value: count.format(data.fixed.activeStaff), icon: Users },
    { key: "sharePercentage", value: percent.format(data.fixed.sharePercentage.dividedBy(100).toNumber()), icon: Percent },
    { key: "activeServices", value: count.format(data.fixed.activeServices), icon: Scissors },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {welcome}

      <PeriodSelector range={range} today={today} />

      <section aria-labelledby="dashboard-period" className="flex flex-col gap-4">
        <h2 id="dashboard-period" className="text-lg font-semibold">
          {t(`periods.${range.period}`)}
          <span className="ms-2 text-sm font-normal text-muted-foreground">{rangeLabel}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {periodCards.map(({ key, value, icon }) => (
            <StatCard key={key} title={t(`stats.${key}`)} value={value} hint={t(`hints.${key}`)} icon={icon} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className={cn(panelClass, "xl:col-span-2")}>
          <h2 className="text-lg font-semibold">{t("revenueChart.title")}</h2>
          <div className="mt-6">
            <RevenueChart
              data={data.chart.map((point) => ({
                label: bucketLabel.format(dateValue(point.key.length === 7 ? `${point.key}-01` : point.key)),
                paid: point.paid,
                unpaid: point.unpaid,
                expenses: point.expenses,
              }))}
              locale={locale}
              currency={data.currency}
              rtl={isLocale(locale) && getDirection(locale) === "rtl"}
              showExpenses={sections.expenses}
              labels={{
                period: t("revenueChart.period"),
                paid: t("revenueChart.paid"),
                unpaid: t("revenueChart.unpaid"),
                expenses: t("revenueChart.expenses"),
                empty: t("revenueChart.empty"),
                caption: t("revenueChart.caption", { range: rangeLabel }),
              }}
            />
          </div>
        </section>

        <section className={panelClass}>
          <h2 className="text-lg font-semibold">{t("topServices.title")}</h2>
          {data.topServices.length === 0 || !topAmount ? (
            <div className="py-10">
              <EmptyState icon={PieChart}>{t("topServices.empty")}</EmptyState>
            </div>
          ) : (
            <ol className="mt-5 flex flex-col gap-4">
              {data.topServices.map((service) => (
                <li key={service.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span dir="auto" className="min-w-0 font-medium break-words">
                      {serviceName(service)}
                    </span>
                    <span dir="ltr" className="shrink-0 tabular-nums">
                      {price.format(service.amount.toNumber())}
                    </span>
                  </div>
                  <div aria-hidden className="h-2 rounded-full bg-chart-muted">
                    <div
                      className="h-2 rounded-full bg-chart-1"
                      style={{ width: `${service.amount.dividedBy(topAmount).times(100).toNumber()}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="dashboard-overview" className="flex flex-col gap-4">
        <h2 id="dashboard-overview" className="text-lg font-semibold">
          {t("sections.overview")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fixedCards.map(({ key, value, icon }) => (
            <StatCard key={key} title={t(`stats.${key}`)} value={value} hint={t(`hints.${key}`)} icon={icon} />
          ))}
        </div>
      </section>

      {data.latestInvoices && (
        <section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("latestInvoices.title")}</h2>
            <Link href="/transactions" className={cn(linkClass, "text-sm")}>
              {t("latestInvoices.viewAll")}
            </Link>
          </div>
          {data.latestInvoices.length === 0 ? (
            <div className="py-12">
              <EmptyState icon={Receipt}>{t("latestInvoices.empty")}</EmptyState>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-md text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    {INVOICE_COLUMNS.map((column) => (
                      <th key={column} scope="col" className="px-3 py-2.5 text-start font-medium">
                        {t(`latestInvoices.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.latestInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <th scope="row" className="px-3 py-3 text-start font-medium whitespace-nowrap">
                        <Link href={`/transactions/${invoice.id}`} className={linkClass} dir="ltr">
                          {invoice.invoiceNumber}
                        </Link>
                      </th>
                      <td className="px-3 py-3">
                        <span dir="auto" className="break-words">
                          {invoice.employee.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <LocalDateTime iso={invoice.createdAt.toISOString()} timeStyle="short" />
                      </td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span dir="ltr" className={cn(invoice.status === "CANCELLED" && "line-through")}>
                          {price.format(invoice.amount.toNumber())}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} label={tInvoices(`statuses.${invoice.status}`)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
