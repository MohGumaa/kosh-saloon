"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPermissions } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { PERMISSION_KEYS, changeableKeys, type PermissionKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

/** Translation keys under `permissions.errors`. */
export type PermissionsErrorCode = "forbidden" | "not_found" | "invalid_input" | "unexpected";

export type PermissionsFormState = { success: true } | { success: false; error: PermissionsErrorCode } | null;

const schema = z.object({
  userId: z.string().min(1).max(100),
  permissions: z.array(z.enum(PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]])),
});

const fail = (error: PermissionsErrorCode): PermissionsFormState => ({ success: false, error });

/**
 * Replaces the part of a Supervisor or Staff user's list that the actor may
 * change. A permission the actor may not change keeps its stored value,
 * whatever the form sends.
 */
export async function updateUserPermissions(
  _prev: PermissionsFormState,
  formData: FormData,
): Promise<PermissionsFormState> {
  const { user: actor } = await requireSession();
  const parsed = schema.safeParse({ userId: formData.get("userId"), permissions: formData.getAll("permissions") });
  if (!parsed.success) return fail("invalid_input");
  const { userId } = parsed.data;

  try {
    const actorPermissions = await getPermissions(actor);
    if (!actorPermissions.has("permissions.manage")) return fail("forbidden");

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, permissions: { select: { permission: { select: { key: true } } } } },
    });
    if (!target) return fail("not_found");
    // An ADMIN's permissions are fixed, and nobody edits their own list.
    if (target.role === "ADMIN" || target.id === actor.id) return fail("forbidden");

    const current = new Set(target.permissions.map((row) => row.permission.key));
    const submitted = new Set<string>(parsed.data.permissions);
    const changeable = changeableKeys(actor.role, actorPermissions);
    const toAdd = changeable.filter((key) => submitted.has(key) && !current.has(key));
    const toRemove = changeable.filter((key) => !submitted.has(key) && current.has(key));

    if (toAdd.length > 0 || toRemove.length > 0) {
      const added = await db.permission.findMany({ where: { key: { in: toAdd } }, select: { id: true } });
      if (added.length !== toAdd.length) throw new Error("permission catalog rows are missing");

      await db.$transaction([
        db.userPermission.deleteMany({ where: { userId, permission: { key: { in: toRemove } } } }),
        db.userPermission.createMany({
          data: added.map((permission) => ({ userId, permissionId: permission.id })),
          skipDuplicates: true,
        }),
      ]);
    }
  } catch (error) {
    console.error("[permissions] update failed:", error);
    return fail("unexpected");
  }

  revalidatePath(`/employees/${userId}`);
  return { success: true };
}
