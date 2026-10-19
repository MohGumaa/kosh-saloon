"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState digest={error.digest} retry={retry} link={{ href: "/dashboard", label: t("backToDashboard") }} />;
}
