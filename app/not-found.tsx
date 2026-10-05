import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title") };
}

/** Shown for any unmatched URL and for `notFound()` calls without a closer `not-found` file. */
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-end gap-2 p-4 lg:px-8">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion aria-hidden className="size-6" />
          </span>
          <p className="text-5xl font-bold tracking-tight text-primary">404</p>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-3 h-10")}>
            {t("back")}
          </Link>
        </div>
      </main>
    </div>
  );
}
