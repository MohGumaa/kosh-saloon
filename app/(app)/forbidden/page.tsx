import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/current-user";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forbidden");
  return { title: t("title") };
}

/** Where `requirePermission` sends a signed-in user who lacks a page's permission. */
export default async function ForbiddenPage() {
  await requireSession();
  const t = await getTranslations("forbidden");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldAlert aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-3 h-10")}>
        {t("back")}
      </Link>
    </div>
  );
}
