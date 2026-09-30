"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/locales";

type SetLocaleResult = { success: true } | { success: false; error: "invalid_locale" };

export async function setLocale(locale: unknown): Promise<SetLocaleResult> {
  if (!isLocale(locale)) return { success: false, error: "invalid_locale" };

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return { success: true };
}
