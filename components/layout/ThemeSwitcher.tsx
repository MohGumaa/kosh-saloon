"use client";

import { useSyncExternalStore, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveThemePreference } from "@/actions/preferences";
import { SegmentedButton } from "@/components/layout/SegmentedButton";
import type { ThemeValue } from "@/lib/theme";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeSwitcher() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render no pressed state on the server.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [, startTransition] = useTransition();

  // Applied at once in this browser, then saved to the account (a no-op when signed out).
  function choose(value: ThemeValue) {
    setTheme(value);
    startTransition(async () => {
      const result = await saveThemePreference(value).catch(() => null);
      if (!result?.success) toast.error(t("theme.saveFailed"));
    });
  }

  return (
    <div role="group" aria-label={t("header.theme")} className="flex rounded-lg border bg-muted p-0.5">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <SegmentedButton
          key={value}
          aria-label={t(`theme.${value}`)}
          title={t(`theme.${value}`)}
          pressed={mounted && theme === value}
          onClick={() => choose(value)}
        >
          <Icon className="size-3.5" aria-hidden />
        </SegmentedButton>
      ))}
    </div>
  );
}
