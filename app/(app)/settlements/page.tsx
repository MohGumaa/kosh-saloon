import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HandCoins } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { GenerateSettlementsForm } from "@/components/settlements/GenerateSettlementsForm";
import { SettlementStatusBadge } from "@/components/settlements/SettlementStatusBadge";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { salonMonth, shiftMonth } from "@/lib/earnings";
import { isOwnScope } from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";
import { canManageSettlements, isSettleableMonth, monthPeriod, parseSettlementMonth } from "@/lib/settlements";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settlements");
  return { title: t("title") };
}

const COLUMNS = [
  "employee",
  "revenue",
  "sharePercentage",
  "earnings",
  "expenses",
  "adjustments",
  "final",
  "status",
] as const;

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

const monthLinkClass = cn(linkClass, "flex items-center gap-1");

const numberCell = "px-3 py-3 tabular-nums whitespace-nowrap";

export default async function SettlementsPage({ searchParams }: PageProps<"/settlements">) {
  const { user, permissions } = await requirePermission("settlements.view");
  const ownOnly = isOwnScope(user);
  const canGenerate = canManageSettlements(permissions, user, "settlements.create");

  const currentMonth = salonMonth();
  const month = parseSettlementMonth((await searchParams).month, currentMonth);
  const { periodStart } = monthPeriod(month);

  const [t, locale, { currency }, settlements] = await Promise.all([
    getTranslations("settlements"),
    getLocale(),
    getSalonSettings(),
    db.employeeSettlement.findMany({
      // Staff only ever see their own settlement.
      where: { periodStart, ...(ownOnly && { employeeId: user.id }) },
      orderBy: [{ employee: { name: "asc" } }, { id: "asc" }],
      select: {
        id: true,
        totalRevenue: true,
        sharePercentage: true,
        employeeShare: true,
        totalExpenses: true,
        totalAdjustments: true,
        finalAmount: true,
        status: true,
        employee: { select: { name: true } },
      },
    }),
  ]);

  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  // The first of the month at UTC midnight, formatted in UTC, names the same month for every viewer.
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    periodStart,
  );
  const monthHref = (target: string) => `/settlements?month=${target}`;
  const next = shiftMonth(month, 1);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* min-w-0 lets the card shrink below the table, so the table scrolls instead of widening the page. */}
      <section className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
        <nav aria-label={t("month")} className="flex items-center justify-between gap-4 text-sm">
          <Link href={monthHref(shiftMonth(month, -1))} className={monthLinkClass}>
            <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
            {t("previous")}
          </Link>
          <h2 className="text-base font-semibold">{monthName}</h2>
          {isSettleableMonth(next, currentMonth) ? (
            <Link href={monthHref(next)} className={monthLinkClass}>
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

        {settlements.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t pt-8 pb-4 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <HandCoins aria-hidden className="size-5" />
            </span>
            <h3 className="text-lg font-semibold">{t("empty.title")}</h3>
            <p className="text-sm text-muted-foreground">{t(canGenerate ? "empty.create" : "empty.view")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-4xl text-sm">
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
                {settlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <Link href={`/settlements/${settlement.id}`} className={linkClass}>
                        <span dir="auto" className="break-words">
                          {settlement.employee.name}
                        </span>
                      </Link>
                    </th>
                    <td className={numberCell}>
                      <span dir="ltr">{price.format(settlement.totalRevenue.toNumber())}</span>
                    </td>
                    <td className={numberCell}>
                      <span dir="ltr">{percent.format(settlement.sharePercentage.dividedBy(100).toNumber())}</span>
                    </td>
                    {[settlement.employeeShare, settlement.totalExpenses, settlement.totalAdjustments].map((amount, index) => (
                      <td key={index} className={numberCell}>
                        <span dir="ltr">{price.format(amount.toNumber())}</span>
                      </td>
                    ))}
                    <td className="px-3 py-3 font-semibold tabular-nums whitespace-nowrap">
                      <span dir="ltr" className={cn(settlement.finalAmount.isNegative() && "text-destructive")}>
                        {price.format(settlement.finalAmount.toNumber())}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <SettlementStatusBadge status={settlement.status} label={t(`statuses.${settlement.status}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canGenerate && (
          <div className="border-t pt-5">
            <GenerateSettlementsForm month={month} />
          </div>
        )}
      </section>
    </div>
  );
}
