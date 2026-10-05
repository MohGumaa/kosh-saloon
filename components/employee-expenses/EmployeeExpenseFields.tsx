"use client";

import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EmployeeExpenseField, EmployeeExpenseFieldErrorCode } from "@/actions/employee-expenses";
import { FormField } from "@/components/auth/FormField";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSelect, fieldSelectClass } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPLOYEE_EXPENSE_CATEGORIES } from "@/lib/employee-expenses";
import { DESCRIPTION_MAX } from "@/lib/expenses";

interface EmployeeExpenseFieldsProps {
  values: Record<EmployeeExpenseField, string>;
  errors?: Partial<Record<EmployeeExpenseField, EmployeeExpenseFieldErrorCode>>;
  currency: string;
  /** The salon's current day; the latest date the picker offers. The server enforces it. */
  today: string;
}

/** The category, amount, date, and description inputs shared by the create and edit forms. */
export function EmployeeExpenseFields({ values, errors, currency, today }: EmployeeExpenseFieldsProps) {
  const t = useTranslations("employeeExpenses");
  const tAuth = useTranslations("auth");
  const categoryError = errors?.category;
  const dateError = errors?.date;
  const descriptionError = errors?.description;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="field-category">{t("fields.category")}</Label>
        <FormSelect
          id="field-category"
          name="category"
          required
          defaultValue={values.category}
          placeholder={t("fields.chooseCategory")}
          options={EMPLOYEE_EXPENSE_CATEGORIES.map((category) => ({
            value: category,
            label: t(`categories.${category}`),
          }))}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? "field-category-error" : undefined}
          className={fieldSelectClass}
        />
        {categoryError && (
          <p id="field-category-error" className="text-sm text-destructive">
            {tAuth(`errors.${categoryError}`)}
          </p>
        )}
      </div>
      <FormField
        name="amount"
        label={t("fields.amount")}
        icon={Banknote}
        autoComplete="off"
        inputMode="decimal"
        maxLength={11}
        spellCheck={false}
        required
        dir="ltr"
        defaultValue={values.amount}
        hint={t("fields.amountHint", { currency })}
        error={errors?.amount}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-date">{t("fields.date")}</Label>
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
          {t("fields.dateHint")}
        </p>
        {dateError && (
          <p id="field-date-error" className="text-sm text-destructive">
            {tAuth(`errors.${dateError}`)}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="field-description">{t("fields.description")}</Label>
        <Textarea
          id="field-description"
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          dir="auto"
          defaultValue={values.description}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={
            descriptionError ? "field-description-error field-description-hint" : "field-description-hint"
          }
          className="min-h-28 rounded-xl px-4 py-3 md:text-base"
        />
        {descriptionError && (
          <p id="field-description-error" className="text-sm text-destructive">
            {tAuth(`errors.${descriptionError}`)}
          </p>
        )}
        <p id="field-description-hint" className="text-sm text-muted-foreground">
          {t("fields.descriptionHint", { max: DESCRIPTION_MAX })}
        </p>
      </div>
    </div>
  );
}
