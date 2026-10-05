"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { AuthErrorCode } from "@/actions/auth";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { hashPassword } from "@/lib/auth/password";
import { PERMISSION_KEYS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  canChangeEmployeeRole,
  canManageEmployee,
  canManageEmployeeAccess,
  createEmployeeSchema,
  employeeIdSchema,
  employeeShareSchema,
  setEmployeePasswordSchema,
  updateEmployeeSchema,
  type Role,
} from "@/lib/employees";
import { LOGO_MAX_BYTES, detectImageType } from "@/lib/settings-validation";

/** Translation keys under `employees.errors`. */
export type EmployeeErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "unexpected"
  | "file_required"
  | "file_too_large"
  | "file_type"
  | "storage_unavailable";

/** Translation keys under `auth.errors`, as the shared form field shows them. */
export type EmployeeFieldErrorCode = Extract<
  AuthErrorCode,
  "required" | "invalid_input" | "password_mismatch" | "password_length" | "username_taken" | "email_taken"
>;

export type DetailsField = "name" | "username" | "email" | "phone" | "role";
export type PasswordField = "password" | "confirmPassword";

export type EmployeeFormState<Field extends string = never> =
  | { success: true; /** The new employee, after a create. */ id?: string }
  | {
      success: false;
      error: EmployeeErrorCode;
      fieldErrors?: Partial<Record<Field, EmployeeFieldErrorCode>>;
      /** The submitted details, so the form can keep them after React resets the inputs. Never a password. */
      values?: Record<DetailsField, string>;
    }
  | null;

const DETAILS_FIELDS = ["name", "username", "email", "phone", "role"] as const;

function readForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const values = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

function fieldErrorsOf<Field extends string>(error: z.ZodError, raw: Record<string, string>) {
  const fieldErrors: Partial<Record<Field, EmployeeFieldErrorCode>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]) as Field;
    if (fieldErrors[field]) continue;
    if (raw[field]?.trim() === "") fieldErrors[field] = "required";
    else if (issue.code === "custom") fieldErrors[field] = "password_mismatch";
    else if (field === "password") fieldErrors[field] = "password_length";
    else fieldErrors[field] = "invalid_input";
  }
  return fieldErrors;
}

type TakenErrors = Partial<Record<"username" | "email", EmployeeFieldErrorCode>>;

async function takenFields(username: string, email: string, exceptId?: string): Promise<TakenErrors | null> {
  const rows = await db.user.findMany({
    where: { OR: [{ username }, { email }], ...(exceptId && { id: { not: exceptId } }) },
    select: { username: true, email: true },
  });
  const errors: TakenErrors = {};
  if (rows.some((row) => row.username === username)) errors.username = "username_taken";
  if (rows.some((row) => row.email === email)) errors.email = "email_taken";
  return Object.keys(errors).length > 0 ? errors : null;
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

/**
 * Runs a write that stores a username and email. Returns the taken fields instead
 * when another account holds one, including when two requests pass the check
 * together and the unique index decides.
 */
async function writeUnlessTaken(
  write: () => Promise<unknown>,
  username: string,
  email: string,
  exceptId?: string,
): Promise<TakenErrors | null> {
  const taken = await takenFields(username, email, exceptId);
  if (taken) return taken;
  try {
    await write();
    return null;
  } catch (error) {
    const raced = isUniqueViolation(error) ? await takenFields(username, email, exceptId) : null;
    if (raced) return raced;
    throw error;
  }
}

/** A role's default permissions: none for an ADMIN, who holds every key without stored rows. */
async function roleDefaults(tx: Prisma.TransactionClient, role: Role) {
  const keys: readonly PermissionKey[] = role === "ADMIN" ? [] : ROLE_DEFAULTS[role];
  const rows =
    keys.length > 0 ? await tx.permission.findMany({ where: { key: { in: [...keys] } }, select: { id: true } }) : [];
  if (rows.length !== keys.length) throw new Error("permission catalog rows are missing");
  return { keys, permissionIds: rows.map((row) => row.id) };
}

/** The target when the rule lets the actor act on it; otherwise the error to return. */
async function findTarget(actor: SessionUser, userId: string, rule: typeof canManageEmployee) {
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
  if (!target) return "not_found" as const;
  return rule(actor, target) ? target : ("forbidden" as const);
}

function revalidateEmployee(actorId: string, userId: string) {
  // The shared layout shows the actor's own name and image.
  if (userId === actorId) revalidatePath("/", "layout");
  else {
    revalidatePath("/employees");
    revalidatePath(`/employees/${userId}`);
  }
}

export async function createEmployee(
  _prev: EmployeeFormState<DetailsField | PasswordField>,
  formData: FormData,
): Promise<EmployeeFormState<DetailsField | PasswordField>> {
  const { user: actor } = await requireSession();
  const values = readForm(formData, DETAILS_FIELDS);
  const raw = { ...values, ...readForm(formData, ["password", "confirmPassword"] as const) };
  let id = "";

  try {
    if (!(await hasPermission(actor, "employees.create"))) return { success: false, error: "forbidden", values };

    // Only an ADMIN assigns a role; anyone else creates Staff, whatever the form sends.
    if (actor.role !== "ADMIN") raw.role = "STAFF";
    const parsed = createEmployeeSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, raw), values };
    }
    const { name, username, email, phone, role, password } = parsed.data;
    const data = { name, username, email, phone, role };
    const passwordHash = await hashPassword(password);

    const taken = await writeUnlessTaken(
      () =>
        db.$transaction(async (tx) => {
          const { permissionIds } = await roleDefaults(tx, role);
          const user = await tx.user.create({
            data: {
              ...data,
              passwordHash,
              permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
            },
            select: { id: true },
          });
          await recordAudit(
            { userId: actor.id, action: "user.created", entity: "User", entityId: user.id, newValue: data },
            tx,
          );
          id = user.id;
        }),
      username,
      email,
    );
    if (taken) return { success: false, error: "invalid_input", fieldErrors: taken, values };
  } catch (error) {
    console.error("[employees] create failed:", error);
    return { success: false, error: "unexpected", values };
  }

  revalidatePath("/employees");
  return { success: true, id };
}

