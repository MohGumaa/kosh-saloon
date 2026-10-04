"use client";

import { Banknote, Languages, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ServiceField, ServiceFieldErrorCode } from "@/actions/services";
import { FormField } from "@/components/auth/FormField";

interface ServiceFieldsProps {
  values: Record<ServiceField, string>;
  errors?: Partial<Record<ServiceField, ServiceFieldErrorCode>>;
  /** The salon currency code, shown in the price hint. */
  currency: string;
}

/** The name and price inputs shared by the create and edit forms. */
export function ServiceFields({ values, errors, currency }: ServiceFieldsProps) {
  const t = useTranslations("services.fields");

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField
        // Remount with the latest value; Base UI inputs reject a changing defaultValue.
        key={`nameEn:${values.nameEn}`}
        name="nameEn"
        label={t("nameEn")}
        icon={Scissors}
        autoComplete="off"
        maxLength={100}
        required
        dir="auto"
        defaultValue={values.nameEn}
        error={errors?.nameEn}
      />
      <FormField
        key={`nameAr:${values.nameAr}`}
        name="nameAr"
        label={t("nameAr")}
        icon={Languages}
        autoComplete="off"
        maxLength={100}
        required
        dir="rtl"
        lang="ar"
        defaultValue={values.nameAr}
        error={errors?.nameAr}
      />
      <FormField
        key={`defaultPrice:${values.defaultPrice}`}
        name="defaultPrice"
        label={t("defaultPrice")}
        icon={Banknote}
        autoComplete="off"
        inputMode="decimal"
        maxLength={11}
        spellCheck={false}
        required
        dir="ltr"
        defaultValue={values.defaultPrice}
        hint={t("defaultPriceHint", { currency })}
        error={errors?.defaultPrice}
      />
    </div>
  );
}
