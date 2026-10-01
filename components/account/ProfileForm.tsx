"use client";

import { useActionState } from "react";
import { Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateProfile, type ProfileFormState } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";

interface ProfileFormProps {
  name: string;
  phone: string;
}

export function ProfileForm({ name, phone }: ProfileFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, null);
  const { formRef, messageRef } = useFocusOnError(state);
  const failure = state && !state.success ? state : null;
  const values = failure?.values ?? { name, phone };

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {state?.success && <FormMessage tone="success">{t("account.info.success")}</FormMessage>}
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`auth.errors.${failure.error}`)}
        </FormMessage>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          // Remount with the latest value; Base UI inputs reject a changing defaultValue.
          key={`name:${values.name}`}
          name="name"
          label={t("account.info.name")}
          icon={User}
          autoComplete="name"
          maxLength={100}
          required
          defaultValue={values.name}
          error={failure?.fieldErrors?.name}
        />
        <FormField
          key={`phone:${values.phone}`}
          name="phone"
          type="tel"
          label={t("account.info.phone")}
          icon={Phone}
          autoComplete="tel"
          maxLength={30}
          defaultValue={values.phone}
          hint={t("account.info.phoneHint")}
          error={failure?.fieldErrors?.phone}
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("account.info.submitting") : t("account.info.submit")}
      </Button>
    </form>
  );
}
