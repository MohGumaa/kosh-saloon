"use client";

import { useActionState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { changePassword, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";

/** Shown on the profile Settings tab; reused by Settings > Security in feature 20. */
export function ChangePasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(changePassword, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {state?.success && <FormMessage tone="success">{t("changePassword.success")}</FormMessage>}
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField
            name="currentPassword"
            type="password"
            label={t("changePassword.currentPassword")}
            icon={Lock}
            autoComplete="current-password"
            required
            error={failure?.fieldErrors?.currentPassword}
          />
        </div>
        <FormField
          name="newPassword"
          type="password"
          label={t("changePassword.newPassword")}
          icon={KeyRound}
          autoComplete="new-password"
          required
          hint={t("passwordHint")}
          error={failure?.fieldErrors?.newPassword}
        />
        <FormField
          name="confirmPassword"
          type="password"
          label={t("confirmPassword")}
          icon={KeyRound}
          autoComplete="new-password"
          required
          error={failure?.fieldErrors?.confirmPassword}
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("changePassword.submitting") : t("changePassword.submit")}
      </Button>
    </form>
  );
}
