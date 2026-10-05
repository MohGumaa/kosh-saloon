"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateExpense, type ExpenseField, type ExpenseFormState } from "@/actions/expenses";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { ExpenseFields } from "@/components/expenses/ExpenseFields";
import { Button } from "@/components/ui/button";

interface ExpenseEditFormProps {
  id: string;
  /** The stored values: the amount as a decimal string, the date as `YYYY-MM-DD`, no description as "". */
  values: Record<ExpenseField, string>;
  currency: string;
  today: string;
}

export function ExpenseEditForm({ id, values, currency, today }: ExpenseEditFormProps) {
  const t = useTranslations("expenses");
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(updateExpense, null);
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
      <ExpenseFields
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
