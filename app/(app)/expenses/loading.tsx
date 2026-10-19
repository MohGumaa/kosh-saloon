import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function ExpensesLoading() {
  const t = await getTranslations("expenses");
  return <PageLoading label={t("loading")} />;
}
