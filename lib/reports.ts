/**
 * The revenue report: which period and grouping it covers, who may see it, and how
 * per-service and per-employee totals are shaped. No database import, so tests can use it.
 */
import { Prisma } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { DAILY_MAX_DAYS, daysInRange, first, isValidCustomRange, presetRange } from "@/lib/dashboard";
import { effectiveSharePercentage, type ShareSource } from "@/lib/earnings";
import { isOwnScope } from "@/lib/invoices";
import { calculateSettlement } from "@/lib/settlements";

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
 * A link to the report at `path` with the period or grouping changed and everything else kept.
 * Default values are left out; a grouping the target range does not offer is dropped.
 * `keep` adds other params of the page, such as the employee; empty values are left out.
 */
export function reportHref(
  path: string,
  range: Pick<RevenueReportRange, "period" | "from" | "to" | "group">,
  change: { period?: RevenuePreset; group?: RevenueGroup },
  today: string,
  keep: Record<string, string> = {},
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
  for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
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

/**
 * Salon expenses and employee deductions: never for Staff, otherwise with `reports.view` and
 * at least one of the two expense views (an ADMIN holds every key).
 */
export function canViewExpenseReport(
  user: Pick<SessionUser, "role">,
  permissions: ReadonlySet<PermissionKey>,
): boolean {
  return (
    !isOwnScope(user) &&
    permissions.has("reports.view") &&
    (permissions.has("expenses.view") || permissions.has("employee_expenses.view"))
  );
}

/** The expense report sections the viewer may see. Their queries run only when true. */
export function expenseSections(permissions: ReadonlySet<PermissionKey>) {
  const employee = permissions.has("employee_expenses.view");
  return {
    salon: permissions.has("expenses.view"),
    employee,
    byEmployee: employee && permissions.has("reports.view_all_employees"),
  };
}

export type ExpenseSections = ReturnType<typeof expenseSections>;

/** One `groupBy` row, keyed by a category or employee id. */
export interface GroupedExpense {
  id: string;
  amount: Prisma.Decimal | null;
  count: number;
}

export interface ExpenseBreakdownRow<T> {
  id: string;
  detail: T;
  count: number;
  total: Prisma.Decimal;
}

/** Per-id expense totals, highest first, then by name. An id without details (deleted since) is left out. */
export function expenseBreakdown<T>(
  rows: readonly GroupedExpense[],
  details: ReadonlyMap<string, T>,
  nameOf: (detail: T) => string,
  locale?: string,
): ExpenseBreakdownRow<T>[] {
  return rows
    .flatMap((row) => {
      const detail = details.get(row.id);
      if (detail === undefined) return [];
      return [{ id: row.id, detail, count: row.count, total: row.amount ?? new Prisma.Decimal(0) }];
    })
    .sort((a, b) => b.total.comparedTo(a.total) || nameOf(a.detail).localeCompare(nameOf(b.detail), locale));
}

/**
 * Who the employee performance report covers: every employee for a non-Staff viewer with
 * `reports.view` and `reports.view_all_employees`, otherwise only the viewer with
 * `reports.view_own_performance`, otherwise nobody. Staff never see other employees.
 */
export function employeeReportScope(
  user: Pick<SessionUser, "role">,
  permissions: ReadonlySet<PermissionKey>,
): "all" | "own" | null {
  if (!isOwnScope(user) && permissions.has("reports.view") && permissions.has("reports.view_all_employees")) {
    return "all";
  }
  return permissions.has("reports.view_own_performance") ? "own" : null;
}

export type EmployeeReportScope = NonNullable<ReturnType<typeof employeeReportScope>>;

/** Deductions (and so payout) need `employee_expenses.view`, except for the viewer's own. Their queries run only when true. */
export function employeeReportSections(scope: EmployeeReportScope, permissions: ReadonlySet<PermissionKey>) {
  return { expenses: scope === "own" || permissions.has("employee_expenses.view") };
}

export type EmployeeReportSections = ReturnType<typeof employeeReportSections>;

export interface PerformanceFigures {
  paidCount: number;
  unpaidCount: number;
  paid: Prisma.Decimal;
  unpaid: Prisma.Decimal;
  sharePercentage: Prisma.Decimal;
  shareSource: ShareSource;
  /** Estimated: paid revenue times the current effective share, rounded as a settlement is. */
  earnings: Prisma.Decimal;
  expenses: Prisma.Decimal;
  expenseCount: number;
  /** Estimated: earnings minus deductions; pending adjustments are left out. It can be negative. */
  payout: Prisma.Decimal;
}

/**
 * One employee's estimated figures, the same rule as the Staff dashboard: the current
 * effective share percentage, and no adjustments. Only PAID and UNPAID groups count.
 */
export function performanceFigures(
  invoices: readonly GroupedRevenue[],
  expenses: { amount: Prisma.Decimal | null; count: number },
  ownShare: Prisma.Decimal | null,
  salonShare: Prisma.Decimal | string | number,
): PerformanceFigures {
  const zero = new Prisma.Decimal(0);
  const paid = invoices.filter((row) => row.status === "PAID");
  const unpaid = invoices.filter((row) => row.status === "UNPAID");
  const sum = (rows: readonly GroupedRevenue[]) => rows.reduce((total, row) => total.plus(row.amount ?? 0), zero);
  const count = (rows: readonly GroupedRevenue[]) => rows.reduce((total, row) => total + row.count, 0);
  const share = effectiveSharePercentage(ownShare, salonShare);
  const settlement = calculateSettlement({
    paidRevenue: sum(paid),
    sharePercentage: share.value,
    expenses: expenses.amount ?? zero,
    adjustments: 0,
  });
  return {
    paidCount: count(paid),
    unpaidCount: count(unpaid),
    paid: settlement.totalRevenue,
    unpaid: sum(unpaid),
    sharePercentage: settlement.sharePercentage,
    shareSource: share.source,
    earnings: settlement.employeeShare,
    expenses: settlement.totalExpenses,
    expenseCount: expenses.count,
    payout: settlement.finalAmount,
  };
}

export interface PerformanceEmployee {
  id: string;
  name: string;
  image: string | null;
  isActive: boolean;
  sharePercentage: Prisma.Decimal | null;
}

export interface PerformanceRow<T extends PerformanceEmployee> extends PerformanceFigures {
  id: string;
  detail: T;
}

/**
 * One row per employee with PAID or UNPAID invoices or deductions, highest paid revenue
 * first, then by name. An id without details (deleted since) is left out.
 */
export function employeePerformanceRows<T extends PerformanceEmployee>(
  invoices: readonly GroupedRevenue[],
  expenses: readonly GroupedExpense[],
  details: ReadonlyMap<string, T>,
  salonShare: Prisma.Decimal | string | number,
  locale?: string,
): PerformanceRow<T>[] {
  const counted = invoices.filter((row) => row.status === "PAID" || row.status === "UNPAID");
  const ids = new Set([...counted.map((row) => row.id), ...expenses.map((row) => row.id)]);
  return [...ids]
    .flatMap((id) => {
      const detail = details.get(id);
      if (detail === undefined) return [];
      const expense = expenses.find((row) => row.id === id);
      const figures = performanceFigures(
        counted.filter((row) => row.id === id),
        { amount: expense?.amount ?? null, count: expense?.count ?? 0 },
        detail.sharePercentage,
        salonShare,
      );
      return [{ id, detail, ...figures }];
    })
    .sort((a, b) => b.paid.comparedTo(a.paid) || a.detail.name.localeCompare(b.detail.name, locale));
}
