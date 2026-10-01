"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { resetPassword, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const failure = state && !state.success ? state : null;

  if (!token || failure?.error === "invalid_token") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage ref={messageRef} tone="error">
          {t("errors.invalid_token")}
        </FormMessage>
        <Link href="/forgot-password" className="text-center text-sm text-primary hover:underline">
          {t("reset.requestNew")}
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
      <input type="hidden" name="token" value={token} />
      <FormField
        name="password"
        type="password"
        label={t("reset.password")}
        icon={Lock}
        autoComplete="new-password"
        required
        error={failure?.fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label={t("confirmPassword")}
        icon={Lock}
        autoComplete="new-password"
        required
        error={failure?.fieldErrors?.confirmPassword}
      />
      <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
      <Button type="submit" size="lg" disabled={pending} className="mt-2 h-12 w-full rounded-xl text-base">
        {pending ? t("reset.submitting") : t("reset.submit")}
      </Button>
    </form>
  );
}
