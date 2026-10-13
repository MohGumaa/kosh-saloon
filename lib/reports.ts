/**
 * The revenue report: which period and grouping it covers, who may see it, and how
 * per-service and per-employee totals are shaped. No database import, so tests can use it.
 */
import { Prisma } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { DAILY_MAX_DAYS, daysInRange, first, isValidCustomRange, presetRange } from "@/lib/dashboard";
import { effectiveSharePercentage, shiftMonth, type ShareSource } from "@/lib/earnings";
import { isOwnScope } from "@/lib/invoices";
import {
  SETTLEMENT_STATUSES,
  calculateSettlement,
  isSettleableMonth,
  type SettlementStatusValue,
} from "@/lib/settlements";

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

/** The profile's Performance tab: any employee in scope `all`, only the viewer's own profile in scope `own`. */
export function canViewEmployeePerformance(
  viewer: Pick<SessionUser, "id" | "role">,
  permissions: ReadonlySet<PermissionKey>,
  targetId: string,
): boolean {
  const scope = employeeReportScope(viewer, permissions);
  return scope === "all" || (scope === "own" && targetId === viewer.id);
}

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

/**
 * Who the settlement report covers, as on `/settlements`: every employee for a non-Staff
 * viewer with `settlements.view` and `reports.view`, only their own for Staff with
 * `settlements.view`, otherwise nobody.
 */
export function settlementReportScope(
  user: Pick<SessionUser, "role">,
  permissions: ReadonlySet<PermissionKey>,
): "all" | "own" | null {
  if (!permissions.has("settlements.view")) return null;
  if (isOwnScope(user)) return "own";
  return permissions.has("reports.view") ? "all" : null;
}

export type SettlementReportScope = NonNullable<ReturnType<typeof settlementReportScope>>;

export const SETTLEMENT_REPORT_PATH = "/reports/settlements";

export const SETTLEMENT_REPORT_PERIODS = ["year", "last12", "custom"] as const;

export type SettlementReportPeriod = (typeof SETTLEMENT_REPORT_PERIODS)[number];

export type SettlementReportPreset = Exclude<SettlementReportPeriod, "custom">;

export const DEFAULT_SETTLEMENT_REPORT_PERIOD = "year" satisfies SettlementReportPeriod;

export interface SettlementReportRange {
  period: SettlementReportPeriod;
  /** Inclusive settled months, `YYYY-MM`. */
  from: string;
  to: string;
  /** A custom range was asked for but could not be used, so the default period is shown. */
  invalidCustom: boolean;
  /** The custom months as submitted, so the form can show them again. */
  submitted?: { from?: string; to?: string };
}

/**
 * The months a preset covers, ending at `latest` (the latest settleable month). `year` starts
 * in January of `latest`'s year, so in January it is the whole previous year.
 */
export function settlementPresetRange(period: SettlementReportPreset, latest: string): { from: string; to: string } {
  return period === "year" ? { from: `${latest.slice(0, 4)}-01`, to: latest } : { from: shiftMonth(latest, -11), to: latest };
}

/** The report in the URL. Unknown values fall back to `year`; a bad custom range is flagged. */
export function parseSettlementReport(params: SearchParams, latest: string): SettlementReportRange {
  const requested = first(params.period);
  const period = SETTLEMENT_REPORT_PERIODS.find((key) => key === requested) ?? DEFAULT_SETTLEMENT_REPORT_PERIOD;
  if (period !== "custom") return { period, ...settlementPresetRange(period, latest), invalidCustom: false };

  const from = first(params.from)?.trim() || undefined;
  const to = first(params.to)?.trim() || undefined;
  // A month is settleable when it is before the current one, the month after `latest`.
  const current = shiftMonth(latest, 1);
  // `YYYY-MM` strings compare in calendar order.
  if (from && to && isSettleableMonth(from, current) && isSettleableMonth(to, current) && from <= to) {
    return { period, from, to, invalidCustom: false, submitted: { from, to } };
  }
  return {
    period: DEFAULT_SETTLEMENT_REPORT_PERIOD,
    ...settlementPresetRange(DEFAULT_SETTLEMENT_REPORT_PERIOD, latest),
    invalidCustom: true,
    submitted: { from, to },
  };
}

/** A preset link; the default period has no query. */
export function settlementReportHref(period: SettlementReportPreset): string {
  return period === DEFAULT_SETTLEMENT_REPORT_PERIOD ? SETTLEMENT_REPORT_PATH : `${SETTLEMENT_REPORT_PATH}?period=${period}`;
}

