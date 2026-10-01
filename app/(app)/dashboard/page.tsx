import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileText, Hourglass, PieChart, Receipt, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

// min-w-0 lets a grid cell shrink below its content, so the invoices table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const STATS: { key: "revenue" | "invoices" | "pending" | "expenses"; icon: LucideIcon }[] = [
  { key: "revenue", icon: TrendingUp },
  { key: "invoices", icon: FileText },
  { key: "pending", icon: Hourglass },
  { key: "expenses", icon: Wallet },
];

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

// Every widget shows an empty state until feature 14 (admin dashboard) supplies real figures.
export default async function DashboardPage() {
  const { user } = await requireSession();
  const [t, tRoles, format, account] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("auth.roles"),
    getFormatter(),
    db.user.findUnique({ where: { id: user.id }, select: { username: true, lastLoginAt: true } }),
  ]);
  const months = Array.from({ length: 12 }, (_, month) =>
    format.dateTime(new Date(Date.UTC(2026, month, 1)), { month: "short", timeZone: "UTC" }),
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className={cn(panelClass, "relative overflow-hidden")}>
        <div aria-hidden className="absolute -end-16 -top-20 size-56 rounded-full bg-primary-soft blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <UserAvatar name={user.name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              <LocalDateTime iso={new Date().toISOString()} dateStyle="full" />
            </p>
            <h1 className="text-2xl font-semibold break-words lg:text-3xl">{t("welcome", { name: user.name })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("welcomeBody")}</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium">{tRoles(user.role)}</span>
        </div>
      </section>

      <section aria-label={t("title")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ key, icon: Icon }) => (
          <div key={key} className={panelClass}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">{t(`stats.${key}`)}</h2>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon aria-hidden className="size-5" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold">{t("noValue")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("noData")}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className={cn(panelClass, "xl:col-span-2")}>
          <h2 className="text-lg font-semibold">{t("revenueChart.title")}</h2>
          <div className="relative mt-6 flex h-56 flex-col justify-between">
            {Array.from({ length: 5 }, (_, line) => (
              <div key={line} aria-hidden className="border-t border-dashed" />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl bg-card px-4 py-3">
                <EmptyState icon={BarChart3}>{t("revenueChart.empty")}</EmptyState>
              </div>
            </div>
          </div>
          <div aria-hidden className="mt-3 hidden justify-between text-xs text-muted-foreground sm:flex">
            {months.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <h2 className="text-lg font-semibold">{t("account.title")}</h2>
          <div className="mt-5 flex items-center gap-3">
            <UserAvatar name={user.name} className="size-12 text-base" />
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

      <div className="grid gap-6 xl:grid-cols-3">
        <section className={cn(panelClass, "xl:col-span-2")}>
          <h2 className="text-lg font-semibold">{t("latestInvoices.title")}</h2>
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
              <tbody>
                <tr>
                  <td colSpan={INVOICE_COLUMNS.length} className="px-3 py-12">
                    <EmptyState icon={Receipt}>{t("latestInvoices.empty")}</EmptyState>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={panelClass}>
          <h2 className="text-lg font-semibold">{t("topServices.title")}</h2>
          <div className="mt-6 flex flex-col items-center gap-6">
            <div
              aria-hidden
              className="flex size-36 items-center justify-center rounded-full border-[14px] border-chart-muted text-2xl font-semibold"
            >
              {t("noValue")}
            </div>
            <EmptyState icon={PieChart}>{t("topServices.empty")}</EmptyState>
          </div>
        </section>
      </div>
    </div>
  );
}
