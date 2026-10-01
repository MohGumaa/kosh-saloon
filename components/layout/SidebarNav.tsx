"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { visibleNavGroups, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  /** Keys of the items this user may see, decided on the server. */
  navKeys: string[];
  /** Called after a link is followed, so the mobile drawer can close. */
  onNavigate?: () => void;
}

const itemClass =
  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring";

export function SidebarNav({ navKeys, onNavigate }: SidebarNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const groups = visibleNavGroups(navKeys);

  function renderItem(item: NavItem, isSubItem: boolean) {
    const Icon = item.icon;
    const content = (
      <>
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        <span className="truncate">{t(item.key)}</span>
      </>
    );
    const indent = isSubItem ? "ps-10" : undefined;

    if (!item.href) {
      return (
        <span
          aria-disabled="true"
          title={t("comingSoon")}
          className={cn(itemClass, indent, "cursor-not-allowed text-sidebar-foreground/45")}
        >
          {content}
          <span className="sr-only">({t("comingSoon")})</span>
        </span>
      );
    }

    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          itemClass,
          indent,
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <nav aria-label={t("label")} className="flex flex-col gap-1">
      {groups.map((group, index) => (
        <div key={group.key ?? index} className="flex flex-col gap-1">
          {group.key ? (
            <div className="mt-4 mb-1 px-3 text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase rtl:tracking-normal rtl:normal-case">
              {t(`groups.${group.key}`)}
            </div>
          ) : null}
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.key}>{renderItem(item, !item.icon)}</li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
