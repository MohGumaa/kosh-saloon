import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentSession } from "@/lib/auth/current-user";
import { safeRedirectPath } from "@/lib/auth/validation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reset } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  // A valid session, not just a cookie, so a stale cookie cannot cause a redirect loop.
  if (await getCurrentSession()) redirect(safeRedirectPath(nextPath));

  const t = await getTranslations("auth.login");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={nextPath} resetDone={reset === "1"} />
      </CardContent>
    </Card>
  );
}
