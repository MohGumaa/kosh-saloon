"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/authorize";
import { requireSession } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { SETTINGS_ID, getSalonSettings } from "@/lib/settings";
import {
  LOGO_MAX_BYTES,
  detectImageType,
  financialSettingsSchema,
  salonInformationSchema,
  type FinancialSettings,
  type SalonInformation,
} from "@/lib/settings-validation";

/** Translation keys under `settings.errors`. */
export type SettingsErrorCode =
  | "forbidden"
  | "invalid_input"
  | "unexpected"
  | "file_required"
  | "file_too_large"
  | "file_type"
  | "storage_unavailable";

export type SettingsFormState<Field extends string = never> =
  | { success: true }
  | {
      success: false;
      error: SettingsErrorCode;
      /** Translation keys under `auth.errors`, as the shared form field shows them. */
      fieldErrors?: Partial<Record<Field, "required" | "invalid_input">>;
      /** The submitted values, so the form can keep them after React resets the inputs. */
      values?: Record<Field, string>;
    }
  | null;

export type InformationField = keyof SalonInformation;
export type FinancialField = keyof FinancialSettings;

type SettingsChanges = Partial<SalonInformation & FinancialSettings & { logo: string | null }>;
type SettingsField = keyof SettingsChanges;

const INFORMATION_FIELDS = ["name", "licenseNumber", "address", "phone", "email", "taxId"] as const;
const FINANCIAL_FIELDS = ["currency", "taxRate", "employeeSharePercentage"] as const;

// `audit.fields.name` and `audit.fields.phone` already label a user's own name and phone.
const AUDIT_KEYS: Partial<Record<SettingsField, string>> = { name: "salonName", phone: "salonPhone" };

/**
 * Stores the fields that differ from the saved row, with their audit entry, in one
 * transaction. Returns the row as it was before the change.
 */
async function saveSettings(userId: string, next: SettingsChanges) {
  return db.$transaction(async (tx) => {
    const stored = await getSalonSettings(tx);
    const changed = (Object.keys(next) as SettingsField[]).filter((field) => {
      const before = stored[field];
      const after = next[field];
      // A Decimal: "50.0" and a stored 50 are the same value.
      return before !== null && typeof before === "object" ? !before.equals(after as string) : before !== after;
    });

    if (changed.length > 0) {
      await tx.salonSettings.update({
        where: { id: SETTINGS_ID },
        data: Object.fromEntries(changed.map((field) => [field, next[field]])),
      });
      await recordAudit(
        {
          userId,
          action: "settings.updated",
          entity: "SalonSettings",
          entityId: SETTINGS_ID,
          oldValue: Object.fromEntries(
            changed.map((field) => [AUDIT_KEYS[field] ?? field, stored[field]?.toString() ?? null]),
          ),
          newValue: Object.fromEntries(changed.map((field) => [AUDIT_KEYS[field] ?? field, next[field] ?? null])),
        },
        tx,
      );
    }
    return stored;
  });
}

async function updateFields<Field extends SettingsField>(
  formData: FormData,
  fields: readonly Field[],
  required: readonly Field[],
  schema: z.ZodType<SettingsChanges>,
): Promise<SettingsFormState<Field>> {
  const { user } = await requireSession();
  const values = Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as Record<Field, string>;

  try {
    if (!(await hasPermission(user, "settings.edit"))) return { success: false, error: "forbidden", values };

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<Field, "required" | "invalid_input">> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        fieldErrors[field] ??= required.includes(field) && values[field].trim() === "" ? "required" : "invalid_input";
      }
      return { success: false, error: "invalid_input", fieldErrors, values };
    }

    await saveSettings(user.id, parsed.data);
  } catch (error) {
    console.error("[settings] update failed:", error);
    return { success: false, error: "unexpected", values };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updateSalonInformation(
  _prev: SettingsFormState<InformationField>,
  formData: FormData,
): Promise<SettingsFormState<InformationField>> {
  return updateFields(formData, INFORMATION_FIELDS, ["name"], salonInformationSchema);
}

export async function updateFinancialSettings(
  _prev: SettingsFormState<FinancialField>,
  formData: FormData,
): Promise<SettingsFormState<FinancialField>> {
  return updateFields(formData, FINANCIAL_FIELDS, FINANCIAL_FIELDS, financialSettingsSchema);
}

const fail = (error: SettingsErrorCode): SettingsFormState => ({ success: false, error });

/** Best effort: a blob that cannot be deleted is left behind and logged, and the action still succeeds. */
async function deleteBlob(url: string) {
  try {
    await del(url);
  } catch (error) {
    console.error("[settings] logo blob could not be deleted:", error);
  }
}

export async function updateSalonLogo(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { user } = await requireSession();

  try {
    if (!(await hasPermission(user, "settings.edit"))) return fail("forbidden");

    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) return fail("file_required");
    if (file.size > LOGO_MAX_BYTES) return fail("file_too_large");
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return fail("file_type");

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[settings] BLOB_READ_WRITE_TOKEN is not set; the logo was not uploaded.");
      return fail("storage_unavailable");
    }

    // The path and content type are chosen here; nothing the browser sent names the stored file.
    const blob = await put(`salon/logo.${type.extension}`, bytes, {
      access: "public",
      addRandomSuffix: true,
      contentType: type.contentType,
    });

    let previous: string | null;
    try {
      previous = (await saveSettings(user.id, { logo: blob.url })).logo;
    } catch (error) {
      await deleteBlob(blob.url);
      throw error;
    }
    if (previous) await deleteBlob(previous);
  } catch (error) {
    console.error("[settings] logo upload failed:", error);
    return fail("unexpected");
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function removeSalonLogo(): Promise<SettingsFormState> {
  const { user } = await requireSession();

  try {
    if (!(await hasPermission(user, "settings.edit"))) return fail("forbidden");

    const previous = (await saveSettings(user.id, { logo: null })).logo;
    if (previous) await deleteBlob(previous);
  } catch (error) {
    console.error("[settings] logo removal failed:", error);
    return fail("unexpected");
  }

  revalidatePath("/settings");
  return { success: true };
}
