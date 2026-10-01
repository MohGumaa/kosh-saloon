import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AtSign,
  CalendarDays,
  Clock,
  KeyRound,
  Languages,
  Mail,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

const panelClass = "min-w-0 rounded-2xl border bg-card text-card-foreground shadow-card";

const TABS = [
  { key: "info", href: "/account", icon: UserRound },
  { key: "settings", href: "/account?tab=settings", icon: Settings },
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

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-[1.125rem]" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const { user } = await requireSession();
  const [{ tab }, t, tAuth, profile] = await Promise.all([
    searchParams,
    getTranslations("account"),
    getTranslations("auth"),
    db.user.findUnique({
      where: { id: user.id },
      select: { username: true, phone: true, lastLoginAt: true, createdAt: true },
    }),
  ]);
  const activeTab = tab === "settings" ? "settings" : "info";

  return (
    <div className="flex w-full flex-col gap-6">
      <section className={cn(panelClass, "overflow-hidden")}>
        <div aria-hidden className="relative h-28 overflow-hidden bg-linear-to-r from-primary to-sidebar lg:h-36">
          <div className="absolute -end-10 -top-16 size-56 rounded-full bg-white/10" />
          <div className="absolute end-40 -bottom-24 size-48 rounded-full bg-white/10" />
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-5 lg:px-7">
          <UserAvatar name={user.name} className="relative -mt-12 size-24 text-3xl ring-4 ring-card lg:size-28" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-2xl font-semibold break-words lg:text-3xl">{user.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <span className="mb-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-medium">
            {tAuth(`roles.${user.role}`)}
          </span>
        </div>

        <nav aria-label={t("tabs.label")} className="mt-5 flex gap-2 border-t px-3 lg:px-5">
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

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {activeTab === "info" ? (
            <Panel icon={UserRound} title={t("info.title")} description={t("info.description")}>
              <ProfileForm name={user.name} phone={profile?.phone ?? ""} />
            </Panel>
          ) : (
            <>
              <Panel
                icon={KeyRound}
                title={tAuth("changePassword.title")}
                description={tAuth("changePassword.description")}
              >
                <ChangePasswordForm />
              </Panel>
              <Panel icon={Languages} title={t("preferences.title")} description={t("preferences.description")}>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <span className="text-sm font-medium">{t("preferences.language")}</span>
                    <LanguageSwitcher />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <span className="text-sm font-medium">{t("preferences.theme")}</span>
                    <ThemeSwitcher />
                  </div>
                </div>
              </Panel>
            </>
          )}
        </div>

        <Panel icon={ShieldCheck} title={t("details.title")} description={t("details.description")}>
          <dl className="-my-4 divide-y">
            <Detail icon={AtSign} label={t("details.username")}>
              <span dir="ltr">{profile?.username}</span>
            </Detail>
            <Detail icon={Mail} label={t("details.email")}>
              <span dir="ltr">{user.email}</span>
            </Detail>
            <Detail icon={ShieldCheck} label={t("details.role")}>
              {tAuth(`roles.${user.role}`)}
            </Detail>
            <Detail icon={Clock} label={t("details.lastSignIn")}>
              {profile?.lastLoginAt ? (
                <LocalDateTime iso={profile.lastLoginAt.toISOString()} timeStyle="short" />
              ) : (
                t("details.never")
              )}
            </Detail>
            {profile && (
              <Detail icon={CalendarDays} label={t("details.memberSince")}>
                <LocalDateTime iso={profile.createdAt.toISOString()} dateStyle="long" />
              </Detail>
            )}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
