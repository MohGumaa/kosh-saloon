"use client";

import { useActionState, type ComponentProps } from "react";
import { Coins, Percent, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateFinancialSettings, type FinancialField, type SettingsFormState } from "@/actions/settings";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

interface FieldConfig extends Pick<ComponentProps<"input">, "inputMode" | "maxLength" | "autoCapitalize"> {
  name: FinancialField;
  icon: LucideIcon;
}

const FIELDS: FieldConfig[] = [
  { name: "employeeSharePercentage", icon: Percent, inputMode: "decimal", maxLength: 6 },
  { name: "taxRate", icon: Percent, inputMode: "decimal", maxLength: 6 },
  { name: "currency", icon: Coins, maxLength: 3, autoCapitalize: "characters" },
];

interface FinancialFormProps {
  /** The two percentages as decimal strings. */
  values: Record<FinancialField, string>;
  /** The viewer may not edit; the server enforces the same rule. */
  readOnly: boolean;
}

export function FinancialForm({ values: stored, readOnly }: FinancialFormProps) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState<SettingsFormState<FinancialField>, FormData>(
    updateFinancialSettings,
    null,
  );
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("financial.success"));
  const failure = state && !state.success ? state : null;
  const values = failure?.values ?? stored;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map(({ name, ...props }) => (
          <FormField
            // Remount with the latest value; Base UI inputs reject a changing defaultValue.
            key={`${name}:${values[name]}`}
            name={name}
            label={t(`financial.${name}`)}
            hint={t(`financial.${name}Hint`)}
            defaultValue={values[name]}
            error={failure?.fieldErrors?.[name]}
            readOnly={readOnly}
            required
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            {...props}
          />
        ))}
      </div>
      {!readOnly && (
        <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
          {pending ? t("submitting") : t("submit")}
        </Button>
      )}
    </form>
  );
}
