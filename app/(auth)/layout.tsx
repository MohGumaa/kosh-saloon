import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

/** Signed-out pages: a centered card with the brand and the language/theme switchers. */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("brand");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end gap-2 p-4">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground"
          >
            K
          </div>
          <div>
            <div className="font-semibold">{t("name")}</div>
            <div className="text-xs text-muted-foreground">{t("tagline")}</div>
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
