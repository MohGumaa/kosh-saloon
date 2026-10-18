"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { updateNotificationSettings, type SettingsFormState } from "@/actions/settings";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CHECKBOX_ON } from "@/lib/settings-validation";

interface NotificationsFormProps {
  loginNotificationsEnabled: boolean;
  /** The viewer may not edit; the server enforces the same rule. */
  readOnly: boolean;
}

export function NotificationsForm({ loginNotificationsEnabled, readOnly }: NotificationsFormProps) {
  const t = useTranslations("settings");
  const hintId = useId();
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateNotificationSettings, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("notifications.success"));
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-9 items-center gap-3 text-sm font-medium has-data-disabled:text-muted-foreground">
          <Checkbox
            // Remount with the saved value after a change, since it starts from defaultChecked.
            key={String(loginNotificationsEnabled)}
            name="loginNotificationsEnabled"
            value={CHECKBOX_ON}
            defaultChecked={loginNotificationsEnabled}
            disabled={readOnly}
            aria-describedby={hintId}
          />
          {t("notifications.loginLabel")}
        </label>
        <p id={hintId} className="ps-7 text-sm text-muted-foreground">
          {t("notifications.loginHint")}
        </p>
      </div>
      {!readOnly && (
        <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
          {pending ? t("submitting") : t("submit")}
        </Button>
      )}
    </form>
  );
}
