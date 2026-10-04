"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { setEmployeePassword, type EmployeeFormState, type PasswordField } from "@/actions/employees";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

export function EmployeePasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("employees");
  const tAuth = useTranslations("auth");
  const [state, action, pending] = useActionState<EmployeeFormState<PasswordField>, FormData>(
    setEmployeePassword,
    null,
  );
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("password.success"));
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="userId" value={userId} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="password"
          type="password"
          label={t("fields.newPassword")}
          icon={KeyRound}
          autoComplete="new-password"
          required
          hint={tAuth("passwordHint")}
          error={failure?.fieldErrors?.password}
        />
        <FormField
          name="confirmPassword"
          type="password"
          label={tAuth("confirmPassword")}
          icon={KeyRound}
          autoComplete="new-password"
          required
          error={failure?.fieldErrors?.confirmPassword}
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("password.submitting") : t("password.submit")}
      </Button>
    </form>
  );
}
