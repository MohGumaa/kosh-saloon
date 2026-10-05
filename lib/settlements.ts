/**
 * Monthly employee settlements: the stored values, the salon month a settlement covers,
 * and which status changes a viewer may make. No database import, so pages, actions,
 * and tests can use it.
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { calculateEarnings, shiftMonth } from "@/lib/earnings";
import { employeeExpenseIdSchema } from "@/lib/employee-expenses";
import { normalizeDigitsAndSpaces } from "@/lib/auth/validation";
import { DESCRIPTION_MAX, MULTI_LINE_TEXT, dateValue } from "@/lib/expenses";
import { isOwnScope } from "@/lib/invoices";

type DecimalInput = Prisma.Decimal | string | number;

export const SETTLEMENT_STATUSES = ["DRAFT", "CALCULATED", "APPROVED", "PAID"] as const;

export type SettlementStatusValue = (typeof SETTLEMENT_STATUSES)[number];

/** A settlement id. */
export const settlementIdSchema = employeeExpenseIdSchema;

/**
 * The values a settlement stores. `employeeShare` is rounded to 2 decimals, half up;
 * the other inputs are 2-decimal sums, so `finalAmount` is exact. It can be negative.
 */
export function calculateSettlement({
  paidRevenue,
  sharePercentage,
  expenses,
  adjustments,
}: {
  paidRevenue: DecimalInput;
  sharePercentage: DecimalInput;
  expenses: DecimalInput;
  adjustments: DecimalInput;
}) {
  const earnings = calculateEarnings({ paidRevenue, sharePercentage });
  const employeeShare = earnings.employeeShare.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const totalExpenses = new Prisma.Decimal(expenses);
  const totalAdjustments = new Prisma.Decimal(adjustments);
  return {
    totalRevenue: earnings.paidRevenue,
    sharePercentage: earnings.sharePercentage,
    employeeShare,
    totalExpenses,
    totalAdjustments,
    finalAmount: employeeShare.minus(totalExpenses).plus(totalAdjustments),
  };
}

/** The first and last salon day of the month, as `@db.Date` values. */
export function monthPeriod(month: string): { periodStart: Date; periodEnd: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { periodStart: dateValue(`${month}-01`), periodEnd: dateValue(`${month}-${String(lastDay).padStart(2, "0")}`) };
}

/** The `YYYY-MM` a stored `periodStart` belongs to. */
export function monthOf(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

/** The employee expenses that belong to the month, by their salon day. */
export function expensesWhere(month: string): Prisma.EmployeeExpenseWhereInput {
  const { periodStart, periodEnd } = monthPeriod(month);
  return { date: { gte: periodStart, lte: periodEnd } };
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Only a completed month can be settled, so no later invoice of the month is left out. */
export function isSettleableMonth(month: string, currentMonth: string): boolean {
  // `YYYY-MM` strings compare in calendar order.
  return MONTH.test(month) && month < currentMonth;
}

/** A settleable month from the URL, otherwise the latest one (the month before `currentMonth`). */
export function parseSettlementMonth(value: string | string[] | undefined, currentMonth: string): string {
  return typeof value === "string" && isSettleableMonth(value, currentMonth) ? value : shiftMonth(currentMonth, -1);
}

export type SettlementAction = "recalculate" | "calculate" | "approve" | "pay";

export const SETTLEMENT_TRANSITIONS: Record<
  SettlementAction,
  { from: readonly SettlementStatusValue[]; to: SettlementStatusValue; permission: PermissionKey }
> = {
  recalculate: { from: ["DRAFT", "CALCULATED"], to: "DRAFT", permission: "settlements.create" },
  calculate: { from: ["DRAFT"], to: "CALCULATED", permission: "settlements.create" },
  approve: { from: ["CALCULATED"], to: "APPROVED", permission: "settlements.approve" },
  pay: { from: ["APPROVED"], to: "PAID", permission: "settlements.mark_paid" },
};

/** Staff never act on settlements, whatever they hold, so nobody settles their own pay. */
export function canManageSettlements(
  permissions: ReadonlySet<PermissionKey>,
  user: Pick<SessionUser, "role">,
  permission: PermissionKey,
): boolean {
  return !isOwnScope(user) && permissions.has(permission);
}

/** Whether this viewer may run the action on a settlement in this status. */
export function canRunSettlementAction(
  action: SettlementAction,
  status: SettlementStatusValue,
  permissions: ReadonlySet<PermissionKey>,
  user: Pick<SessionUser, "role">,
): boolean {
  const transition = SETTLEMENT_TRANSITIONS[action];
  return transition.from.includes(status) && canManageSettlements(permissions, user, transition.permission);
}

/** The longest adjustment reason. */
export const ADJUSTMENT_REASON_MAX = DESCRIPTION_MAX;

/**
 * A signed, nonzero amount with at most eight whole digits and two decimal places, kept a
 * string so it reaches Prisma without passing through a float. Accepts Arabic-Indic digits,
 * the Arabic decimal separator, and the Unicode minus sign.
 */
export const adjustmentAmountSchema = z
  .string()
  .transform((value) => normalizeDigitsAndSpaces(value).replace("٫", ".").replace("−", "-").trim())
  .pipe(
    z
      .string()
      .regex(/^-?\d{1,8}(\.\d{1,2})?$/)
      // Runs even when the pattern failed, so it must not throw on any string.
      .refine((value) => Number(value) !== 0)
      .transform((value) => new Prisma.Decimal(value).toString()),
  );

/** Why the paid settlement is corrected: required plain text, line breaks allowed. */
export const adjustmentReasonSchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .pipe(z.string().min(1).max(ADJUSTMENT_REASON_MAX).regex(MULTI_LINE_TEXT));

/** A correction to the PAID settlement `id`. The employee always comes from that settlement. */
export const adjustmentSchema = z.object({
  id: settlementIdSchema,
  amount: adjustmentAmountSchema,
  reason: adjustmentReasonSchema,
});

/** Only a PAID settlement is corrected by an adjustment; earlier ones are recalculated. */
export function canAdjustSettlement(
  status: SettlementStatusValue,
  permissions: ReadonlySet<PermissionKey>,
  user: Pick<SessionUser, "role">,
): boolean {
  return status === "PAID" && canManageSettlements(permissions, user, "settlements.mark_paid");
}

/** The exact total of the adjustments a settlement includes. */
export function sumAdjustments(amounts: readonly DecimalInput[]): Prisma.Decimal {
  return amounts.reduce<Prisma.Decimal>((total, amount) => total.plus(amount), new Prisma.Decimal(0));
}
