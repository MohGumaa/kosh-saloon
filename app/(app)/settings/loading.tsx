import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function SettingsLoading() {
  const t = await getTranslations("settings");
  return <PageLoading label={t("loading")} />;
}
