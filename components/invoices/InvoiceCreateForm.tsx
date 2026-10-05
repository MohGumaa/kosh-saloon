"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createInvoice, type InvoiceFormState } from "@/actions/invoices";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { InvoiceFields, type InvoiceChoice, type ServiceChoice } from "@/components/invoices/InvoiceFields";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface InvoiceCreateFormProps {
  employees: InvoiceChoice[] | { ownName: string };
  services: ServiceChoice[];
  currency: string;
}

const STATUSES = ["PAID", "UNPAID"] as const;

export function InvoiceCreateForm({ employees, services, currency }: InvoiceCreateFormProps) {
  const t = useTranslations("invoices");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoice, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("create.success"));
  const failure = state && !state.success ? state : null;
  const createdId = state?.success ? state.id : undefined;
  const values = { employeeId: "", serviceId: "", amount: "", status: "", ...failure?.values };
  const statusError = failure?.fieldErrors?.status;

  useEffect(() => {
    if (createdId) router.push(`/transactions/${createdId}`);
  }, [createdId, router]);

  // Radios cannot carry aria-invalid, so when the status is the only problem, focus moves here instead.
  useEffect(() => {
    if (statusError && !formRef.current?.querySelector("[aria-invalid='true']")) {
      formRef.current?.querySelector<HTMLElement>("[role='radio']")?.focus();
    }
  }, [state, statusError, formRef]);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <InvoiceFields
        // A failed submit starts the fields again from the submitted values.
        key={JSON.stringify(values)}
        values={values}
        errors={failure?.fieldErrors}
        employees={employees}
        services={services}
        currency={currency}
        prefillAmount
      />
      <fieldset key={`status:${values.status}`} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("fields.status")}</legend>
        <RadioGroup
          name="status"
          required
          defaultValue={values.status || undefined}
          aria-describedby={statusError ? "field-status-error" : undefined}
          className="flex flex-wrap gap-3"
        >
          {STATUSES.map((status) => (
            <label
              key={status}
              className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm has-data-checked:border-primary has-data-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:text-base"
            >
              <RadioGroupItem value={status} className="focus-visible:ring-0" />
              {t(`statuses.${status}`)}
            </label>
          ))}
        </RadioGroup>
        {statusError && (
          <p id="field-status-error" className="text-sm text-destructive">
            {tAuth(`errors.${statusError}`)}
          </p>
        )}
      </fieldset>
      <Button type="submit" size="lg" disabled={pending || !!createdId} className="h-11 self-start rounded-xl px-5">
        {pending ? t("create.submitting") : t("create.submit")}
      </Button>
    </form>
  );
}
