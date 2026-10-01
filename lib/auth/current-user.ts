import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionToken, validateSessionToken, type ValidSession } from "@/lib/auth/session";

/** The signed-in active user's session for this request, or null. */
export const getCurrentSession = cache(async (): Promise<ValidSession | null> => {
  const token = await readSessionToken();
  return token ? validateSessionToken(token) : null;
});

/** Use in every protected page, layout, and Server Action. */
export async function requireSession(): Promise<ValidSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
