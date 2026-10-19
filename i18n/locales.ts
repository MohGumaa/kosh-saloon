export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The locale stored in a `Cookie` header or `document.cookie` string, else the default. */
export function localeFromCookie(cookieHeader: string): Locale {
  for (const pair of cookieHeader.split(";")) {
    const [name, value] = pair.trim().split("=");
    if (name === LOCALE_COOKIE) return isLocale(value) ? value : DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
