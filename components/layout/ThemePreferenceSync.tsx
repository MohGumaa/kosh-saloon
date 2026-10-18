"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { ThemeValue } from "@/lib/theme";

/**
 * The account's theme wins over a choice this browser kept from before sign-in or from
 * another account. Runs once per page load, so a later switch is not undone.
 */
export function ThemePreferenceSync({ stored }: { stored: ThemeValue }) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme !== stored) setTheme(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
