/**
 * Employee expense (deduction) input schemas and tab filters. No database import, so
 * client forms and tests can use them. Permissions are checked separately.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { dateValue, descriptionSchema } from "@/lib/expenses";
import { isCalendarDate } from "@/lib/invoices";
import { priceSchema } from "@/lib/services";

export const EMPLOYEE_EXPENSE_CATEGORIES = [
  "CASH_ADVANCE",
  "ADVANCE_SALARY",
  "WITHDRAWAL",
  "PERSONAL_PURCHASE",
  "OTHER",
] as const;

export type EmployeeExpenseCategoryValue = (typeof EMPLOYEE_EXPENSE_CATEGORIES)[number];

export const EMPLOYEE_EXPENSE_PAGE_SIZE = 50;

/** An expense id or an employee (user) id. */
export const employeeExpenseIdSchema = z.string().min(1).max(100);

export const employeeExpenseCategorySchema = z.enum(EMPLOYEE_EXPENSE_CATEGORIES);

/**
 * The fields a create or edit submits. `today` is the latest allowed date, a salon day
 * (`salonToday()`). The amount is always positive: signed corrections are settlement
 * adjustments, not deductions.
 */
export function employeeExpenseSchema(today: string) {
  return z.object({
    category: employeeExpenseCategorySchema,
    amount: priceSchema,
    description: descriptionSchema,
    date: z
      .string()
      .trim()
      .refine((value) => isCalendarDate(value) && value <= today),
  });
}

export type EmployeeExpenseInput = z.infer<ReturnType<typeof employeeExpenseSchema>>;

export interface EmployeeExpenseFilters {
  category?: EmployeeExpenseCategoryValue;
  /** `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
}

const FILTER_KEYS = ["category", "from", "to"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The valid filters in a tab URL. An invalid value is dropped, never an error. */
export function parseEmployeeExpenseFilters(params: SearchParams): EmployeeExpenseFilters {
  const filters: EmployeeExpenseFilters = {};

  const category = employeeExpenseCategorySchema.safeParse(first(params.category));
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

/** One employee's deductions matching these filters. */
export function employeeExpenseWhere(
  employeeId: string,
  filters: EmployeeExpenseFilters,
): Prisma.EmployeeExpenseWhereInput {
  const where: Prisma.EmployeeExpenseWhereInput = { employeeId };
  if (filters.category) where.category = filters.category;
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from && { gte: dateValue(filters.from) }),
      ...(filters.to && { lte: dateValue(filters.to) }),
    };
  }
  return where;
}

/** The employee's Expenses tab with these filters and page; empty values and page 1 are left out. */
export function employeeExpenseListHref(employeeId: string, filters: EmployeeExpenseFilters, page = 1): string {
  const params = new URLSearchParams({ tab: "expenses" });
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  return `/employees/${employeeId}?${params}`;
}
