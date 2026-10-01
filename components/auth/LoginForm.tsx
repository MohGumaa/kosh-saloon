"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock, User } from "lucide-react";
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
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
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
        icon={User}
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
        icon={Lock}
        autoComplete="current-password"
        required
        error={failure?.fieldErrors?.password}
      />

      <Link href="/forgot-password" className="self-start text-sm text-primary hover:underline">
        {t("login.forgotPassword")}
      </Link>

      <Button type="submit" size="lg" disabled={pending} className="mt-2 h-12 w-full rounded-xl text-base">
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
