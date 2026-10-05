"use client";

import { useActionState, useState } from "react";
import { Percent } from "lucide-react";
import { useTranslations } from "next-intl";
import { setEmployeeShare, type EmployeeFormState } from "@/actions/employees";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

interface EmployeeShareFormProps {
  userId: string;
  /** The employee's own percentage as a decimal string, or "" for the salon default. */
  value: string;
  /** The global percentage, named in the hint. */
  salonPercentage: string;
}

export function EmployeeShareForm({ userId, value: stored, salonPercentage }: EmployeeShareFormProps) {
  const t = useTranslations("employees");
  const [state, action, pending] = useActionState<EmployeeFormState<"sharePercentage">, FormData>(
    setEmployeeShare,
    null,
  );
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("share.success"));
  const failure = state && !state.success ? state : null;
  // React resets the form after an action, so a rejected value is kept here to show it again.
  const [submitted, setSubmitted] = useState(stored);
  const value = failure ? submitted : stored;

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => setSubmitted(String(new FormData(event.currentTarget).get("sharePercentage") ?? ""))}
      noValidate
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="userId" value={userId} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <FormField
        // Remount with the latest value; Base UI inputs reject a changing defaultValue.
        key={value}
        name="sharePercentage"
        label={t("share.label")}
        hint={t("share.hint", { salon: salonPercentage })}
        defaultValue={value}
        error={failure?.fieldErrors?.sharePercentage}
        icon={Percent}
        inputMode="decimal"
        maxLength={6}
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        className="sm:max-w-xs"
      />
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("share.submitting") : t("share.submit")}
      </Button>
    </form>
  );
}
