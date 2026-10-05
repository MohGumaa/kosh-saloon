"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  updateEmployeeExpense,
  type EmployeeExpenseField,
  type EmployeeExpenseFormState,
} from "@/actions/employee-expenses";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { EmployeeExpenseFields } from "@/components/employee-expenses/EmployeeExpenseFields";
import { Button } from "@/components/ui/button";

interface EmployeeExpenseEditFormProps {
  id: string;
  /** The stored values: the amount as a decimal string, the date as `YYYY-MM-DD`, no description as "". */
  values: Record<EmployeeExpenseField, string>;
  currency: string;
  today: string;
}

export function EmployeeExpenseEditForm({ id, values, currency, today }: EmployeeExpenseEditFormProps) {
  const t = useTranslations("employeeExpenses");
  const [state, action, pending] = useActionState<EmployeeExpenseFormState, FormData>(updateEmployeeExpense, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("edit.success"));
  const failure = state && !state.success ? state : null;
  const shown = { ...values, ...failure?.values };

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <EmployeeExpenseFields
        // Start again from the submitted values after a failure, or the saved ones after a save.
        key={JSON.stringify(shown)}
        values={shown}
        errors={failure?.fieldErrors}
        currency={currency}
        today={today}
      />
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("edit.submitting") : t("edit.submit")}
      </Button>
    </form>
  );
}
