"use client";

import { AtSign, Mail, Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DetailsField, EmployeeFieldErrorCode } from "@/actions/employees";
import { FormField } from "@/components/auth/FormField";
import { FormSelect, fieldSelectClass } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { ROLES } from "@/lib/employees";

interface EmployeeFieldsProps {
  values: Record<DetailsField, string>;
  errors?: Partial<Record<DetailsField, EmployeeFieldErrorCode>>;
  /** Only an ADMIN assigns a role; the server enforces the same rule. */
  showRole: boolean;
}

/** The name, sign-in details, phone, and role inputs shared by the create and edit forms. */
export function EmployeeFields({ values, errors, showRole }: EmployeeFieldsProps) {
  const t = useTranslations("employees.fields");
  const tAuth = useTranslations("auth");

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField
        // Remount with the latest value; Base UI inputs reject a changing defaultValue.
        key={`name:${values.name}`}
        name="name"
        label={t("name")}
        icon={User}
        autoComplete="off"
        maxLength={100}
        required
        dir="auto"
        defaultValue={values.name}
        error={errors?.name}
      />
      <FormField
        key={`username:${values.username}`}
        name="username"
        label={t("username")}
        icon={AtSign}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        required
        dir="ltr"
        defaultValue={values.username}
        hint={t("usernameHint")}
        error={errors?.username}
      />
      <FormField
        key={`email:${values.email}`}
        name="email"
        type="email"
        label={t("email")}
        icon={Mail}
        autoComplete="off"
        maxLength={254}
        required
        dir="ltr"
        defaultValue={values.email}
        error={errors?.email}
      />
      <FormField
        key={`phone:${values.phone}`}
        name="phone"
        type="tel"
        label={t("phone")}
        icon={Phone}
        autoComplete="off"
        maxLength={30}
        dir="ltr"
        defaultValue={values.phone}
        hint={t("phoneHint")}
        error={errors?.phone}
      />
      {showRole && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="field-role">{t("role")}</Label>
          <FormSelect
            key={`role:${values.role}`}
            id="field-role"
            name="role"
            required
            defaultValue={values.role}
            options={ROLES.map((role) => ({ value: role, label: tAuth(`roles.${role}`) }))}
            aria-invalid={errors?.role ? true : undefined}
            aria-describedby={errors?.role ? "field-role-error" : undefined}
            className={fieldSelectClass}
          />
          {errors?.role && (
            <p id="field-role-error" className="text-sm text-destructive">
              {tAuth(`errors.${errors.role}`)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
