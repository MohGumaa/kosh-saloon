"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateEmployee, type DetailsField, type EmployeeFormState } from "@/actions/employees";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { EmployeeFields } from "@/components/employees/EmployeeFields";
import { Button } from "@/components/ui/button";

interface EmployeeDetailsFormProps {
  userId: string;
  values: Record<DetailsField, string>;
  /** Only an ADMIN changes a role, and never their own; the server enforces the same rule. */
  canChangeRole: boolean;
}

export function EmployeeDetailsForm({ userId, values: stored, canChangeRole }: EmployeeDetailsFormProps) {
  const t = useTranslations("employees");
  const [state, action, pending] = useActionState<EmployeeFormState<DetailsField>, FormData>(updateEmployee, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("details.success"));
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="userId" value={userId} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <EmployeeFields values={failure?.values ?? stored} errors={failure?.fieldErrors} showRole={canChangeRole} />
      {canChangeRole && <p className="text-sm text-muted-foreground">{t("details.roleNote")}</p>}
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("details.submitting") : t("details.submit")}
      </Button>
    </form>
  );
}
