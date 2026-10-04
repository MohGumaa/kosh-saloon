/**
 * Service catalog input schemas. No database import, so client forms and tests can
 * use them. The permission for each action is checked separately.
 */
import { z } from "zod";
import { SINGLE_LINE_TEXT, normalizeDigitsAndSpaces } from "@/lib/auth/validation";

export const serviceIdSchema = z.string().min(1).max(100);

const nameSchema = z.string().trim().min(1).max(100).regex(SINGLE_LINE_TEXT);

/**
 * Greater than 0 with at most eight whole digits and two decimal places, which fits
 * `Decimal(10, 2)`. Returned in its shortest form ("50.50" becomes "50.5") and kept a
 * string, so it reaches Prisma without passing through a float. Accepts Arabic-Indic
 * digits and the Arabic decimal separator.
 */
export const priceSchema = z
  .string()
  .transform((value) => normalizeDigitsAndSpaces(value).replace("٫", ".").trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0)
      // Exact: the value has at most ten significant digits.
      .transform((value) => String(Number(value))),
  );

export const serviceSchema = z.object({ nameEn: nameSchema, nameAr: nameSchema, defaultPrice: priceSchema });

export type ServiceInput = z.infer<typeof serviceSchema>;
