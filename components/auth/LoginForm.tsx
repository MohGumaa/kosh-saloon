"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { login, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";

interface LoginFormProps {
  next?: string;
  resetDone: boolean;
}

export function LoginForm({ next, resetDone }: LoginFormProps) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      {resetDone && !failure && <FormMessage tone="success">{t("login.resetDone")}</FormMessage>}
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}

      {next && <input type="hidden" name="next" value={next} />}
      <FormField
        // Remount with the submitted value; Base UI inputs reject a changing defaultValue.
        key={failure?.identifier ?? ""}
        name="identifier"
        label={t("login.identifier")}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={failure?.identifier}
        error={failure?.fieldErrors?.identifier}
      />
      <FormField
        name="password"
        type="password"
        label={t("login.password")}
        autoComplete="current-password"
        required
        error={failure?.fieldErrors?.password}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-primary hover:underline">
        {t("login.forgotPassword")}
      </Link>
    </form>
  );
}
