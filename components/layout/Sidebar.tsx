"use client";

import { useTranslations } from "next-intl";
import { SidebarNav } from "@/components/layout/SidebarNav";

interface SidebarContentProps {
  onNavigate?: () => void;
}

/** Brand, navigation, and footer; shared by the desktop sidebar and mobile drawer. */
export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const t = useTranslations("brand");

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-3 px-2 py-1">
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

      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>

      <div className="px-2 text-xs text-faint">{t("footer")}</div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 border-e bg-sidebar text-sidebar-foreground lg:block">
      <SidebarContent />
    </aside>
  );
}
