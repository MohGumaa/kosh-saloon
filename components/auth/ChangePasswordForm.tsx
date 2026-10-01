"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePassword, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";

/** Reused by the Settings > Security tab in feature 20. */
export function ChangePasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(changePassword, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      {state?.success && <FormMessage tone="success">{t("changePassword.success")}</FormMessage>}
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <FormField
        name="currentPassword"
        type="password"
        label={t("changePassword.currentPassword")}
        autoComplete="current-password"
        required
        error={failure?.fieldErrors?.currentPassword}
      />
      <FormField
        name="newPassword"
        type="password"
        label={t("changePassword.newPassword")}
        autoComplete="new-password"
        required
        error={failure?.fieldErrors?.newPassword}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label={t("confirmPassword")}
        autoComplete="new-password"
        required
        error={failure?.fieldErrors?.confirmPassword}
      />
      <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("changePassword.submitting") : t("changePassword.submit")}
      </Button>
    </form>
  );
}
