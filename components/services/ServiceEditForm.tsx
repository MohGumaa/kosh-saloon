"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateService, type ServiceField, type ServiceFormState } from "@/actions/services";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { ServiceFields } from "@/components/services/ServiceFields";
import { Button } from "@/components/ui/button";

interface ServiceEditFormProps {
  id: string;
  /** The stored values, the price as a decimal string. */
  values: Record<ServiceField, string>;
  currency: string;
}

export function ServiceEditForm({ id, values, currency }: ServiceEditFormProps) {
  const t = useTranslations("services");
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(updateService, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("edit.success"));
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <ServiceFields values={failure?.values ?? values} errors={failure?.fieldErrors} currency={currency} />
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("edit.submitting") : t("edit.submit")}
      </Button>
    </form>
  );
}
