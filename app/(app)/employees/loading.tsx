import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/layout/PageLoading";

export default async function EmployeesLoading() {
  const t = await getTranslations("employees");
  return <PageLoading label={t("loading")} />;
}
