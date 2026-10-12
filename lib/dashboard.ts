/**
 * The admin dashboard: which period it covers, how the revenue chart is bucketed, and
 * who may see which salon figures. No database import, so tests can use it.
 */
import { Prisma } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { shiftMonth } from "@/lib/earnings";
import { dayOf, salonToday } from "@/lib/expenses";
import { SALON_TIME_ZONE, isCalendarDate, isOwnScope } from "@/lib/invoices";

type DecimalInput = Prisma.Decimal | string | number;

type SearchParams = Record<string, string | string[] | undefined>;

export const DASHBOARD_PERIODS = ["today", "last7", "week", "month", "previousMonth", "last12", "custom"] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DEFAULT_PERIOD = "month" satisfies DashboardPeriod;

/** The longest custom range, in days, both ends included. */
export const CUSTOM_MAX_DAYS = 366;

/** Ranges up to this many days get one chart bar per day; longer ones one per month. */
export const DAILY_MAX_DAYS = 62;

/** The dashboard uses day or month; the revenue report can also group by Monday-start week. */
export type Granularity = "day" | "week" | "month";

export interface DashboardRange {
  period: DashboardPeriod;
  /** Inclusive salon days, `YYYY-MM-DD`. */
  from: string;
  to: string;
  granularity: Granularity;
  /** A custom range was asked for but could not be used, so the default period is shown. */
  invalidCustom: boolean;
  /** The custom dates as submitted, so the form can show them again. */
  submitted?: { from?: string; to?: string };
}

const MS_PER_DAY = 86_400_000;

function utcDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** The calendar day `delta` days away, across month and year boundaries. */
export function addDays(day: string, delta: number): string {
  return new Date(utcDay(day) + delta * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The number of days from `from` to `to`, both included. */
export function daysInRange(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / MS_PER_DAY) + 1;
}

/** The Monday of the week the day falls in. */
export function weekStart(day: string): string {
  // getUTCDay: 0 is Sunday, so Sunday is 6 days after Monday.
  return addDays(day, -((new Date(utcDay(day)).getUTCDay() + 6) % 7));
}

function lastDayOfMonth(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

/** The inclusive salon days a preset covers, ending today or earlier. */
export function presetRange(period: Exclude<DashboardPeriod, "custom">, today: string): { from: string; to: string } {
  const month = today.slice(0, 7);
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "week":
      return { from: weekStart(today), to: today };
    case "month":
      return { from: `${month}-01`, to: today };
    case "previousMonth": {
      const previous = shiftMonth(month, -1);
      return { from: `${previous}-01`, to: lastDayOfMonth(previous) };
    }
    case "last12":
      return { from: `${shiftMonth(month, -11)}-01`, to: today };
  }
}

function granularityOf(from: string, to: string): "day" | "month" {
  return daysInRange(from, to) <= DAILY_MAX_DAYS ? "day" : "month";
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A usable custom range: real calendar days, `from <= to <= today`, at most `CUSTOM_MAX_DAYS` long. */
export function isValidCustomRange(from: string | undefined, to: string | undefined, today: string): boolean {
  // `YYYY-MM-DD` strings compare in calendar order.
  return (
    from !== undefined &&
    to !== undefined &&
    isCalendarDate(from) &&
    isCalendarDate(to) &&
    from <= to &&
    to <= today &&
    daysInRange(from, to) <= CUSTOM_MAX_DAYS
  );
}

/** The period in the dashboard URL. An unknown period is the default; a bad custom range is flagged. */
export function parseDashboardPeriod(params: SearchParams, today: string): DashboardRange {
  const requested = first(params.period);
  const period = DASHBOARD_PERIODS.find((key) => key === requested) ?? DEFAULT_PERIOD;

  if (period === "custom") {
    const from = first(params.from)?.trim() || undefined;
    const to = first(params.to)?.trim() || undefined;
    if (isValidCustomRange(from, to, today) && from && to) return { period, from, to, granularity: granularityOf(from, to), invalidCustom: false, submitted: { from, to } };
    const fallback = presetRange(DEFAULT_PERIOD, today);
    return {
      period: DEFAULT_PERIOD,
      ...fallback,
      granularity: granularityOf(fallback.from, fallback.to),
      invalidCustom: true,
      submitted: { from, to },
    };
  }

  const range = presetRange(period, today);
  return { period, ...range, granularity: granularityOf(range.from, range.to), invalidCustom: false };
}

/**
 * The chart's bucket keys in order: every `YYYY-MM-DD` day, every week's `YYYY-MM-DD` Monday
 * (the first may fall before `from`), or every `YYYY-MM` month, in the range.
 */
export function chartBuckets(from: string, to: string, granularity: Granularity): string[] {
  const keys: string[] = [];
  if (granularity === "day") {
    for (let day = from; day <= to; day = addDays(day, 1)) keys.push(day);
  } else if (granularity === "week") {
    for (let monday = weekStart(from); monday <= to; monday = addDays(monday, 7)) keys.push(monday);
  } else {
    const last = to.slice(0, 7);
    for (let month = from.slice(0, 7); month <= last; month = shiftMonth(month, 1)) keys.push(month);
  }
  return keys;
}

function bucketKey(day: string, granularity: Granularity): string {
  if (granularity === "day") return day;
  return granularity === "week" ? weekStart(day) : day.slice(0, 7);
}

export interface InvoiceBucket {
  key: string;
  paid: Prisma.Decimal;
  unpaid: Prisma.Decimal;
  paidCount: number;
  unpaidCount: number;
}

/** Paid and unpaid totals and counts per bucket, by the salon day of `createdAt`. CANCELLED and out-of-range rows are skipped. */
export function bucketInvoices(
  rows: readonly { createdAt: Date; amount: DecimalInput; status: string }[],
  keys: readonly string[],
  granularity: Granularity,
  timeZone: string = SALON_TIME_ZONE,
): InvoiceBucket[] {
  const buckets = new Map<string, InvoiceBucket>(
    keys.map((key) => [key, { key, paid: new Prisma.Decimal(0), unpaid: new Prisma.Decimal(0), paidCount: 0, unpaidCount: 0 }]),
  );
  for (const row of rows) {
    const bucket = buckets.get(bucketKey(salonToday(row.createdAt, timeZone), granularity));
    if (!bucket) continue;
    if (row.status === "PAID") {
      bucket.paid = bucket.paid.plus(row.amount);
      bucket.paidCount += 1;
    } else if (row.status === "UNPAID") {
      bucket.unpaid = bucket.unpaid.plus(row.amount);
      bucket.unpaidCount += 1;
    }
  }
  return [...buckets.values()];
}

/** Salon expense totals per bucket, in key order, by the expense's calendar day. */
export function bucketExpenses(
  rows: readonly { date: Date; amount: DecimalInput }[],
  keys: readonly string[],
  granularity: Granularity,
): Prisma.Decimal[] {
  const totals = new Map(keys.map((key) => [key, new Prisma.Decimal(0)]));
  for (const row of rows) {
    const key = bucketKey(dayOf(row.date), granularity);
    const total = totals.get(key);
    if (total) totals.set(key, total.plus(row.amount));
  }
  return keys.map((key) => totals.get(key)!);
}

/** The average bill, or null when there are no bills. */
export function averageBill(sum: DecimalInput, count: number): Prisma.Decimal | null {
  return count === 0 ? null : new Prisma.Decimal(sum).dividedBy(count);
}

/** Salon-wide figures: never for Staff, otherwise with `reports.view` (an ADMIN holds every key). */
export function canViewSalonDashboard(
  user: Pick<SessionUser, "role">,
  permissions: ReadonlySet<PermissionKey>,
): boolean {
  return !isOwnScope(user) && permissions.has("reports.view");
}

/** The widgets that need a permission beyond the salon dashboard itself. Their queries run only when true. */
export function dashboardSections(permissions: ReadonlySet<PermissionKey>) {
  return {
    expenses: permissions.has("expenses.view"),
    payouts: permissions.has("settlements.view"),
    latestInvoices: permissions.has("invoices.view"),
  };
}

/** The Staff personal dashboard's sections. Their queries run only when true. */
export function personalSections(permissions: ReadonlySet<PermissionKey>) {
  return {
    figures: permissions.has("reports.view_own_performance"),
    settlement: permissions.has("settlements.view"),
  };
}

export type PersonalSections = ReturnType<typeof personalSections>;
