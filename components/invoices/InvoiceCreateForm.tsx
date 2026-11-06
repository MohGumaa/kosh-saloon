"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import { createInvoice, type InvoiceFormState } from "@/actions/invoices";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { InvoiceFields, type InvoiceChoice, type ServiceChoice } from "@/components/invoices/InvoiceFields";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MAX_INVOICES_PER_CREATE } from "@/lib/invoices";

interface InvoiceCreateFormProps {
  employees: InvoiceChoice[] | { ownName: string };
  services: ServiceChoice[];
  currency: string;
  /** The salon's current day, `YYYY-MM-DD`: the default and latest invoice day. */
  today: string;
}

const STATUSES = ["PAID", "UNPAID"] as const;

export function InvoiceCreateForm({ employees, services, currency, today }: InvoiceCreateFormProps) {
  const t = useTranslations("invoices");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoice, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const createdCount = state?.success ? (state.count ?? 1) : 1;
  useSuccessToast(state, t("create.success", { count: createdCount }));
  const failure = state && !state.success ? state : null;
  const createdId = state?.success ? state.id : undefined;
  const values = {
    employeeId: "",
    serviceId: "",
    amount: "",
    // Most invoices are paid at the time of service.
    status: "PAID",
    date: today,
    count: "1",
    ...failure?.values,
  };
  const statusError = failure?.fieldErrors?.status;
  const dateError = failure?.fieldErrors?.date;

  useEffect(() => {
    // One invoice opens its details; several are easiest to check in the list, newest first.
    if (createdId) router.push(createdCount === 1 ? `/transactions/${createdId}` : "/transactions");
  }, [createdId, createdCount, router]);

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
        // Only these three: a `date` here would add the edit form's date-and-time field.
        values={{ employeeId: values.employeeId, serviceId: values.serviceId, amount: values.amount }}
        errors={failure?.fieldErrors}
        employees={employees}
        services={services}
        currency={currency}
        prefillAmount
      >
        {/* The day sits next to the amount; the key above remounts it after a failed submit. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="field-date">{t("fields.day")}</Label>
          <DatePicker
            id="field-date"
            name="date"
            max={today}
            defaultValue={values.date}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? "field-date-error field-date-hint" : "field-date-hint"}
            className="h-12 px-4 md:text-base"
          />
          <p id="field-date-hint" className="text-xs text-muted-foreground">
            {t("fields.dayHint")}
          </p>
          {dateError && (
            <p id="field-date-error" className="text-sm text-destructive">
              {tAuth(`errors.${dateError}`)}
            </p>
          )}
        </div>
      </InvoiceFields>
      <div key={`count:${values.count}`} className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="count"
          label={t("fields.count")}
          icon={Hash}
          autoComplete="off"
          inputMode="numeric"
          maxLength={2}
          spellCheck={false}
          required
          dir="ltr"
          defaultValue={values.count}
          hint={t("fields.countHint", { max: MAX_INVOICES_PER_CREATE })}
          error={failure?.fieldErrors?.count}
        />
      </div>
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
