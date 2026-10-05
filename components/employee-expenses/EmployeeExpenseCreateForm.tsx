"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createEmployeeExpense, type EmployeeExpenseFormState } from "@/actions/employee-expenses";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { EmployeeExpenseFields } from "@/components/employee-expenses/EmployeeExpenseFields";
import { Button } from "@/components/ui/button";

interface EmployeeExpenseCreateFormProps {
  employeeId: string;
  currency: string;
  /** The salon's current day, from the server: the date's starting value and its latest choice. */
  today: string;
  /** Without `employee_expenses.view` the detail page is forbidden, so the form clears for another deduction instead. */
  canView: boolean;
}

export function EmployeeExpenseCreateForm({ employeeId, currency, today, canView }: EmployeeExpenseCreateFormProps) {
  const t = useTranslations("employeeExpenses");
  const router = useRouter();
  const [state, action, pending] = useActionState<EmployeeExpenseFormState, FormData>(createEmployeeExpense, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("create.success"));
  const failure = state && !state.success ? state : null;
  const createdId = state?.success && canView ? state.id : undefined;
  const values = { category: "", amount: "", description: "", date: today, ...failure?.values };

  useEffect(() => {
    if (createdId) router.push(`/employees/${employeeId}/expenses/${createdId}`);
  }, [createdId, employeeId, router]);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="employeeId" value={employeeId} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <EmployeeExpenseFields
        // A failed submit starts the fields again from the submitted values.
        key={JSON.stringify(values)}
        values={values}
        errors={failure?.fieldErrors}
        currency={currency}
        today={today}
      />
      <Button type="submit" size="lg" disabled={pending || !!createdId} className="h-11 self-start rounded-xl px-5">
        {pending ? t("create.submitting") : t("create.submit")}
      </Button>
    </form>
  );
}
