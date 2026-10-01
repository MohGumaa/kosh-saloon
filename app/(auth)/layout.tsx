import { getTranslations } from "next-intl/server";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

/** Signed-out pages: the form on one side and, from `lg`, the brand panel on the other. */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("brand");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-2 p-4 lg:justify-end lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div
              aria-hidden
              className="flex size-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground"
            >
              K
            </div>
            <div>
              <div className="text-sm font-semibold">{t("name")}</div>
              <div className="text-xs text-muted-foreground">{t("tagline")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pt-6 pb-16 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
      <BrandPanel />
    </div>
  );
}
