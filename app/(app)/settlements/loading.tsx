import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function SettlementsLoading() {
  const t = await getTranslations("settlements");
  return <PageLoading label={t("loading")} />;
}
