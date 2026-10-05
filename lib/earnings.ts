/**
 * Employee earnings: paid revenue for a salon month, the share percentage that
 * applies to the employee, and the share it earns. No database import, so tests
 * and later features (settlements) can use it. Permissions are checked separately.
 */
import { Prisma } from "@/generated/prisma/client";
import { salonToday } from "@/lib/expenses";
import { SALON_TIME_ZONE, salonDayRange } from "@/lib/invoices";

type DecimalInput = Prisma.Decimal | string | number;

export type ShareSource = "employee" | "salon";

/** The employee's own percentage when an ADMIN set one (0 included), otherwise the salon default. */
export function effectiveSharePercentage(
  own: DecimalInput | null,
  salon: DecimalInput,
): { value: Prisma.Decimal; source: ShareSource } {
  return own === null
    ? { value: new Prisma.Decimal(salon), source: "salon" }
    : { value: new Prisma.Decimal(own), source: "employee" };
}

/** `employeeShare = paidRevenue * sharePercentage / 100`, exact and unrounded. */
export function calculateEarnings({
  paidRevenue,
  sharePercentage,
}: {
  paidRevenue: DecimalInput;
  sharePercentage: DecimalInput;
}) {
  const revenue = new Prisma.Decimal(paidRevenue);
  const percentage = new Prisma.Decimal(sharePercentage);
  return { paidRevenue: revenue, sharePercentage: percentage, employeeShare: revenue.times(percentage).dividedBy(100) };
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The salon calendar month (`YYYY-MM`) at this instant. */
export function salonMonth(now: Date = new Date(), timeZone: string = SALON_TIME_ZONE): string {
  return salonToday(now, timeZone).slice(0, 7);
}

/** A valid `YYYY-MM` no later than `currentMonth`; anything else is dropped for `currentMonth`. */
export function parseMonth(value: string | string[] | undefined, currentMonth: string): string {
  // `YYYY-MM` strings compare in calendar order.
  return typeof value === "string" && MONTH.test(value) && value <= currentMonth ? value : currentMonth;
}

/** The month `delta` months away, across year boundaries. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** `createdAt` bounds for every salon day of the month. */
export function salonMonthRange(month: string, timeZone: string = SALON_TIME_ZONE): { gte?: Date; lt?: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return salonDayRange(`${month}-01`, `${month}-${String(lastDay).padStart(2, "0")}`, timeZone);
}

/** The invoices that count as paid revenue in the month. UNPAID and CANCELLED never do. */
export function paidRevenueWhere(month: string, timeZone: string = SALON_TIME_ZONE): Prisma.InvoiceWhereInput {
  return { status: "PAID", createdAt: salonMonthRange(month, timeZone) };
}