/**
 * The months the custom form offers, newest first: from the earlier of `firstMonth` (the first
 * settled month in scope, if any) and January of `latest`'s year, up to `latest`.
 */
export function settlementMonthOptions(firstMonth: string | null, latest: string): string[] {
  const january = `${latest.slice(0, 4)}-01`;
  const start = firstMonth && firstMonth < january ? firstMonth : january;
  const months: string[] = [];
  for (let month = latest; month >= start; month = shiftMonth(month, -1)) months.push(month);
  return months;
}

/** One stored settlement, as the report reads it. */
export interface SettlementReportInput<E extends { id: string; name: string }> {
  periodStart: Date;
  status: SettlementStatusValue;
  totalRevenue: Prisma.Decimal;
  sharePercentage: Prisma.Decimal;
  employeeShare: Prisma.Decimal;
  totalExpenses: Prisma.Decimal;
  totalAdjustments: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
  employee: E;
}

export interface SettlementSums {
  count: number;
  revenue: Prisma.Decimal;
  earnings: Prisma.Decimal;
  expenses: Prisma.Decimal;
  adjustments: Prisma.Decimal;
  final: Prisma.Decimal;
  /** The final amount of the PAID settlements among them. */
  paid: Prisma.Decimal;
}

function emptySums(): SettlementSums {
  const zero = new Prisma.Decimal(0);
  return { count: 0, revenue: zero, earnings: zero, expenses: zero, adjustments: zero, final: zero, paid: zero };
}

function addSettlement(sums: SettlementSums, row: SettlementReportInput<{ id: string; name: string }>): void {
  sums.count += 1;
  sums.revenue = sums.revenue.plus(row.totalRevenue);
  sums.earnings = sums.earnings.plus(row.employeeShare);
  sums.expenses = sums.expenses.plus(row.totalExpenses);
  sums.adjustments = sums.adjustments.plus(row.totalAdjustments);
  sums.final = sums.final.plus(row.finalAmount);
  if (row.status === "PAID") sums.paid = sums.paid.plus(row.finalAmount);
}

/**
 * The report's totals from the stored, frozen values; nothing is recalculated. Every status
 * counts. Months without settlements are left out (oldest first); employees are by name.
 */
export function settlementReportTotals<E extends { id: string; name: string }>(
  rows: readonly SettlementReportInput<E>[],
  locale?: string,
) {
  const total = emptySums();
  const awaitingApproval = emptySums();
  const byStatus = new Map<SettlementStatusValue, SettlementSums>(SETTLEMENT_STATUSES.map((status) => [status, emptySums()]));
  const byMonth = new Map<string, SettlementSums>();
  const byEmployee = new Map<string, SettlementSums & { employee: E; minShare: Prisma.Decimal; maxShare: Prisma.Decimal }>();

  for (const row of rows) {
    addSettlement(total, row);
    addSettlement(byStatus.get(row.status)!, row);
    if (row.status === "DRAFT" || row.status === "CALCULATED") addSettlement(awaitingApproval, row);

    const month = row.periodStart.toISOString().slice(0, 7);
    let monthSums = byMonth.get(month);
    if (!monthSums) byMonth.set(month, (monthSums = emptySums()));
    addSettlement(monthSums, row);

    let employee = byEmployee.get(row.employee.id);
    if (!employee) {
      employee = { ...emptySums(), employee: row.employee, minShare: row.sharePercentage, maxShare: row.sharePercentage };
      byEmployee.set(row.employee.id, employee);
    }
    addSettlement(employee, row);
    if (row.sharePercentage.lessThan(employee.minShare)) employee.minShare = row.sharePercentage;
    if (row.sharePercentage.greaterThan(employee.maxShare)) employee.maxShare = row.sharePercentage;
  }

  return {
    total,
    awaitingApproval,
    byStatus: SETTLEMENT_STATUSES.map((status) => ({ status, ...byStatus.get(status)! })),
    // `YYYY-MM` strings sort in calendar order.
    byMonth: [...byMonth].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, sums]) => ({ month, ...sums })),
    byEmployee: [...byEmployee.values()].sort((a, b) => a.employee.name.localeCompare(b.employee.name, locale)),
  };
}

export type SettlementReportTotals<E extends { id: string; name: string }> = ReturnType<typeof settlementReportTotals<E>>;
