/**
 * The revenue report: which period and grouping it covers, who may see it, and how
 * per-service and per-employee totals are shaped. No database import, so tests can use it.
 */
import { Prisma } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { DAILY_MAX_DAYS, daysInRange, first, isValidCustomRange, presetRange } from "@/lib/dashboard";
import { isOwnScope } from "@/lib/invoices";

type SearchParams = Record<string, string | string[] | undefined>;

export const REVENUE_PERIODS = ["today", "week", "month", "year", "custom"] as const;

export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

export type RevenuePreset = Exclude<RevenuePeriod, "custom">;

export const DEFAULT_REVENUE_PERIOD = "month" satisfies RevenuePeriod;

export const REVENUE_GROUPS = ["day", "week", "month"] as const;

export type RevenueGroup = (typeof REVENUE_GROUPS)[number];

export interface RevenueReportRange {
  period: RevenuePeriod;
  /** Inclusive salon days, `YYYY-MM-DD`. */
  from: string;
  to: string;
  group: RevenueGroup;
  /** The groupings offered for this range; `day` only up to `DAILY_MAX_DAYS`. */
  allowedGroups: RevenueGroup[];
  /** A custom range was asked for but could not be used, so the default period is shown. */
  invalidCustom: boolean;
  /** The custom dates as submitted, so the form can show them again. */
  submitted?: { from?: string; to?: string };
}

/** The inclusive salon days a preset covers, ending today. */
export function revenuePresetRange(period: RevenuePreset, today: string): { from: string; to: string } {
  return period === "year" ? { from: `${today.slice(0, 4)}-01-01`, to: today } : presetRange(period, today);
}

export function allowedGroups(from: string, to: string): RevenueGroup[] {
  return daysInRange(from, to) <= DAILY_MAX_DAYS ? ["day", "week", "month"] : ["week", "month"];
}

export function defaultGroup(from: string, to: string): RevenueGroup {
  return daysInRange(from, to) <= DAILY_MAX_DAYS ? "day" : "month";
}

/** The report in the URL. Unknown values fall back to defaults; a bad custom range is flagged. */
export function parseRevenueReport(params: SearchParams, today: string): RevenueReportRange {
  const requested = first(params.period);
  let period: RevenuePeriod = REVENUE_PERIODS.find((key) => key === requested) ?? DEFAULT_REVENUE_PERIOD;
  let range: { from: string; to: string };
  let invalidCustom = false;
  let submitted: RevenueReportRange["submitted"];

  if (period === "custom") {
    const from = first(params.from)?.trim() || undefined;
    const to = first(params.to)?.trim() || undefined;
    submitted = { from, to };
    if (isValidCustomRange(from, to, today) && from && to) {
      range = { from, to };
    } else {
      invalidCustom = true;
      period = DEFAULT_REVENUE_PERIOD;
      range = revenuePresetRange(period, today);
    }
  } else {
    range = revenuePresetRange(period, today);
  }

  const groups = allowedGroups(range.from, range.to);
  const requestedGroup = first(params.group);
  const group = groups.find((key) => key === requestedGroup) ?? defaultGroup(range.from, range.to);
  return { period, ...range, group, allowedGroups: groups, invalidCustom, submitted };
}

/**
 * A link to the report with the period or grouping changed and everything else kept.
 * Default values are left out; a grouping the target range does not offer is dropped.
 */
export function revenueReportHref(
  range: Pick<RevenueReportRange, "period" | "from" | "to" | "group">,
  change: { period?: RevenuePreset; group?: RevenueGroup },
  today: string,
): string {
  const period = change.period ?? range.period;
  const target = change.period ? revenuePresetRange(change.period, today) : range;
  const group = change.group ?? range.group;

  const params = new URLSearchParams();
  if (period !== DEFAULT_REVENUE_PERIOD) params.set("period", period);
  if (period === "custom") {
    params.set("from", target.from);
    params.set("to", target.to);
  }
  if (group !== defaultGroup(target.from, target.to) && allowedGroups(target.from, target.to).includes(group)) {
    params.set("group", group);
  }
  const query = params.toString();
  return query ? `/reports/revenue?${query}` : "/reports/revenue";
}

/** Salon-wide revenue: never for Staff, otherwise with `reports.view` (an ADMIN holds every key). */
export function canViewRevenueReport(
  user: Pick<SessionUser, "role">,
  permissions: ReadonlySet<PermissionKey>,
): boolean {
  return !isOwnScope(user) && permissions.has("reports.view");
}

/** The sections that need a permission beyond the report itself. Their queries run only when true. */
export function revenueSections(permissions: ReadonlySet<PermissionKey>) {
  return { byEmployee: permissions.has("reports.view_all_employees") };
}

export type RevenueSections = ReturnType<typeof revenueSections>;

/** One `groupBy` row, keyed by a service or employee id and an invoice status. */
export interface GroupedRevenue {
  id: string;
  status: string;
  amount: Prisma.Decimal | null;
  count: number;
}

export interface BreakdownRow<T> {
  id: string;
  detail: T;
  count: number;
  paid: Prisma.Decimal;
  unpaid: Prisma.Decimal;
  gross: Prisma.Decimal;
}

/**
 * Per-id paid, unpaid, and gross totals, highest gross first, then by name. Only PAID and
 * UNPAID rows count; an id without details (deleted since) is left out.
 */
export function breakdownRows<T>(
  rows: readonly GroupedRevenue[],
  details: ReadonlyMap<string, T>,
  nameOf: (detail: T) => string,
  locale?: string,
): BreakdownRow<T>[] {
  const byId = new Map<string, BreakdownRow<T>>();
  for (const row of rows) {
    if (row.status !== "PAID" && row.status !== "UNPAID") continue;
    const detail = details.get(row.id);
    if (detail === undefined) continue;
    let entry = byId.get(row.id);
    if (!entry) {
      const zero = new Prisma.Decimal(0);
      entry = { id: row.id, detail, count: 0, paid: zero, unpaid: zero, gross: zero };
      byId.set(row.id, entry);
    }
    const amount = row.amount ?? new Prisma.Decimal(0);
    if (row.status === "PAID") entry.paid = entry.paid.plus(amount);
    else entry.unpaid = entry.unpaid.plus(amount);
    entry.gross = entry.gross.plus(amount);
    entry.count += row.count;
  }
  return [...byId.values()].sort(
    (a, b) => b.gross.comparedTo(a.gross) || nameOf(a.detail).localeCompare(nameOf(b.detail), locale),
  );
}
