import type { PermissionKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

export const SETTINGS_ID = "salon";

export type SettingsTab = "information" | "financial" | "security" | "notifications";

/** The tab a `?tab` value opens; Security needs `settings.security`, anything else unknown opens Information. */
export function resolveSettingsTab(tab: string | string[] | undefined, permissions: ReadonlySet<PermissionKey>): SettingsTab {
  if (tab === "financial") return "financial";
  if (tab === "notifications") return "notifications";
  if (tab === "security" && permissions.has("settings.security")) return "security";
  return "information";
}

/** The single settings row, created with the schema defaults the first time it is read. */
export async function getSalonSettings(client: Pick<typeof db, "salonSettings"> = db) {
  const stored = await client.salonSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (stored) return stored;
  // An upsert, so two first reads at the same moment cannot both try to insert.
  return client.salonSettings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } });
}
