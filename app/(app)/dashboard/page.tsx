import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  await requireSession();
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-card">
        <h2 className="text-lg font-semibold">{t("placeholderTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("placeholder")}</p>
      </section>
    </div>
  );
}
