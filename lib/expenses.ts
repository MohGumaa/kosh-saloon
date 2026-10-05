/**
 * Salon expense input schemas, list filters, and the salon's current day. No database
 * import, so client forms and tests can use them. Permissions are checked separately.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { SINGLE_LINE_TEXT } from "@/lib/auth/validation";
import { SALON_TIME_ZONE, isCalendarDate } from "@/lib/invoices";
import { priceSchema } from "@/lib/services";

export const EXPENSE_CATEGORIES = [
  "RENT",
  "ELECTRICITY",
  "WATER",
  "INTERNET",
  "SUPPLIES",
  "EQUIPMENT",
  "MAINTENANCE",
  "MARKETING",
  "OTHER",
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAGE_SIZE = 50;

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;

export const expenseIdSchema = z.string().min(1).max(100);

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

/** Like `SINGLE_LINE_TEXT`, but line breaks are allowed. */
const MULTI_LINE_TEXT = /^(?:[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|[‌‍\n])*$/u;

/** An optional note, shared with employee expenses: empty becomes `null`. */
export const descriptionSchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .pipe(z.string().max(DESCRIPTION_MAX).regex(MULTI_LINE_TEXT))
  .transform((value) => (value === "" ? null : value));

/** The calendar day it is in the time zone at this instant, as `YYYY-MM-DD`. */
export function salonToday(now: Date = new Date(), timeZone: string = SALON_TIME_ZONE): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * The fields a create or edit submits. `today` is the latest allowed date, a salon day
 * (`salonToday()`); `YYYY-MM-DD` strings compare in calendar order.
 */
export function expenseSchema(today: string) {
  return z.object({
    title: z.string().trim().min(1).max(TITLE_MAX).regex(SINGLE_LINE_TEXT),
    description: descriptionSchema,
    category: expenseCategorySchema,
    amount: priceSchema,
    date: z
      .string()
      .trim()
      .refine((value) => isCalendarDate(value) && value <= today),
  });
}

export type ExpenseInput = z.infer<ReturnType<typeof expenseSchema>>;

/** The `@db.Date` value for a calendar day: midnight UTC. */
export function dateValue(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** The calendar day a `@db.Date` value holds, as `YYYY-MM-DD`. */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ExpenseFilters {
  q?: string;
  category?: ExpenseCategoryValue;
  /** `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
}

export const FILTER_KEYS = ["q", "category", "from", "to"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const qSchema = z.string().trim().min(1).max(100).regex(SINGLE_LINE_TEXT);

/** The valid filters in a list URL. An invalid value is dropped, never an error. */
export function parseExpenseFilters(params: SearchParams): ExpenseFilters {
  const filters: ExpenseFilters = {};

  const q = qSchema.safeParse(first(params.q) ?? "");
  if (q.success) filters.q = q.data;

  const category = expenseCategorySchema.safeParse(first(params.category));
  if (category.success) filters.category = category.data;

  const from = first(params.from);
  const to = first(params.to);
  const validFrom = from && isCalendarDate(from) ? from : undefined;
  const validTo = to && isCalendarDate(to) ? to : undefined;
  // A backwards range means neither end can be trusted.
  if (!(validFrom && validTo && validFrom > validTo)) {
    if (validFrom) filters.from = validFrom;
    if (validTo) filters.to = validTo;
  }

  return filters;
}

/** The list query for these filters. Salon expenses have no per-user scope. */
export function expenseWhere(filters: ExpenseFilters): Prisma.SalonExpenseWhereInput {
  const where: Prisma.SalonExpenseWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from && { gte: dateValue(filters.from) }),
      ...(filters.to && { lte: dateValue(filters.to) }),
    };
  }
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" } as const;
    where.OR = [{ title: contains }, { description: contains }];
  }
  return where;
}

/** A list URL with these filters and page; empty values and page 1 are left out. */
export function expenseListHref(filters: ExpenseFilters, page = 1): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/expenses?${query}` : "/expenses";
}
