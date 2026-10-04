"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setServiceActive, type ServiceFormState } from "@/actions/services";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

interface ServiceStatusFormProps {
  id: string;
  isActive: boolean;
}

export function ServiceStatusForm({ id, isActive }: ServiceStatusFormProps) {
  const t = useTranslations("services");
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(setServiceActive, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("status.success"));
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!isActive)} />
      {failure && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <Button
        type="submit"
        variant={isActive ? "destructive" : "default"}
        size="lg"
        disabled={pending}
        className="h-11 self-start rounded-xl px-5"
      >
        {pending ? t("status.submitting") : t(isActive ? "status.deactivate" : "status.activate")}
      </Button>
    </form>
  );
}
