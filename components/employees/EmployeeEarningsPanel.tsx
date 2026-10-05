import Link from "next/link";
import { ChevronLeft, ChevronRight, Coins, Percent, TrendingUp, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Detail, Panel } from "@/components/layout/Panel";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  calculateEarnings,
  effectiveSharePercentage,
  paidRevenueWhere,
  parseMonth,
  salonMonth,
  shiftMonth,
} from "@/lib/earnings";
import { getSalonSettings } from "@/lib/settings";

const linkClass =
  "flex items-center gap-1 rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

interface EmployeeEarningsPanelProps {
  employeeId: string;
  /** The employee's own share percentage, or null for the salon default. */
  sharePercentage: Prisma.Decimal | null;
  /** The raw `month` URL value. */
  month: string | string[] | undefined;
}

/** One salon month of paid revenue and earnings, for a viewer the page has checked holds `reports.view_all_employees`. */
export async function EmployeeEarningsPanel({
  employeeId,
  sharePercentage,
  month: rawMonth,
}: EmployeeEarningsPanelProps) {
  const currentMonth = salonMonth();
  const month = parseMonth(rawMonth, currentMonth);

  const [t, locale, settings, revenue] = await Promise.all([
    getTranslations("employees.earnings"),
    getLocale(),
    getSalonSettings(),
    db.invoice.aggregate({ where: { employeeId, ...paidRevenueWhere(month) }, _sum: { amount: true } }),
  ]);

  const share = effectiveSharePercentage(sharePercentage, settings.employeeSharePercentage);
  const earnings = calculateEarnings({ paidRevenue: revenue._sum.amount ?? 0, sharePercentage: share.value });

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: settings.currency });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  // The first of the month at UTC midnight, formatted in UTC, names the same month for every viewer.
  const [year, monthNumber] = month.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
  const monthHref = (target: string) => `/employees/${employeeId}?month=${target}`;

  return (
    <Panel icon={Wallet} title={t("title")} description={t("description")}>
      <nav aria-label={t("month")} className="-mt-1 mb-4 flex items-center justify-between gap-4 text-sm">
        <Link href={monthHref(shiftMonth(month, -1))} className={linkClass}>
          <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("previous")}
        </Link>
        <h3 className="text-base font-semibold">{monthName}</h3>
        {month < currentMonth ? (
          <Link href={monthHref(shiftMonth(month, 1))} className={linkClass}>
            {t("next")}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </Link>
        ) : (
          <span aria-disabled="true" className="flex items-center gap-1 text-muted-foreground">
            {t("next")}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </span>
        )}
      </nav>
      <dl className="grid gap-x-8 border-t sm:grid-cols-3">
        <Detail icon={TrendingUp} label={t("paidRevenue")}>
          <span dir="ltr" className="tabular-nums">
            {price.format(earnings.paidRevenue.toNumber())}
          </span>
        </Detail>
        <Detail icon={Percent} label={t("sharePercentage")}>
          <span dir="ltr" className="tabular-nums">
            {percent.format(earnings.sharePercentage.dividedBy(100).toNumber())}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">{t(`source.${share.source}`)}</span>
        </Detail>
        <Detail icon={Coins} label={t("employeeShare")}>
          <span dir="ltr" className="tabular-nums">
            {price.format(earnings.employeeShare.toNumber())}
          </span>
        </Detail>
      </dl>
      {earnings.paidRevenue.isZero() && <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>}
    </Panel>
  );
}
