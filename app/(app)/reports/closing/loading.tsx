import { getTranslations } from "next-intl/server";

const panelClass = "rounded-2xl border bg-card shadow-card";

/** Shown while a month change loads. */
export default async function ClosingStatementLoading() {
  const t = await getTranslations("closingStatement");
  return (
    <div role="status" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="h-14 w-64 animate-pulse rounded-xl bg-muted" />
      <div aria-hidden className="h-11 w-72 animate-pulse rounded-xl bg-muted" />
      <div aria-hidden className={`${panelClass} h-[36rem] animate-pulse`} />
    </div>
  );
}
