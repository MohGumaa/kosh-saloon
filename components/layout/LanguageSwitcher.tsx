"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/actions/locale";
import { LOCALES } from "@/i18n/locales";
import { SegmentedButton } from "@/components/layout/SegmentedButton";

export function LanguageSwitcher() {
  const t = useTranslations("header");
  const current = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(locale: string) {
    if (locale === current) return;
    startTransition(async () => {
      const result = await setLocale(locale);
      if (result.success) router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t("language")} className="flex rounded-lg border bg-muted p-0.5">
      {LOCALES.map((locale) => (
        <SegmentedButton
          key={locale}
          // Each option is labelled in its own language.
          lang={locale}
          pressed={locale === current}
          disabled={isPending}
          onClick={() => choose(locale)}
        >
          {locale.toUpperCase()}
        </SegmentedButton>
      ))}
    </div>
  );
}
