"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/layout/UserAvatar";

export interface HeaderUser {
  name: string;
  role: "ADMIN" | "SUPERVISOR" | "STAFF";
  image: string | null;
}

export function UserMenu({ user }: { user: HeaderUser }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-11 gap-2.5 px-2"
            aria-label={t("userMenu.label", { name: user.name })}
          />
        }
      >
        <UserAvatar name={user.name} image={user.image} />
        <span className="hidden max-w-40 flex-col text-start leading-tight sm:flex">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{t(`roles.${user.role}`)}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
            <UserAvatar name={user.name} image={user.image} className="size-10" />
            <div className="min-w-0">
              <div className="truncate text-sm text-foreground">{user.name}</div>
              <div className="font-normal">{t(`roles.${user.role}`)}</div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem render={<Link href="/account" />} className="gap-3 rounded-lg px-3 py-2.5">
          <UserRound aria-hidden />
          {t("userMenu.profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(() => logout())}
          className="gap-3 rounded-lg px-3 py-2.5"
        >
          <LogOut aria-hidden />
          {t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
