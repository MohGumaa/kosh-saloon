"use client";

import { useActionState, type ComponentProps } from "react";
import { BadgeCheck, Mail, MapPin, Phone, Receipt, Store, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateSalonInformation, type InformationField, type SettingsFormState } from "@/actions/settings";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

type InputProps = Pick<ComponentProps<"input">, "type" | "autoComplete" | "maxLength" | "required" | "dir">;

interface FieldConfig extends InputProps {
  name: InformationField;
  icon: LucideIcon;
}

const FIELDS: FieldConfig[] = [
  { name: "name", icon: Store, autoComplete: "organization", maxLength: 100, required: true, dir: "auto" },
  { name: "licenseNumber", icon: BadgeCheck, autoComplete: "off", maxLength: 50, dir: "ltr" },
  { name: "phone", icon: Phone, type: "tel", autoComplete: "tel", maxLength: 30, dir: "ltr" },
  { name: "email", icon: Mail, type: "email", autoComplete: "email", maxLength: 254, dir: "ltr" },
  { name: "taxId", icon: Receipt, autoComplete: "off", maxLength: 50, dir: "ltr" },
  { name: "address", icon: MapPin, autoComplete: "street-address", maxLength: 200, dir: "auto" },
];

interface InformationFormProps {
  values: Record<InformationField, string>;
  /** The viewer may not edit; the server enforces the same rule. */
  readOnly: boolean;
}

export function InformationForm({ values: stored, readOnly }: InformationFormProps) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState<SettingsFormState<InformationField>, FormData>(
    updateSalonInformation,
    null,
  );
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("information.success"));
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
            label={t(`information.${name}`)}
            hint={name === "phone" && !readOnly ? t("information.phoneHint") : undefined}
            defaultValue={values[name]}
            error={failure?.fieldErrors?.[name]}
            readOnly={readOnly}
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
