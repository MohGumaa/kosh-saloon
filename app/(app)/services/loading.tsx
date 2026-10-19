import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function ServicesLoading() {
  const t = await getTranslations("services");
  return <PageLoading label={t("loading")} />;
}
