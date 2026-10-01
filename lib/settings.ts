import { db } from "@/lib/db";

export const SETTINGS_ID = "salon";

/** The single settings row, created with the schema defaults the first time it is read. */
export async function getSalonSettings(client: Pick<typeof db, "salonSettings"> = db) {
  const stored = await client.salonSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (stored) return stored;
  // An upsert, so two first reads at the same moment cannot both try to insert.
  return client.salonSettings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } });
}
