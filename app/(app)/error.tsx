"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold">{t("genericTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("generic")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
