import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function AccountLoading() {
  const t = await getTranslations("account");
  return <PageLoading label={t("loading")} />;
}
