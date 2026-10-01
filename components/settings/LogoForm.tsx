"use client";

import { useActionState, useState, type FormEvent } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { removeSalonLogo, updateSalonLogo, type SettingsFormState } from "@/actions/settings";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_MAX_BYTES } from "@/lib/settings-validation";

interface LogoFormProps {
  /** The stored public URL, or null when no logo was uploaded. */
  logo: string | null;
  /** The viewer may not edit; the server enforces the same rule. */
  readOnly: boolean;
}

export function LogoForm({ logo, readOnly }: LogoFormProps) {
  const t = useTranslations("settings");
  const [uploadState, uploadAction, uploading] = useActionState<SettingsFormState, FormData>(updateSalonLogo, null);
  const [removeState, removeAction, removing] = useActionState<SettingsFormState, FormData>(removeSalonLogo, null);
  const [tooLarge, setTooLarge] = useState(false);
  const { formRef, messageRef } = useFocusOnError(uploadState);
  useSuccessToast(uploadState, t("logo.uploaded"));
  useSuccessToast(removeState, t("logo.removed"));

  const uploadError = tooLarge ? "file_too_large" : uploadState && !uploadState.success ? uploadState.error : null;
  const removeError = removeState && !removeState.success ? removeState.error : null;
  const busy = uploading || removing;

  // A request over the Server Action body limit never reaches the action, so an
  // oversized file is caught here; the server checks the size again.
  function checkSize(event: FormEvent<HTMLFormElement>) {
    const file = new FormData(event.currentTarget).get("logo");
    const over = file instanceof File && file.size > LOGO_MAX_BYTES;
    setTooLarge(over);
    if (over) event.preventDefault();
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {logo ? (
          <Image src={logo} alt={t("logo.alt")} width={112} height={112} className="size-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 p-2 text-center text-xs text-muted-foreground">
            <ImageIcon aria-hidden className="size-6" />
            {t("logo.empty")}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {(uploadError ?? removeError) && (
            <FormMessage ref={messageRef} tone="error">
              {t(`errors.${uploadError ?? removeError}`)}
            </FormMessage>
          )}
          <form ref={formRef} action={uploadAction} onSubmit={checkSize} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="field-logo">{t("logo.file")}</Label>
              <Input
                id="field-logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                aria-describedby="field-logo-hint"
                onChange={() => setTooLarge(false)}
                className="h-12 rounded-xl px-4 py-2.5"
              />
              <p id="field-logo-hint" className="text-xs text-muted-foreground">
                {t("logo.description")}
              </p>
            </div>
            <Button type="submit" size="lg" disabled={busy} className="h-11 self-start rounded-xl px-5">
              {uploading ? t("logo.uploading") : t("logo.upload")}
            </Button>
          </form>
          {logo && (
            <form action={removeAction}>
              <Button type="submit" variant="outline" size="lg" disabled={busy} className="h-11 rounded-xl px-5">
                {removing ? t("logo.removing") : t("logo.remove")}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
