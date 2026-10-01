"use server";

import { revalidatePath } from "next/cache";
import type { AuthErrorCode } from "@/actions/auth";
import { requireSession } from "@/lib/auth/current-user";
import { profileSchema } from "@/lib/auth/validation";
import { db } from "@/lib/db";

type ProfileField = "name" | "phone";

export type ProfileFormState =
  | { success: true }
  | {
      success: false;
      error: AuthErrorCode;
      fieldErrors?: Partial<Record<ProfileField, AuthErrorCode>>;
      /** The submitted values, so the form can keep them after React resets the inputs. */
      values: Record<ProfileField, string>;
    }
  | null;

/** Updates the signed-in user's own name and phone; nothing else is writable here. */
export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { user } = await requireSession();
  const read = (key: ProfileField) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const values = { name: read("name"), phone: read("phone") };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ProfileField, AuthErrorCode>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ProfileField;
      fieldErrors[field] ??= values[field].trim() === "" ? "required" : "invalid_input";
    }
    return { success: false, error: "invalid_input", fieldErrors, values };
  }

  try {
    await db.user.update({ where: { id: user.id }, data: parsed.data });
  } catch (error) {
    console.error("[account] profile update failed:", error);
    return { success: false, error: "unexpected", values };
  }

  // The header in the shared layout shows the name.
  revalidatePath("/", "layout");
  return { success: true };
}
