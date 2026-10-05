"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createExpense, type ExpenseFormState } from "@/actions/expenses";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { ExpenseFields } from "@/components/expenses/ExpenseFields";
import { Button } from "@/components/ui/button";

interface ExpenseCreateFormProps {
  currency: string;
  /** The salon's current day, from the server: the date's starting value and its latest choice. */
  today: string;
  /** Without `expenses.view` the detail page is forbidden, so the form clears for another expense instead. */
  canView: boolean;
}

export function ExpenseCreateForm({ currency, today, canView }: ExpenseCreateFormProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(createExpense, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("create.success"));
  const failure = state && !state.success ? state : null;
  const createdId = state?.success && canView ? state.id : undefined;
  const values = { title: "", description: "", category: "", amount: "", date: today, ...failure?.values };

  useEffect(() => {
    if (createdId) router.push(`/expenses/${createdId}`);
  }, [createdId, router]);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <ExpenseFields
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
