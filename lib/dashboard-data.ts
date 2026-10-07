/**
 * The admin dashboard's queries. Run only after `canViewSalonDashboard`; each gated
 * widget's query runs only when `dashboardSections` allows it.
 */
import { Prisma } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import {
  bucketExpenses,
  bucketInvoices,
  chartBuckets,
  dashboardSections,
  presetRange,
  type DashboardRange,
} from "@/lib/dashboard";
import { db } from "@/lib/db";
import { dateValue } from "@/lib/expenses";
import { SALON_TIME_ZONE, salonDayRange } from "@/lib/invoices";
import { getSalonSettings } from "@/lib/settings";

const TOP_SERVICES = 5;
const LATEST_INVOICES = 5;

const zero = () => new Prisma.Decimal(0);

async function paidRevenue(from: string, to: string, timeZone: string): Promise<Prisma.Decimal> {
  const { _sum } = await db.invoice.aggregate({
    where: { status: "PAID", createdAt: salonDayRange(from, to, timeZone) },
    _sum: { amount: true },
  });
  return _sum.amount ?? zero();
}

export async function loadDashboard(
  permissions: ReadonlySet<PermissionKey>,
  range: Pick<DashboardRange, "from" | "to" | "granularity">,
  today: string,
  timeZone: string = SALON_TIME_ZONE,
) {
  const sections = dashboardSections(permissions);
  const createdAt = salonDayRange(range.from, range.to, timeZone);
  const expenseDate = { gte: dateValue(range.from), lte: dateValue(range.to) };
  const fixed = (period: "today" | "week" | "month") => {
    const { from, to } = presetRange(period, today);
    return paidRevenue(from, to, timeZone);
  };

  const [
    byStatus,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    activeStaff,
    activeServices,
    settings,
    expenses,
    payouts,
    chartInvoices,
    chartExpenses,
    topServiceTotals,
    latestInvoices,
  ] = await Promise.all([
    db.invoice.groupBy({
      by: ["status"],
      where: { status: { in: ["PAID", "UNPAID"] }, createdAt },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    fixed("today"),
    fixed("week"),
    fixed("month"),
    db.user.count({ where: { isActive: true } }),
    db.service.count({ where: { isActive: true } }),
    getSalonSettings(),
    sections.expenses
      ? db.salonExpense.aggregate({ where: { date: expenseDate }, _sum: { amount: true } })
      : null,
    sections.payouts
      ? db.employeeSettlement.aggregate({
          where: { status: "PAID", paidAt: createdAt },
          _sum: { finalAmount: true },
        })
      : null,
    db.invoice.findMany({
      where: { status: { in: ["PAID", "UNPAID"] }, createdAt },
      select: { createdAt: true, amount: true, status: true },
    }),
    sections.expenses ? db.salonExpense.findMany({ where: { date: expenseDate }, select: { date: true, amount: true } }) : [],
    db.invoice.groupBy({
      by: ["serviceId"],
      where: { status: "PAID", createdAt },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: TOP_SERVICES,
    }),
    sections.latestInvoices
      ? db.invoice.findMany({
          // The id breaks ties, matching the invoice list order.
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: LATEST_INVOICES,
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            createdAt: true,
            employee: { select: { name: true } },
          },
        })
      : null,
  ]);

  const paid = byStatus.find((row) => row.status === "PAID");
  const unpaid = byStatus.find((row) => row.status === "UNPAID");
  const paidSum = paid?._sum.amount ?? zero();
  const unpaidSum = unpaid?._sum.amount ?? zero();

  const keys = chartBuckets(range.from, range.to, range.granularity);
  const invoiceBuckets = bucketInvoices(chartInvoices, keys, range.granularity, timeZone);
  const expenseBuckets = sections.expenses ? bucketExpenses(chartExpenses, keys, range.granularity) : null;

  const serviceNames =
    topServiceTotals.length === 0
      ? []
      : await db.service.findMany({
          where: { id: { in: topServiceTotals.map((row) => row.serviceId) } },
          select: { id: true, nameEn: true, nameAr: true },
        });
  const topServices = topServiceTotals.flatMap((row) => {
    const service = serviceNames.find((candidate) => candidate.id === row.serviceId);
    return service ? [{ ...service, amount: row._sum.amount ?? zero() }] : [];
  });

  return {
    period: {
      paidRevenue: paidSum,
      bills: (paid?._count._all ?? 0) + (unpaid?._count._all ?? 0),
      billsTotal: paidSum.plus(unpaidSum),
      pendingRevenue: unpaidSum,
      salonExpenses: expenses ? (expenses._sum.amount ?? zero()) : null,
      employeePayouts: payouts ? (payouts._sum.finalAmount ?? zero()) : null,
    },
    fixed: {
      todayRevenue,
      weekRevenue,
      monthRevenue,
      activeStaff,
      activeServices,
      sharePercentage: settings.employeeSharePercentage,
    },
    currency: settings.currency,
    chart: invoiceBuckets.map((bucket, index) => ({
      key: bucket.key,
      paid: bucket.paid.toNumber(),
      unpaid: bucket.unpaid.toNumber(),
      expenses: expenseBuckets ? expenseBuckets[index].toNumber() : undefined,
    })),
    topServices,
    latestInvoices,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
