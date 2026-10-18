"use server";

import { getCurrentSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { isThemeValue, toStoredTheme } from "@/lib/theme";

type SaveThemeResult = { success: true } | { success: false; error: "invalid_theme" | "unexpected" };

/**
 * Saves the signed-in user's own theme. Signed out, the choice lives only in the browser,
 * so there is nothing to save.
 */
export async function saveThemePreference(theme: unknown): Promise<SaveThemeResult> {
  if (!isThemeValue(theme)) return { success: false, error: "invalid_theme" };

  try {
    const session = await getCurrentSession();
    if (!session) return { success: true };

    await db.user.update({ where: { id: session.user.id }, data: { theme: toStoredTheme(theme) } });
    return { success: true };
  } catch (error) {
    console.error("[preferences] saving the theme failed:", error);
    return { success: false, error: "unexpected" };
  }
}
