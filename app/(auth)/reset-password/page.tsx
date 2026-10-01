import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.reset");

  return (
    <>
      <AuthHeading title={t("title")} description={t("description")} />
      {/* The token is checked when the form is submitted. */}
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </>
  );
}
