import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Coins,
  HandCoins,
  MinusCircle,
  Percent,
  PlusCircle,
  TrendingUp,
  UserCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { Detail, Panel } from "@/components/layout/Panel";
import { SettlementActionsForm } from "@/components/settlements/SettlementActionsForm";
import { SettlementStatusBadge } from "@/components/settlements/SettlementStatusBadge";
import { requirePermission } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { isOwnScope } from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";
import {
  SETTLEMENT_TRANSITIONS,
  canManageSettlements,
  canRunSettlementAction,
  monthOf,
  type SettlementAction,
} from "@/lib/settlements";
import { cn } from "@/lib/utils";

// The employee is not looked up for the title, so a title never reveals a settlement outside the viewer's scope.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settlements");
  return { title: t("detail.title") };
}

const FLOW: SettlementAction[] = ["recalculate", "calculate", "approve", "pay"];

export default async function SettlementPage({ params }: PageProps<"/settlements/[id]">) {
  const { user, permissions } = await requirePermission("settlements.view");
  const { id } = await params;
  const [t, locale, { currency }, settlement] = await Promise.all([
    getTranslations("settlements"),
    getLocale(),
    getSalonSettings(),
    db.employeeSettlement.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        totalRevenue: true,
        sharePercentage: true,
        employeeShare: true,
        totalExpenses: true,
        totalAdjustments: true,
        finalAmount: true,
        status: true,
        approvedAt: true,
        paidAt: true,
        employee: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    }),
  ]);
  // Outside a Staff user's own settlements reads the same as missing, so nothing is revealed.
  if (!settlement || (isOwnScope(user) && settlement.employeeId !== user.id)) notFound();

  const actions = FLOW.filter((action) => canRunSettlementAction(action, settlement.status, permissions, user));
  // Shown whenever the viewer could act on some settlement, so the form that made the
  // last change stays mounted to show its toast.
  const showActions = FLOW.some((action) =>
    canManageSettlements(permissions, user, SETTLEMENT_TRANSITIONS[action].permission),
  );

  const month = monthOf(settlement.periodStart);
  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  // The first of the month at UTC midnight, formatted in UTC, names the same month for every viewer.
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    settlement.periodStart,
  );
  const money = (amount: { toNumber(): number }) => (
    <span dir="ltr" className="tabular-nums">
      {price.format(amount.toNumber())}
    </span>
  );
  const negative = settlement.finalAmount.isNegative();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href={`/settlements?month=${month}`}
        className="flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold lg:text-3xl">
          <span dir="auto">{settlement.employee.name}</span>
          <span className="text-muted-foreground"> · {monthName}</span>
        </h1>
        <SettlementStatusBadge status={settlement.status} label={t(`statuses.${settlement.status}`)} />
      </div>

      {settlement.status === "PAID" && !showActions && (
        <p className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">{t("actions.paidNote")}</p>
      )}

      <Panel icon={HandCoins} title={t("detail.title")} description={t("detail.description")}>
        <dl className="-my-4 grid gap-x-8 sm:grid-cols-2">
          <Detail icon={UserRound} label={t("detail.employee")}>
            <span dir="auto">{settlement.employee.name}</span>
          </Detail>
          <Detail icon={CalendarDays} label={t("detail.period")}>
            {monthName}
          </Detail>
          <Detail icon={TrendingUp} label={t("columns.revenue")}>
            {money(settlement.totalRevenue)}
          </Detail>
          <Detail icon={Percent} label={t("columns.sharePercentage")}>
            <span dir="ltr" className="tabular-nums">
              {percent.format(settlement.sharePercentage.dividedBy(100).toNumber())}
            </span>
            <span className="block text-xs font-normal text-muted-foreground">{t("detail.shareNote")}</span>
          </Detail>
          <Detail icon={Coins} label={t("columns.earnings")}>
            {money(settlement.employeeShare)}
          </Detail>
          <Detail icon={MinusCircle} label={t("columns.expenses")}>
            {money(settlement.totalExpenses)}
          </Detail>
          <Detail icon={PlusCircle} label={t("columns.adjustments")}>
            {money(settlement.totalAdjustments)}
          </Detail>
          <Detail icon={Wallet} label={t("columns.final")}>
            <span dir="ltr" className={cn("text-base font-semibold tabular-nums", negative && "text-destructive")}>
              {price.format(settlement.finalAmount.toNumber())}
            </span>
            {negative && (
              <span className="block text-xs font-normal text-muted-foreground">{t("detail.negativeNote")}</span>
            )}
          </Detail>
          <Detail icon={CircleDollarSign} label={t("detail.status")}>
            {t(`statuses.${settlement.status}`)}
          </Detail>
          <Detail icon={UserCheck} label={t("detail.approvedBy")}>
            {settlement.approvedBy ? <span dir="auto">{settlement.approvedBy.name}</span> : t("detail.notYet")}
          </Detail>
          <Detail icon={BadgeCheck} label={t("detail.approvedAt")}>
            {settlement.approvedAt ? (
              <LocalDateTime iso={settlement.approvedAt.toISOString()} timeStyle="short" />
            ) : (
              t("detail.notYet")
            )}
          </Detail>
          <Detail icon={Banknote} label={t("detail.paidAt")}>
            {settlement.paidAt ? (
              <LocalDateTime iso={settlement.paidAt.toISOString()} timeStyle="short" />
            ) : (
              t("detail.notYet")
            )}
          </Detail>
        </dl>
      </Panel>

      {showActions && (
        <Panel icon={CircleDollarSign} title={t("actions.title")} description={t("actions.description")}>
          <SettlementActionsForm id={settlement.id} status={settlement.status} actions={actions} />
        </Panel>
      )}
    </div>
  );
}
