/**
 * The revenue report queries. `loadRevenueReport` runs only after `canViewRevenueReport`;
 * the by-employee queries run only when `revenueSections` allows them.
 */
import { Prisma } from "@/generated/prisma/client";
import { bucketInvoices, chartBuckets } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { SALON_TIME_ZONE, salonDayRange } from "@/lib/invoices";
import type { GroupedRevenue, RevenueReportRange, RevenueSections } from "@/lib/reports";
import { getSalonSettings } from "@/lib/settings";

const STATUSES: ("PAID" | "UNPAID")[] = ["PAID", "UNPAID"];

export async function loadRevenueReport(
  range: Pick<RevenueReportRange, "from" | "to" | "group">,
  sections: RevenueSections,
  timeZone: string = SALON_TIME_ZONE,
) {
  const where = { status: { in: STATUSES }, createdAt: salonDayRange(range.from, range.to, timeZone) };

  const [settings, invoices, byService, byEmployee] = await Promise.all([
    getSalonSettings(),
    db.invoice.findMany({ where, select: { createdAt: true, amount: true, status: true } }),
    db.invoice.groupBy({ by: ["serviceId", "status"], where, _sum: { amount: true }, _count: { _all: true } }),
    sections.byEmployee
      ? db.invoice.groupBy({ by: ["employeeId", "status"], where, _sum: { amount: true }, _count: { _all: true } })
      : null,
  ]);

  const [services, employees] = await Promise.all([
    byService.length === 0
      ? []
      : db.service.findMany({
          where: { id: { in: [...new Set(byService.map((row) => row.serviceId))] } },
          select: { id: true, nameEn: true, nameAr: true, isActive: true },
        }),
    !byEmployee || byEmployee.length === 0
      ? []
      : db.user.findMany({
          where: { id: { in: [...new Set(byEmployee.map((row) => row.employeeId))] } },
          select: { id: true, name: true, isActive: true },
        }),
  ]);

  const buckets = bucketInvoices(invoices, chartBuckets(range.from, range.to, range.group), range.group, timeZone);
  const totals = buckets.reduce(
    (sum, bucket) => ({
      paid: sum.paid.plus(bucket.paid),
      unpaid: sum.unpaid.plus(bucket.unpaid),
      count: sum.count + bucket.paidCount + bucket.unpaidCount,
    }),
    { paid: new Prisma.Decimal(0), unpaid: new Prisma.Decimal(0), count: 0 },
  );

  return {
    currency: settings.currency,
    totals: { ...totals, gross: totals.paid.plus(totals.unpaid) },
    buckets,
    byService: {
      rows: byService.map((row): GroupedRevenue => ({
        id: row.serviceId,
        status: row.status,
        amount: row._sum.amount,
        count: row._count._all,
      })),
      details: new Map(services.map((service) => [service.id, service])),
    },
    byEmployee: byEmployee && {
      rows: byEmployee.map((row): GroupedRevenue => ({
        id: row.employeeId,
        status: row.status,
        amount: row._sum.amount,
        count: row._count._all,
      })),
      details: new Map(employees.map((employee) => [employee.id, employee])),
    },
  };
}

export type RevenueReportData = Awaited<ReturnType<typeof loadRevenueReport>>;