export async function updateEmployee(
  _prev: EmployeeFormState<DetailsField>,
  formData: FormData,
): Promise<EmployeeFormState<DetailsField>> {
  const { user: actor } = await requireSession();
  const values = readForm(formData, DETAILS_FIELDS);
  const reject = (error: EmployeeErrorCode): EmployeeFormState<DetailsField> => ({ success: false, error, values });
  const userId = employeeIdSchema.safeParse(formData.get("userId"));

  try {
    if (!(await hasPermission(actor, "employees.edit"))) return reject("forbidden");
    if (!userId.success) return reject("invalid_input");

    // The role field is only rendered for an ADMIN; without it the stored role is kept.
    const parsed = updateEmployeeSchema.safeParse({ ...values, role: values.role || undefined });
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, values), values };
    }
    const { role, ...details } = parsed.data;

    const target = await findTarget(actor, userId.data, canManageEmployee);
    if (typeof target === "string") return reject(target);
    if (role && role !== target.role && !canChangeEmployeeRole(actor, target)) return reject("forbidden");

    const taken = await writeUnlessTaken(
      () =>
        db.$transaction(async (tx) => {
          const stored = await tx.user.findUnique({
            where: { id: target.id },
            select: {
              name: true,
              username: true,
              email: true,
              phone: true,
              role: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          });
          if (!stored) throw new Error("the employee has no stored row");

          const next = { ...details, role: role ?? stored.role };
          const changed = DETAILS_FIELDS.filter((field) => stored[field] !== next[field]);
          if (changed.length === 0) return;

          const oldValue: Prisma.InputJsonObject = Object.fromEntries(changed.map((field) => [field, stored[field]]));
          const newValue: Prisma.InputJsonObject = Object.fromEntries(changed.map((field) => [field, next[field]]));
          let permissionChange: { before: PermissionKey[]; after: PermissionKey[] } | undefined;

          if (changed.includes("role")) {
            // A new role starts from its own defaults; grants made for the old role are dropped.
            const held = new Set<string>(stored.permissions.map((row) => row.permission.key));
            const { keys, permissionIds } = await roleDefaults(tx, next.role);
            await tx.userPermission.deleteMany({ where: { userId: target.id } });
            await tx.userPermission.createMany({
              data: permissionIds.map((permissionId) => ({ userId: target.id, permissionId })),
            });
            permissionChange = {
              before: PERMISSION_KEYS.filter((key) => held.has(key)),
              after: PERMISSION_KEYS.filter((key) => keys.includes(key)),
            };
          }

          await tx.user.update({
            where: { id: target.id },
            data: Object.fromEntries(changed.map((field) => [field, next[field]])),
          });
          // A reset link already sent to the old address must stop working.
          if (changed.includes("email")) await tx.passwordResetToken.deleteMany({ where: { userId: target.id } });
          await recordAudit(
            {
              userId: actor.id,
              action: "user.updated",
              entity: "User",
              entityId: target.id,
              oldValue: permissionChange ? { ...oldValue, permissions: permissionChange.before } : oldValue,
              newValue: permissionChange ? { ...newValue, permissions: permissionChange.after } : newValue,
            },
            tx,
          );
        }),
      details.username,
      details.email,
      target.id,
    );
    if (taken) return { success: false, error: "invalid_input", fieldErrors: taken, values };
  } catch (error) {
    console.error("[employees] update failed:", error);
    return reject("unexpected");
  }

  revalidateEmployee(actor.id, userId.data);
  return { success: true };
}

