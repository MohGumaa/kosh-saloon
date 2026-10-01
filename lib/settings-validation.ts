import { z } from "zod";
import { PHONE_CHARACTERS, SINGLE_LINE_TEXT, normalizeDigitsAndSpaces } from "@/lib/auth/validation";

const optionalText = (max: number) => z.string().trim().max(max).regex(SINGLE_LINE_TEXT);

/** Optional fields are stored as an empty string, never null. */
export const salonInformationSchema = z.object({
  name: z.string().trim().min(1).max(100).regex(SINGLE_LINE_TEXT),
  licenseNumber: optionalText(50),
  address: optionalText(200),
  phone: z.string().transform(normalizeDigitsAndSpaces).pipe(z.string().trim().max(30).regex(PHONE_CHARACTERS)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.union([z.literal(""), z.email()])),
  taxId: optionalText(50),
});

export type SalonInformation = z.infer<typeof salonInformationSchema>;

/**
 * 0 to 100 with at most two decimal places, returned in its shortest form ("50.0" becomes "50").
 * Accepts Arabic-Indic digits and the Arabic decimal separator.
 */
const percentageSchema = z
  .string()
  .transform((value) => normalizeDigitsAndSpaces(value).replace("٫", ".").trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,3}(\.\d{1,2})?$/)
      .refine((value) => Number(value) <= 100)
      // Exact: the value has at most five significant digits.
      .transform((value) => String(Number(value))),
  );

export const financialSettingsSchema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => Intl.supportedValuesOf("currency").includes(code)),
  taxRate: percentageSchema,
  employeeSharePercentage: percentageSchema,
});

export type FinancialSettings = z.infer<typeof financialSettingsSchema>;

export const LOGO_MAX_BYTES = 1024 * 1024;

export interface ImageType {
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

/** The image type a file's leading bytes declare, whatever its name or reported type says. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", extension: "jpg" };
  // "RIFF", four size bytes, then "WEBP".
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}
