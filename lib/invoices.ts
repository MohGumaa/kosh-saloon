/**
 * Invoice input schemas, numbering, list filters, and scope rules. No database import,
 * so client forms and tests can use them. Permissions are checked separately.
 */
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { SINGLE_LINE_TEXT, normalizeDigitsAndSpaces } from "@/lib/auth/validation";
import { priceSchema } from "@/lib/services";

export const INVOICE_STATUSES = ["PAID", "UNPAID", "CANCELLED"] as const;

export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

/** Day boundaries for date filters. A fixed constant: the salon has no time zone setting. */
export const SALON_TIME_ZONE = "Asia/Dubai";

export const INVOICE_PAGE_SIZE = 50;

const idSchema = z.string().min(1).max(100);

export const invoiceIdSchema = idSchema;

/** The fields an edit can change. The amount must be greater than 0 and stays a string. */
export const invoiceSchema = z.object({ employeeId: idSchema, serviceId: idSchema, amount: priceSchema });

/** A new invoice starts Paid or Unpaid; the user must choose. */
export const createInvoiceSchema = invoiceSchema.extend({ status: z.enum(["PAID", "UNPAID"]) });

export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/** CANCELLED is final; any other status may move to a different one. */
export function canChangeStatus(from: InvoiceStatusValue, to: InvoiceStatusValue): boolean {
  return from !== "CANCELLED" && from !== to;
}

const NUMBER_DIGITS = 6;
const MAX_NUMBER = 10 ** NUMBER_DIGITS - 1;
const INVOICE_NUMBER = /^INV-(\d{6})$/;

export function formatInvoiceNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_NUMBER) {
    throw new Error(`invoice number ${sequence} is outside 1 to ${MAX_NUMBER}`);
  }
  return `INV-${String(sequence).padStart(NUMBER_DIGITS, "0")}`;
}

/**
 * The number after the highest stored one, or the first number when none is stored.
 * Six fixed digits keep the string order equal to the numeric order, so past INV-999999
 * this throws instead of breaking the order.
 */
export function nextInvoiceNumber(highest: string | null): string {
  if (highest === null) return formatInvoiceNumber(1);
  const match = INVOICE_NUMBER.exec(highest);
  if (!match) throw new Error(`stored invoice number ${highest} has an unexpected format`);
  return formatInvoiceNumber(Number(match[1]) + 1);
}

/** Staff see and create only their own invoices. */
export function isOwnScope(user: Pick<SessionUser, "role">): boolean {
  return user.role === "STAFF";
}

/** Editing and status changes also need the permission; Staff never get them. */
export function canManageInvoices(user: Pick<SessionUser, "role">): boolean {
  return user.role !== "STAFF";
}

export interface InvoiceFilters {
  q?: string;
  employee?: string;
  service?: string;
  status?: InvoiceStatusValue;
  /** `YYYY-MM-DD`, a salon calendar day, inclusive. */
  from?: string;
  to?: string;
  /** Normalized decimal strings, inclusive. */
  min?: string;
  max?: string;
}

export const FILTER_KEYS = ["q", "employee", "service", "status", "from", "to", "min", "max"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const qSchema = z.string().trim().min(1).max(100).regex(SINGLE_LINE_TEXT);

const filterAmountSchema = z
  .string()
  .transform((value) => normalizeDigitsAndSpaces(value).replace("٫", ".").trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/)
      .transform((value) => String(Number(value))),
  );

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The valid filters in a list URL. An invalid value is dropped, never an error. */
export function parseInvoiceFilters(params: SearchParams): InvoiceFilters {
  const filters: InvoiceFilters = {};

  const q = qSchema.safeParse(first(params.q) ?? "");
  if (q.success) filters.q = q.data;

  for (const key of ["employee", "service"] as const) {
    const id = idSchema.safeParse(first(params[key]) ?? "");
    if (id.success) filters[key] = id.data;
  }

  const status = invoiceStatusSchema.safeParse(first(params.status));
  if (status.success) filters.status = status.data;

  const from = first(params.from);
  const to = first(params.to);
  const validFrom = from && isCalendarDate(from) ? from : undefined;
  const validTo = to && isCalendarDate(to) ? to : undefined;
  // A backwards range means neither end can be trusted.
  if (!(validFrom && validTo && validFrom > validTo)) {
    if (validFrom) filters.from = validFrom;
    if (validTo) filters.to = validTo;
  }

  for (const key of ["min", "max"] as const) {
    const amount = filterAmountSchema.safeParse(first(params[key]) ?? "");
    if (amount.success) filters[key] = amount.data;
  }

  return filters;
}

/** How far the zone's wall clock is ahead of UTC at this instant, in milliseconds. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, Number(part.value)]),
  );
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClock - (instant - (instant % 1000));
}

/**
 * The instant a calendar day (`YYYY-MM-DD`) starts in the time zone. `addDays` moves
 * the day first; `Date.UTC` carries an overflowing day into the next month or year,
 * so the day after 9999-12-31 is a valid instant.
 */
function startOfDay(day: string, timeZone: string, addDays = 0): Date {
  const [year, month, date] = day.split("-").map(Number);
  const midnightUtc = Date.UTC(year, month - 1, date + addDays);
  const guess = midnightUtc - zoneOffset(midnightUtc, timeZone);
  // A second pass corrects a guess that landed across a daylight saving change.
  return new Date(midnightUtc - zoneOffset(guess, timeZone));
}

/** `createdAt` bounds for an inclusive range of salon days: from the start of `from` to before the day after `to`. */
export function salonDayRange(
  from: string | undefined,
  to: string | undefined,
  timeZone: string = SALON_TIME_ZONE,
): { gte?: Date; lt?: Date } {
  return {
    ...(from && { gte: startOfDay(from, timeZone) }),
    ...(to && { lt: startOfDay(to, timeZone, 1) }),
  };
}

/** The list query: the actor's scope first, then each filter. */
export function invoiceWhere(
  filters: InvoiceFilters,
  actor: Pick<SessionUser, "id" | "role">,
  timeZone: string = SALON_TIME_ZONE,
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};
  if (isOwnScope(actor)) where.employeeId = actor.id;
  else if (filters.employee) where.employeeId = filters.employee;
  if (filters.service) where.serviceId = filters.service;
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) where.createdAt = salonDayRange(filters.from, filters.to, timeZone);
  if (filters.min || filters.max) {
    where.amount = { ...(filters.min && { gte: filters.min }), ...(filters.max && { lte: filters.max }) };
  }
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" } as const;
    where.OR = [
      { invoiceNumber: contains },
      { employee: { name: contains } },
      { employee: { username: contains } },
      { service: { nameEn: contains } },
      { service: { nameAr: contains } },
    ];
  }
  return where;
}

/** A list URL with these filters and page; empty values and page 1 are left out. */
export function invoiceListHref(filters: InvoiceFilters, page = 1): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}
