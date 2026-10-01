"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { logout } from "@/actions/auth";
import { SidebarNav } from "@/components/layout/SidebarNav";

interface SidebarContentProps {
  onNavigate?: () => void;
}

/** Brand, navigation, and sign-out; shared by the desktop sidebar and mobile drawer. */
export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-3 px-2 py-2">
        <div
          aria-hidden
          className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-lg font-bold text-sidebar-primary-foreground"
        >
          K
        </div>
        <div>
          <div className="text-base font-semibold">{t("brand.name")}</div>
          <div className="text-xs text-sidebar-foreground/60">{t("brand.tagline")}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>

      <div className="flex flex-col gap-3 border-t border-sidebar-border pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => logout())}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring disabled:opacity-60"
        >
          <LogOut aria-hidden className="size-4 shrink-0 rtl:-scale-x-100" />
          {t("auth.userMenu.signOut")}
        </button>
        <div className="px-3 text-xs text-sidebar-foreground/50">{t("brand.footer")}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 border-e border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
      <SidebarContent />
    </aside>
  );
}
