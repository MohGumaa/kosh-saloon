"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { removeEmployeeImage, updateEmployeeImage, type EmployeeErrorCode } from "@/actions/employees";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_MAX_BYTES } from "@/lib/settings-validation";

interface EmployeeImageFormProps {
  userId: string;
  name: string;
  /** The stored public URL, or null when no image was uploaded. */
  image: string | null;
}

interface ImageResult {
  success: boolean;
  error?: EmployeeErrorCode;
  removed: boolean;
}

/** One result for both forms, so an error from either is replaced by the next result of either. */
async function submitImage(_prev: ImageResult | null, formData: FormData): Promise<ImageResult> {
  const removed = formData.get("intent") === "remove";
  if (!removed) {
    // A request over the Server Action body limit never reaches the action, so an
    // oversized file is caught here; the server checks the size again.
    const file = formData.get("image");
    if (file instanceof File && file.size > LOGO_MAX_BYTES) return { success: false, error: "file_too_large", removed };
  }
  const result = await (removed ? removeEmployeeImage : updateEmployeeImage)(null, formData);
  return result?.success ? { success: true, removed } : { success: false, error: result?.error ?? "unexpected", removed };
}

export function EmployeeImageForm({ userId, name, image }: EmployeeImageFormProps) {
  const t = useTranslations("employees");
  const [state, action, pending] = useActionState(submitImage, null);
  const [removing, setRemoving] = useState(false);
  const { messageRef } = useFocusOnError(state);
  useSuccessToast(state, t(state?.removed ? "image.removed" : "image.uploaded"));

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <UserAvatar name={name} image={image} className="size-28 text-3xl" />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {state?.error && (
          <FormMessage ref={messageRef} tone="error">
            {t(`errors.${state.error}`)}
          </FormMessage>
        )}
        <form action={action} onSubmit={() => setRemoving(false)} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="field-image">{t("image.file")}</Label>
            <Input
              id="field-image"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              aria-describedby="field-image-hint"
              className="h-12 rounded-xl px-4 py-2.5"
            />
            <p id="field-image-hint" className="text-xs text-muted-foreground">
              {t("image.description")}
            </p>
          </div>
          <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
            {pending && !removing ? t("image.uploading") : t("image.upload")}
          </Button>
        </form>
        {image && (
          <form action={action} onSubmit={() => setRemoving(true)}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="intent" value="remove" />
            <Button type="submit" variant="outline" size="lg" disabled={pending} className="h-11 rounded-xl px-5">
              {pending && removing ? t("image.removing") : t("image.remove")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
