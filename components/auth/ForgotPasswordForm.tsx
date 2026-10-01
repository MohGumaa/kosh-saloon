"use client";

import { useActionState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { requestPasswordReset, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const failure = state && !state.success ? state : null;

  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">{t("forgot.sent")}</FormMessage>
        <Link href="/login" className="text-center text-sm text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <FormField
        // Remount with the submitted value; Base UI inputs reject a changing defaultValue.
        key={failure?.identifier ?? ""}
        name="identifier"
        label={t("login.identifier")}
        icon={User}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={failure?.identifier}
        error={failure?.fieldErrors?.identifier}
      />
      <Button type="submit" size="lg" disabled={pending} className="mt-2 h-12 w-full rounded-xl text-base">
        {pending ? t("forgot.submitting") : t("forgot.submit")}
      </Button>
      <Link href="/login" className="text-center text-sm text-primary hover:underline">
        {t("backToLogin")}
      </Link>
    </form>
  );
}
