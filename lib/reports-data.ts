/**
 * The report queries. Each loader runs only after its page's `canView…Report` check; a
 * section's queries run only when its `…Sections` flag allows them.
 */
import { Prisma } from "@/generated/prisma/client";
import { bucketExpenses, bucketInvoices, chartBuckets } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { dateValue } from "@/lib/expenses";
import { SALON_TIME_ZONE, salonDayRange } from "@/lib/invoices";
import {
  employeePerformanceRows,
  performanceFigures,
  type EmployeeReportSections,
  type ExpenseSections,
  type GroupedExpense,
  type GroupedRevenue,
  type RevenueReportRange,
  type RevenueSections,
} from "@/lib/reports";
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
          select: { id: true, name: true, image: true, isActive: true },
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

/**
 * The expense report queries, by each entry's calendar `date`. Runs only after
 * `canViewExpenseReport`; each section's queries run only when `expenseSections` allows them.
 */
export async function loadExpenseReport(
  range: Pick<RevenueReportRange, "from" | "to" | "group">,
  sections: ExpenseSections,
) {
  const where = { date: { gte: dateValue(range.from), lte: dateValue(range.to) } };
  const grouped = { _sum: { amount: true }, _count: { _all: true } } as const;

  const [settings, salonRows, salonByCategory, employeeRows, employeeByCategory, byEmployee] = await Promise.all([
    getSalonSettings(),
    sections.salon ? db.salonExpense.findMany({ where, select: { date: true, amount: true } }) : null,
    sections.salon ? db.salonExpense.groupBy({ by: ["category"], where, ...grouped }) : null,
    sections.employee ? db.employeeExpense.findMany({ where, select: { date: true, amount: true } }) : null,
    sections.employee ? db.employeeExpense.groupBy({ by: ["category"], where, ...grouped }) : null,
    sections.byEmployee ? db.employeeExpense.groupBy({ by: ["employeeId"], where, ...grouped }) : null,
  ]);

  const employees =
    !byEmployee || byEmployee.length === 0
      ? []
      : await db.user.findMany({
          where: { id: { in: byEmployee.map((row) => row.employeeId) } },
          select: { id: true, name: true, image: true, isActive: true },
        });

  const keys = chartBuckets(range.from, range.to, range.group);
  const section = (
    rows: { date: Date; amount: Prisma.Decimal }[] | null,
    byCategory: { category: string; _sum: { amount: Prisma.Decimal | null }; _count: { _all: number } }[] | null,
  ) => {
    if (!rows || !byCategory) return null;
    const buckets = bucketExpenses(rows, keys, range.group);
    return {
      total: buckets.reduce((sum, bucket) => sum.plus(bucket), new Prisma.Decimal(0)),
      count: rows.length,
      buckets,
      byCategory: byCategory.map((row): GroupedExpense => ({
        id: row.category,
        amount: row._sum.amount,
        count: row._count._all,
      })),
    };
  };

  return {
    currency: settings.currency,
    keys,
    salon: section(salonRows, salonByCategory),
    employee: section(employeeRows, employeeByCategory),
    byEmployee: byEmployee && {
      rows: byEmployee.map((row): GroupedExpense => ({
        id: row.employeeId,
        amount: row._sum.amount,
        count: row._count._all,
      })),
      details: new Map(employees.map((employee) => [employee.id, employee])),
    },
  };
}

export type ExpenseReportData = Awaited<ReturnType<typeof loadExpenseReport>>;

const PERFORMANCE_EMPLOYEE = { id: true, name: true, image: true, isActive: true, sharePercentage: true } as const;

/**
 * Every employee's figures for the range. Runs only after `employeeReportScope` returned
 * "all"; deductions are queried only when `sections.expenses` allows them.
 */
