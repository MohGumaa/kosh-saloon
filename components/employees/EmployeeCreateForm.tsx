"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createEmployee,
  type DetailsField,
  type EmployeeFormState,
  type PasswordField,
} from "@/actions/employees";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { EmployeeFields } from "@/components/employees/EmployeeFields";
import { Button } from "@/components/ui/button";

interface EmployeeCreateFormProps {
  /** Only an ADMIN assigns a role; anyone else creates Staff. The server enforces the same rule. */
  canAssignRole: boolean;
  /** Whether the viewer may open the new employee's profile afterwards. */
  canView: boolean;
}

const EMPTY: Record<DetailsField, string> = { name: "", username: "", email: "", phone: "", role: "STAFF" };

export function EmployeeCreateForm({ canAssignRole, canView }: EmployeeCreateFormProps) {
  const t = useTranslations("employees");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [state, action, pending] = useActionState<EmployeeFormState<DetailsField | PasswordField>, FormData>(
    createEmployee,
    null,
  );
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("create.success"));
  const failure = state && !state.success ? state : null;
  const createdId = state?.success ? state.id : undefined;

  useEffect(() => {
    if (createdId && canView) router.push(`/employees/${createdId}`);
  }, [createdId, canView, router]);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <EmployeeFields values={failure?.values ?? EMPTY} errors={failure?.fieldErrors} showRole={canAssignRole} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="password"
          type="password"
          label={t("fields.password")}
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
        {pending ? t("create.submitting") : t("create.submit")}
      </Button>
    </form>
  );
}
