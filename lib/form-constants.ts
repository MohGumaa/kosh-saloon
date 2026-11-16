/**
 * Plain values that client forms need. This module has no imports on purpose: the
 * `lib/` modules that define them for the server also build zod schemas, and a client
 * import from those modules ships the whole of zod to the browser. Those modules
 * re-export these values, so server code can keep importing them from there.
 */

export const ROLES = ["ADMIN", "SUPERVISOR", "STAFF"] as const;

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

export const EMPLOYEE_EXPENSE_CATEGORIES = [
  "CASH_ADVANCE",
  "ADVANCE_SALARY",
  "WITHDRAWAL",
  "PERSONAL_PURCHASE",
  "OTHER",
] as const;

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;

/** The most invoices one create can add. */
export const MAX_INVOICES_PER_CREATE = 20;

/** The value a settings checkbox submits when checked; an unchecked box submits nothing. */
export const CHECKBOX_ON = "true";

export const LOGO_MAX_BYTES = 1024 * 1024;
