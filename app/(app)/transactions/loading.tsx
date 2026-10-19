import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function InvoicesLoading() {
  const t = await getTranslations("invoices");
  return <PageLoading label={t("loading")} />;
}
