"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";

type ErrorStateProps = {
  /** Next's server log identifier. Opaque, so it is safe to show; the message is not. */
  digest?: string;
  retry: () => void;
  link?: { href: string; label: string };
};

/** The shared body of every error boundary: a generic message, a retry, and a log reference. */
export function ErrorState({ digest, retry, link }: ErrorStateProps) {
  const t = useTranslations("errors");

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-lg font-semibold">{t("genericTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("generic")}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>{t("retry")}</Button>
        {link && (
          <Link href={link.href} className={buttonVariants({ variant: "outline" })}>
            {link.label}
          </Link>
        )}
      </div>
      {digest && (
        <p className="text-xs text-muted-foreground">
          {t("reference")} <span dir="ltr" className="font-mono">{digest}</span>
        </p>
      )}
    </div>
  );
}