export async function loadEmployeePerformanceList(
  range: Pick<RevenueReportRange, "from" | "to">,
  sections: EmployeeReportSections,
  locale?: string,
  timeZone: string = SALON_TIME_ZONE,
) {
  const [settings, invoices, expenses] = await Promise.all([
    getSalonSettings(),
    db.invoice.groupBy({
      by: ["employeeId", "status"],
      where: { status: { in: STATUSES }, createdAt: salonDayRange(range.from, range.to, timeZone) },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    sections.expenses
      ? db.employeeExpense.groupBy({
          by: ["employeeId"],
          where: { date: { gte: dateValue(range.from), lte: dateValue(range.to) } },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : [],
  ]);

  const ids = [...new Set([...invoices.map((row) => row.employeeId), ...expenses.map((row) => row.employeeId)])];
  const employees =
    ids.length === 0 ? [] : await db.user.findMany({ where: { id: { in: ids } }, select: PERFORMANCE_EMPLOYEE });

  const rows = employeePerformanceRows(
    invoices.map((row): GroupedRevenue => ({
      id: row.employeeId,
      status: row.status,
      amount: row._sum.amount,
      count: row._count._all,
    })),
    expenses.map((row): GroupedExpense => ({ id: row.employeeId, amount: row._sum.amount, count: row._count._all })),
    new Map(employees.map((employee) => [employee.id, employee])),
    settings.employeeSharePercentage,
    locale,
  );

  const zero = new Prisma.Decimal(0);
  const totals = rows.reduce(
    (sum, row) => ({
      count: sum.count + row.paidCount + row.unpaidCount,
      paid: sum.paid.plus(row.paid),
      unpaid: sum.unpaid.plus(row.unpaid),
      earnings: sum.earnings.plus(row.earnings),
      expenses: sum.expenses.plus(row.expenses),
      payout: sum.payout.plus(row.payout),
    }),
    { count: 0, paid: zero, unpaid: zero, earnings: zero, expenses: zero, payout: zero },
  );

  return { currency: settings.currency, rows, totals };
}

export type EmployeePerformanceListData = Awaited<ReturnType<typeof loadEmployeePerformanceList>>;

/**
 * One employee's figures, trend, and services for the range, or null when the user does not
 * exist. Every query is filtered by `employeeId`, which the page takes from the session in
 * scope "own"; deductions are queried only when `sections.expenses` allows them.
 */
export async function loadEmployeePerformance(
  employeeId: string,
  range: Pick<RevenueReportRange, "from" | "to" | "group">,
  sections: EmployeeReportSections,
  timeZone: string = SALON_TIME_ZONE,
) {
  const where = {
    employeeId,
    status: { in: STATUSES },
    createdAt: salonDayRange(range.from, range.to, timeZone),
  };

  const [employee, settings, invoices, byService, expenses] = await Promise.all([
    db.user.findUnique({ where: { id: employeeId }, select: { ...PERFORMANCE_EMPLOYEE, role: true } }),
    getSalonSettings(),
    db.invoice.findMany({ where, select: { createdAt: true, amount: true, status: true } }),
    db.invoice.groupBy({ by: ["serviceId", "status"], where, _sum: { amount: true }, _count: { _all: true } }),
    sections.expenses
      ? db.employeeExpense.aggregate({
          where: { employeeId, date: { gte: dateValue(range.from), lte: dateValue(range.to) } },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : null,
  ]);
  if (!employee) return null;

  const services =
    byService.length === 0
      ? []
      : await db.service.findMany({
          where: { id: { in: [...new Set(byService.map((row) => row.serviceId))] } },
          select: { id: true, nameEn: true, nameAr: true, isActive: true },
        });

  const serviceRows = byService.map((row): GroupedRevenue => ({
    id: row.serviceId,
    status: row.status,
    amount: row._sum.amount,
    count: row._count._all,
  }));
  // The figures come from the per-status totals, which are the per-service rows summed.
  const byStatus = STATUSES.map((status): GroupedRevenue => {
    const rows = serviceRows.filter((row) => row.status === status);
    return {
      id: employeeId,
      status,
      amount: rows.reduce((sum, row) => sum.plus(row.amount ?? 0), new Prisma.Decimal(0)),
      count: rows.reduce((sum, row) => sum + row.count, 0),
    };
  });

  return {
    currency: settings.currency,
    employee,
    figures: performanceFigures(
      byStatus,
      { amount: expenses?._sum.amount ?? null, count: expenses?._count._all ?? 0 },
      employee.sharePercentage,
      settings.employeeSharePercentage,
    ),
    buckets: bucketInvoices(invoices, chartBuckets(range.from, range.to, range.group), range.group, timeZone),
    byService: { rows: serviceRows, details: new Map(services.map((service) => [service.id, service])) },
  };
}

export type EmployeePerformanceData = NonNullable<Awaited<ReturnType<typeof loadEmployeePerformance>>>;
