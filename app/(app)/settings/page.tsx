import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Coins, ImageIcon, Store, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FinancialForm } from "@/components/settings/FinancialForm";
import { InformationForm } from "@/components/settings/InformationForm";
import { LogoForm } from "@/components/settings/LogoForm";
import { requirePermission } from "@/lib/auth/authorize";
import { getSalonSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

const panelClass = "min-w-0 rounded-2xl border bg-card text-card-foreground shadow-card";

// Security and Notifications join these in features 20 and 21.
const TABS = [
  { key: "information", href: "/settings", icon: Store },
  { key: "financial", href: "/settings?tab=financial", icon: Coins },
] as const;

interface PanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}

function Panel({ icon: Icon, title, description, children }: PanelProps) {
  return (
    <section className={panelClass}>
      <div className="flex items-center gap-4 border-b p-5 lg:px-7">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5 lg:p-7">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { permissions } = await requirePermission("settings.view");
  const [{ tab }, t, settings] = await Promise.all([searchParams, getTranslations("settings"), getSalonSettings()]);
  const activeTab = tab === "financial" ? "financial" : "information";
  const readOnly = !permissions.has("settings.edit");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className={panelClass}>
        <div className="p-5 lg:px-7">
          <h1 className="text-2xl font-semibold lg:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          {readOnly && <p className="mt-3 text-sm font-medium">{t("readOnly")}</p>}
        </div>
        <nav aria-label={t("tabs.label")} className="flex gap-2 border-t px-3 lg:px-5">
          {TABS.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={activeTab === key ? "page" : undefined}
              className={cn(
                "-mt-px flex items-center gap-2 border-t-2 px-4 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring",
                activeTab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {t(`tabs.${key}`)}
            </Link>
          ))}
        </nav>
      </section>

      {activeTab === "information" ? (
        <>
          <Panel icon={Store} title={t("information.title")} description={t("information.description")}>
            <InformationForm
              values={{
                name: settings.name,
                licenseNumber: settings.licenseNumber,
                address: settings.address,
                phone: settings.phone,
                email: settings.email,
                taxId: settings.taxId,
              }}
              readOnly={readOnly}
            />
          </Panel>
          <Panel icon={ImageIcon} title={t("logo.title")} description={t("logo.description")}>
            <LogoForm logo={settings.logo} readOnly={readOnly} />
          </Panel>
        </>
      ) : (
        <Panel icon={Coins} title={t("financial.title")} description={t("financial.description")}>
          <FinancialForm
            // A Decimal cannot cross to a client component; its string form can.
            values={{
              currency: settings.currency,
              taxRate: settings.taxRate.toString(),
              employeeSharePercentage: settings.employeeSharePercentage.toString(),
            }}
            readOnly={readOnly}
          />
        </Panel>
      )}
    </div>
  );
}
