"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InvoiceField, InvoiceFieldErrorCode } from "@/actions/invoices";
import { FormField } from "@/components/auth/FormField";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSelect, fieldSelectClass } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface InvoiceChoice {
  id: string;
  /** Already in the viewer's language. */
  name: string;
  /** False only for the invoice's current, since deactivated, choice on edit. */
  isActive: boolean;
}

export interface ServiceChoice extends InvoiceChoice {
  /** A decimal string; a Decimal never reaches the client. */
  defaultPrice: string;
}

interface InvoiceFieldsProps {
  /** `date` is a salon-time `YYYY-MM-DDTHH:mm` value; given only on edit, where the date can move. */
  values: Record<"employeeId" | "serviceId" | "amount", string> & { date?: string };
  /** The salon's current day; the latest date the picker offers. The server enforces the full time. */
  today?: string;
  errors?: Partial<Record<InvoiceField, InvoiceFieldErrorCode>>;
  /** The choosable employees, or the actor's own name for a Staff user, who invoices only themself. */
  employees: InvoiceChoice[] | { ownName: string };
  services: ServiceChoice[];
  currency: string;
  /** On create, choosing a service fills the amount with its default price. */
  prefillAmount?: boolean;
}

interface SelectFieldProps {
  name: "employeeId" | "serviceId";
  label: string;
  placeholder: string;
  choices: InvoiceChoice[];
  defaultValue: string;
  error?: InvoiceFieldErrorCode;
  onChange?: (id: string) => void;
}

function SelectField({ name, label, placeholder, choices, defaultValue, error, onChange }: SelectFieldProps) {
  const t = useTranslations("invoices.fields");
  const tAuth = useTranslations("auth");
  const id = `field-${name}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <FormSelect
        // Remount with the latest value after a failed submit resets the form.
        key={`${name}:${defaultValue}`}
        id={id}
        name={name}
        required
        defaultValue={defaultValue}
        placeholder={placeholder}
        options={choices.map((choice) => ({
          value: choice.id,
          label: choice.isActive ? choice.name : t("inactive", { name: choice.name }),
        }))}
        onValueChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldSelectClass}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {tAuth(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}

interface DateTimeFieldProps {
  defaultValue: string;
  today?: string;
  error?: InvoiceFieldErrorCode;
}

/** A calendar day and a time, submitted together as one `date` value in `YYYY-MM-DDTHH:mm` form. */
function DateTimeField({ defaultValue, today, error }: DateTimeFieldProps) {
  const t = useTranslations("invoices.fields");
  const tAuth = useTranslations("auth");
  const [day, setDay] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16));
  const describedBy = error ? "field-date-error field-date-hint" : "field-date-hint";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="field-date">{t("date")}</Label>
      <input type="hidden" name="date" value={`${day}T${time}`} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <DatePicker
          id="field-date"
          max={today}
          defaultValue={day}
          onValueChange={setDay}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 px-4 md:text-base"
        />
        <Input
          type="time"
          aria-label={t("time")}
          required
          dir="ltr"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 rounded-xl px-4 md:text-base"
        />
      </div>
      <p id="field-date-hint" className="text-xs text-muted-foreground">
        {t("dateHint")}
      </p>
      {error && (
        <p id="field-date-error" className="text-sm text-destructive">
          {tAuth(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}

/** The employee, service, and amount inputs shared by the create and edit forms. */
export function InvoiceFields({ values, errors, employees, services, currency, today, prefillAmount }: InvoiceFieldsProps) {
  const t = useTranslations("invoices.fields");
  const [amount, setAmount] = useState(values.amount);

  const choosePrice = (serviceId: string) => {
    const price = services.find((service) => service.id === serviceId)?.defaultPrice;
    // A hand-edited amount stays until a different service is chosen.
    if (price !== undefined) setAmount(price);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {"ownName" in employees ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("employee")}</span>
          <p className="flex h-12 items-center rounded-xl border bg-muted/50 px-4 text-sm md:text-base">
            <span dir="auto">{employees.ownName}</span>
          </p>
        </div>
      ) : (
        <SelectField
          name="employeeId"
          label={t("employee")}
          placeholder={t("chooseEmployee")}
          choices={employees}
          defaultValue={values.employeeId}
          error={errors?.employeeId}
        />
      )}
      <SelectField
        name="serviceId"
        label={t("service")}
        placeholder={t("chooseService")}
        choices={services}
        defaultValue={values.serviceId}
        error={errors?.serviceId}
        onChange={prefillAmount ? choosePrice : undefined}
      />
      <FormField
        name="amount"
        label={t("amount")}
        icon={Banknote}
        autoComplete="off"
        inputMode="decimal"
        maxLength={11}
        spellCheck={false}
        required
        dir="ltr"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        hint={t("amountHint", { currency })}
        error={errors?.amount}
      />
      {values.date !== undefined && (
        <DateTimeField defaultValue={values.date} today={today} error={errors?.date} />
      )}
    </div>
  );
}