const fail = (error: EmployeeErrorCode): { success: false; error: EmployeeErrorCode } => ({ success: false, error });

/** Deactivating signs the employee out everywhere, so reactivating later revives no old session. */
export async function setEmployeeActive(_prev: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const { user: actor } = await requireSession();
  const userId = employeeIdSchema.safeParse(formData.get("userId"));
  const requested = formData.get("active");

  try {
    if (!(await hasPermission(actor, "employees.activate"))) return fail("forbidden");
    if (!userId.success || (requested !== "true" && requested !== "false")) return fail("invalid_input");
    const isActive = requested === "true";

    const target = await findTarget(actor, userId.data, canManageEmployeeAccess);
    if (typeof target === "string") return fail(target);

    if (target.isActive !== isActive) {
      const where = { userId: target.id };
      await db.$transaction([
        db.user.update({ where: { id: target.id }, data: { isActive } }),
        ...(isActive ? [] : [db.session.deleteMany({ where }), db.passwordResetToken.deleteMany({ where })]),
        recordAudit({
          userId: actor.id,
          action: isActive ? "user.activated" : "user.deactivated",
          entity: "User",
          entityId: target.id,
        }),
      ]);
    }
  } catch (error) {
    console.error("[employees] status change failed:", error);
    return fail("unexpected");
  }

  revalidateEmployee(actor.id, userId.data);
  return { success: true };
}

/** The employee's own share percentage, or none to use the global one. ADMIN only; applies to new calculations. */
export async function setEmployeeShare(
  _prev: EmployeeFormState<"sharePercentage">,
  formData: FormData,
): Promise<EmployeeFormState<"sharePercentage">> {
  const { user: actor } = await requireSession();
  const userId = employeeIdSchema.safeParse(formData.get("userId"));
  const raw = readForm(formData, ["sharePercentage"] as const);

  try {
    if (actor.role !== "ADMIN") return fail("forbidden");
    if (!userId.success) return fail("invalid_input");
    const parsed = employeeShareSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: { sharePercentage: "invalid_input" } };
    }
    const next = parsed.data.sharePercentage;

    const outcome = await db.$transaction(async (tx) => {
      const stored = await tx.user.findUnique({ where: { id: userId.data }, select: { sharePercentage: true } });
      if (!stored) return "not_found" as const;
      const before = stored.sharePercentage;
      // A Decimal: a stored 50 and a submitted "50.00" are the same; 0 is a value, not "none".
      const unchanged = before === null || next === null ? before === next : before.equals(next);
      if (unchanged) return null;

      // Only over the value just read: a save that landed in between fails this one rather than being misaudited.
      const { count } = await tx.user.updateMany({
        where: { id: userId.data, sharePercentage: before },
        data: { sharePercentage: next },
      });
      if (count === 0) throw new Error("share percentage changed during the save");
      await recordAudit(
        {
          userId: actor.id,
          action: "user.share_updated",
          entity: "User",
          entityId: userId.data,
          oldValue: { sharePercentage: before === null ? null : before.toString() },
          newValue: { sharePercentage: next },
        },
        tx,
      );
      return null;
    });
    if (outcome) return fail(outcome);
  } catch (error) {
    console.error("[employees] share change failed:", error);
    return fail("unexpected");
  }

  revalidateEmployee(actor.id, userId.data);
  return { success: true };
}

