import { getTranslations } from "next-intl/server";

const panelClass = "rounded-2xl border bg-card shadow-card";

/** Shown while a period change loads. */
export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");
  return (
    <div role="status" className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className={`${panelClass} h-28 animate-pulse`} />
      <div aria-hidden className={`${panelClass} h-24 animate-pulse`} />
      <div aria-hidden className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={`${panelClass} h-32 animate-pulse`} />
        ))}
      </div>
      <div aria-hidden className={`${panelClass} h-80 animate-pulse`} />
    </div>
  );
}
