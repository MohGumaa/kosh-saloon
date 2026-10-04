import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Toaster } from "@/components/ui/sonner";
import { getDirection, isLocale, DEFAULT_LOCALE } from "@/i18n/locales";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
});

/**
 * One stack for both languages. Inter has no Arabic glyphs, so the browser draws Latin text
 * in Inter and Arabic text in Tajawal, whatever the page language. Both real fonts come
 * before both metric fallbacks: Inter's fallback is Arial, which has Arabic glyphs and
 * would otherwise draw Arabic text before Tajawal.
 */
function bodyFontStack(...fonts: { style: { fontFamily: string } }[]): string {
  const families = fonts.map((font) => font.style.fontFamily.split(",").map((name) => name.trim()));
  return [
    ...families.map(([primary]) => primary),
    ...families.flatMap(([, ...fallbacks]) => fallbacks),
    "system-ui",
    "-apple-system",
    '"Segoe UI"',
    "sans-serif",
  ].join(", ");
}

const BODY_FONT = bodyFontStack(inter, tajawal);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const requestLocale = await getLocale();
  const locale = isLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;
  const dir = getDirection(locale);
  const t = await getTranslations("toast");

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${tajawal.variable} h-full antialiased`}
      style={{ "--font-body": BODY_FONT } as CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <DirectionProvider direction={dir}>{children}</DirectionProvider>
            <Toaster dir={dir} position="top-center" containerAriaLabel={t("label")} />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
