"use client";

import { Banknote, CalendarDays, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExpenseField, ExpenseFieldErrorCode } from "@/actions/expenses";
import { FormField } from "@/components/auth/FormField";
import { Label } from "@/components/ui/label";
import { DESCRIPTION_MAX, EXPENSE_CATEGORIES, TITLE_MAX } from "@/lib/expenses";

interface ExpenseFieldsProps {
  values: Record<ExpenseField, string>;
  errors?: Partial<Record<ExpenseField, ExpenseFieldErrorCode>>;
  currency: string;
  /** The salon's current day; the latest date the picker offers. The server enforces it. */
  today: string;
}

const controlClass =
  "w-full rounded-xl border border-input bg-transparent px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-base dark:bg-input/30";

/** The title, category, amount, date, and description inputs shared by the create and edit forms. */
export function ExpenseFields({ values, errors, currency, today }: ExpenseFieldsProps) {
  const t = useTranslations("expenses");
  const tAuth = useTranslations("auth");
  const categoryError = errors?.category;
  const descriptionError = errors?.description;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField
          name="title"
          label={t("fields.title")}
          icon={Type}
          autoComplete="off"
          maxLength={TITLE_MAX}
          required
          dir="auto"
          defaultValue={values.title}
          error={errors?.title}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-category">{t("fields.category")}</Label>
        <select
          id="field-category"
          name="category"
          required
          defaultValue={values.category}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? "field-category-error" : undefined}
          className={`h-12 ${controlClass}`}
        >
          <option value="" disabled>
            {t("fields.chooseCategory")}
          </option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category}`)}
            </option>
          ))}
        </select>
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
      <FormField
        name="date"
        type="date"
        label={t("fields.date")}
        icon={CalendarDays}
        required
        dir="ltr"
        max={today}
        defaultValue={values.date}
        hint={t("fields.dateHint")}
        error={errors?.date}
      />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="field-description">{t("fields.description")}</Label>
        <textarea
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
          className={`min-h-28 py-3 ${controlClass}`}
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
