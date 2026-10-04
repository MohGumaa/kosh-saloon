"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InvoiceField, InvoiceFieldErrorCode } from "@/actions/invoices";
import { FormField } from "@/components/auth/FormField";
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
  values: Record<"employeeId" | "serviceId" | "amount", string>;
  errors?: Partial<Record<InvoiceField, InvoiceFieldErrorCode>>;
  /** The choosable employees, or the actor's own name for a Staff user, who invoices only themself. */
  employees: InvoiceChoice[] | { ownName: string };
  services: ServiceChoice[];
  currency: string;
  /** On create, choosing a service fills the amount with its default price. */
  prefillAmount?: boolean;
}

const selectClass =
  "h-12 w-full rounded-xl border border-input bg-transparent px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-base dark:bg-input/30";

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
      <select
        // Remount with the latest value after a failed submit resets the form.
        key={`${name}:${defaultValue}`}
        id={id}
        name={name}
        required
        defaultValue={defaultValue}
        onChange={onChange && ((event) => onChange(event.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={selectClass}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.isActive ? choice.name : t("inactive", { name: choice.name })}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {tAuth(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}

/** The employee, service, and amount inputs shared by the create and edit forms. */
export function InvoiceFields({ values, errors, employees, services, currency, prefillAmount }: InvoiceFieldsProps) {
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
    </div>
  );
}