/** Signs the employee out everywhere; they sign in again with the new password. */
export async function setEmployeePassword(
  _prev: EmployeeFormState<PasswordField>,
  formData: FormData,
): Promise<EmployeeFormState<PasswordField>> {
  const { user: actor } = await requireSession();
  const userId = employeeIdSchema.safeParse(formData.get("userId"));
  const raw = readForm(formData, ["password", "confirmPassword"] as const);

  try {
    if (!(await hasPermission(actor, "employees.edit"))) return fail("forbidden");
    if (!userId.success) return fail("invalid_input");

    const parsed = setEmployeePasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: "invalid_input", fieldErrors: fieldErrorsOf(parsed.error, raw) };
    }

    const target = await findTarget(actor, userId.data, canManageEmployeeAccess);
    if (typeof target === "string") return fail(target);

    const passwordHash = await hashPassword(parsed.data.password);
    const where = { userId: target.id };
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { passwordHash } }),
      db.session.deleteMany({ where }),
      db.passwordResetToken.deleteMany({ where }),
      recordAudit({ userId: actor.id, action: "user.password_set", entity: "User", entityId: target.id }),
    ]);
  } catch (error) {
    console.error("[employees] password set failed:", error);
    return fail("unexpected");
  }

  return { success: true };
}

/** Stores the image URL, or null, with its audit entry. Returns the URL it replaced. */
async function saveImage(actorId: string, userId: string, image: string | null) {
  return db.$transaction(async (tx) => {
    const stored = await tx.user.findUnique({ where: { id: userId }, select: { image: true } });
    if (!stored) throw new Error("the employee has no stored row");

    if (stored.image !== image) {
      await tx.user.update({ where: { id: userId }, data: { image } });
      await recordAudit(
        {
          userId: actorId,
          action: "user.updated",
          entity: "User",
          entityId: userId,
          oldValue: { image: stored.image },
          newValue: { image },
        },
        tx,
      );
    }
    return stored.image;
  });
}

/** Best effort: a blob that cannot be deleted is left behind and logged, and the action still succeeds. */
async function deleteBlob(url: string) {
  try {
    await del(url);
  } catch (error) {
    console.error("[employees] image blob could not be deleted:", error);
  }
}

export async function updateEmployeeImage(_prev: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const { user: actor } = await requireSession();
  const userId = employeeIdSchema.safeParse(formData.get("userId"));

  try {
    if (!(await hasPermission(actor, "employees.edit"))) return fail("forbidden");
    if (!userId.success) return fail("invalid_input");

    const target = await findTarget(actor, userId.data, canManageEmployee);
    if (typeof target === "string") return fail(target);

    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) return fail("file_required");
    if (file.size > LOGO_MAX_BYTES) return fail("file_too_large");
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return fail("file_type");

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[employees] BLOB_READ_WRITE_TOKEN is not set; the image was not uploaded.");
      return fail("storage_unavailable");
    }

    // The path and content type are chosen here; nothing the browser sent names the stored file.
    const blob = await put(`employees/${target.id}.${type.extension}`, bytes, {
      access: "public",
      addRandomSuffix: true,
      contentType: type.contentType,
    });

    let previous: string | null;
    try {
      previous = await saveImage(actor.id, target.id, blob.url);
    } catch (error) {
      await deleteBlob(blob.url);
      throw error;
    }
    if (previous) await deleteBlob(previous);
  } catch (error) {
    console.error("[employees] image upload failed:", error);
    return fail("unexpected");
  }

  revalidateEmployee(actor.id, userId.data);
  return { success: true };
}

export async function removeEmployeeImage(_prev: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const { user: actor } = await requireSession();
  const userId = employeeIdSchema.safeParse(formData.get("userId"));

  try {
    if (!(await hasPermission(actor, "employees.edit"))) return fail("forbidden");
    if (!userId.success) return fail("invalid_input");

    const target = await findTarget(actor, userId.data, canManageEmployee);
    if (typeof target === "string") return fail(target);

    const previous = await saveImage(actor.id, target.id, null);
    if (previous) await deleteBlob(previous);
  } catch (error) {
    console.error("[employees] image removal failed:", error);
    return fail("unexpected");
  }

  revalidateEmployee(actor.id, userId.data);
  return { success: true };
}
