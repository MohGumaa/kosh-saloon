"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateInvoice, type InvoiceFormState } from "@/actions/invoices";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { InvoiceFields, type InvoiceChoice, type ServiceChoice } from "@/components/invoices/InvoiceFields";
import { Button } from "@/components/ui/button";

interface InvoiceEditFormProps {
  id: string;
  /** The stored values, the amount as a decimal string. */
  values: Record<"employeeId" | "serviceId" | "amount", string>;
  employees: InvoiceChoice[];
  services: ServiceChoice[];
  currency: string;
}

export function InvoiceEditForm({ id, values, employees, services, currency }: InvoiceEditFormProps) {
  const t = useTranslations("invoices");
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(updateInvoice, null);
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
      <InvoiceFields
        // Start again from the submitted values after a failure, or the saved ones after a save.
        key={JSON.stringify(shown)}
        values={shown}
        errors={failure?.fieldErrors}
        employees={employees}
        services={services}
        currency={currency}
      />
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("edit.submitting") : t("edit.submit")}
      </Button>
    </form>
  );
}
