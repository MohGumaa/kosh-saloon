"use client";

import { useEffect, useSyncExternalStore } from "react";
import { NextIntlClientProvider } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";
import { DEFAULT_LOCALE, getDirection, localeFromCookie, type Locale } from "@/i18n/locales";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";
import "./globals.css";

const ERROR_MESSAGES = { en: { errors: en.errors }, ar: { errors: ar.errors } } as const;

// The cookie and stored theme are read once; nothing here changes while the page is open.
const subscribe = () => () => {};

/** next-themes' stored choice, falling back to the OS scheme for `system` or no choice. */
function prefersDark(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("theme");
  } catch {
    // Storage can be blocked; the OS scheme still applies.
  }
  if (stored === "dark" || stored === "light") return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Replaces the root layout when it fails, so it brings its own document, styles,
 * translations, and theme: none of the root layout's providers exist here.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Browser-only reads; the server snapshot keeps the first render hydration-safe.
  const locale = useSyncExternalStore<Locale>(subscribe, () => localeFromCookie(document.cookie), () => DEFAULT_LOCALE);
  const dark = useSyncExternalStore(subscribe, prefersDark, () => false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const messages = ERROR_MESSAGES[locale];

  return (
    <html lang={locale} dir={getDirection(locale)} className={dark ? "dark" : undefined}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <title>{messages.errors.genericTitle}</title>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <main className="flex min-h-dvh items-center justify-center px-4">
            <ErrorState digest={error.digest} retry={retry} />
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
