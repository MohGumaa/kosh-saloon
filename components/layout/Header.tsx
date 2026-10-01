"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDirection } from "@base-ui/react/direction-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/Sidebar";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { UserMenu, type HeaderUser } from "@/components/layout/UserMenu";

export function Header({ user, navKeys }: { user: HeaderUser; navKeys: string[] }) {
  const t = useTranslations("header");
  const direction = useDirection();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-header items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("openMenu")} />
          }
        >
          <Menu aria-hidden />
        </SheetTrigger>
        {/* The drawer opens from the inline-start edge: left in LTR, right in RTL. */}
        <SheetContent
          side={direction === "rtl" ? "right" : "left"}
          className="bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <SidebarContent navKeys={navKeys} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="ms-auto flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
