import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function AuditLogLoading() {
  const t = await getTranslations("audit");
  return <PageLoading label={t("loading")} />;
}
