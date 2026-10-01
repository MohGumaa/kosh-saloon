import { cache } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/current-user";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser, ValidSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const ALL_PERMISSIONS: ReadonlySet<PermissionKey> = new Set(PERMISSION_KEYS);

/** One query per user per request, however many checks a page makes. */
const loadStoredKeys = cache(async (userId: string): Promise<PermissionKey[]> => {
  const rows = await db.userPermission.findMany({
    where: { userId },
    select: { permission: { select: { key: true } } },
  });
  return rows.map((row) => row.permission.key as PermissionKey);
});

/** An ADMIN holds every permission; anyone else holds exactly their stored list. */
export async function getPermissions(user: Pick<SessionUser, "id" | "role">): Promise<ReadonlySet<PermissionKey>> {
  if (user.role === "ADMIN") return ALL_PERMISSIONS;
  return new Set(await loadStoredKeys(user.id));
}

/** For Server Actions: check, then return a `forbidden` result instead of throwing. */
export async function hasPermission(user: Pick<SessionUser, "id" | "role">, key: PermissionKey): Promise<boolean> {
  return (await getPermissions(user)).has(key);
}

export interface AuthorizedSession extends ValidSession {
  permissions: ReadonlySet<PermissionKey>;
}

/** For pages: the session and its permissions, or a redirect to the access-denied page. */
export async function requirePermission(key: PermissionKey): Promise<AuthorizedSession> {
  const session = await requireSession();
  const permissions = await getPermissions(session.user);
  if (!permissions.has(key)) redirect("/forbidden");
  return { ...session, permissions };
}
