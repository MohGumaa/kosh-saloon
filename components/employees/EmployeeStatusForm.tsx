"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setEmployeeActive, type EmployeeFormState } from "@/actions/employees";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

interface EmployeeStatusFormProps {
  userId: string;
  isActive: boolean;
}

export function EmployeeStatusForm({ userId, isActive }: EmployeeStatusFormProps) {
  const t = useTranslations("employees");
  const [state, action, pending] = useActionState<EmployeeFormState, FormData>(setEmployeeActive, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("status.success"));
  const failure = state && !state.success ? state : null;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
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
