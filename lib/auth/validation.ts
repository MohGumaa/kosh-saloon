import { z } from "zod";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Trimmed and lowercased, as username and email are stored. */
export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/** An identifier containing `@` is matched against email, otherwise username. */
export function identifierWhere(identifier: string): { email: string } | { username: string } {
  return identifier.includes("@") ? { email: identifier } : { username: identifier };
}

export const identifierSchema = z.string().transform(normalizeIdentifier).pipe(z.string().min(1).max(254));

export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

export const loginSchema = z.object({
  identifier: identifierSchema,
  // Any non-empty submitted password is checked; length rules apply when setting one.
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const forgotPasswordSchema = z.object({ identifier: identifierSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(1).max(200), password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ["confirmPassword"] });

/** Never contains `@`, which marks an identifier as an email at sign-in. */
export const usernameSchema = identifierSchema.pipe(z.string().regex(/^[a-z0-9._-]+$/));

export const emailSchema = identifierSchema.pipe(z.email());

export const seedAdminSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** Arabic-Indic and Extended Arabic-Indic digits become 0-9, and any Unicode space a plain space. */
export function normalizeDigitsAndSpaces(value: string): string {
  // Both digit blocks start at a multiple of 16, so the low four bits are the digit's value.
  return value.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 0xf)).replace(/\p{Zs}/gu, " ");
}

/**
 * No control, format, or line and paragraph separator characters, except the zero-width
 * joiners some Arabic-script names use.
 */
export const SINGLE_LINE_TEXT = /^(?:[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|[‌‍])*$/u;

export const PHONE_CHARACTERS = /^[0-9+() -]*$/;

/** What a user may change about their own account; an empty phone is stored as null. */
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/\p{L}/u)
    .regex(SINGLE_LINE_TEXT),
  phone: z
    .string()
    .transform(normalizeDigitsAndSpaces)
    .pipe(
      z
        .string()
        .trim()
        .max(30)
        .regex(PHONE_CHARACTERS)
        .transform((value) => value || null),
    ),
});

export const DEFAULT_REDIRECT = "/dashboard";

const REDIRECT_BASE = "http://n";

/** Allows only same-origin absolute paths; anything else falls back to the dashboard. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return DEFAULT_REDIRECT;
  // Browsers read `\` as `/` and drop tabs and newlines, so `/<TAB>/evil.com` would leave the site.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_REDIRECT;

  try {
    const url = new URL(value, REDIRECT_BASE);
    if (url.origin !== REDIRECT_BASE) return DEFAULT_REDIRECT;
    // Dot segments are removed while parsing, so `/.//evil.com` becomes the protocol-relative `//evil.com`.
    if (url.pathname.startsWith("//")) return DEFAULT_REDIRECT;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
