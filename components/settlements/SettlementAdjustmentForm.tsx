"use client";

import { useActionState, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSettlementAdjustment, type SettlementFormState } from "@/actions/settlements";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// Not from `lib/settlements`, which loads the Prisma runtime that cannot run in the browser.
import { DESCRIPTION_MAX as ADJUSTMENT_REASON_MAX } from "@/lib/expenses";

const EMPTY = { amount: "", reason: "" };

/** Adds a signed correction to a PAID settlement. The server checks the permission and status. */
export function SettlementAdjustmentForm({ id, currency }: { id: string; currency: string }) {
  const t = useTranslations("settlements.adjustments");
  const tSettlements = useTranslations("settlements");
  const tAuth = useTranslations("auth");
  const [state, action, pending] = useActionState<SettlementFormState, FormData>(createSettlementAdjustment, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("success"));
  const failure = state && !state.success ? state : null;
  // React resets the form after an action, so rejected values are kept here to show them again.
  const [submitted, setSubmitted] = useState(EMPTY);
  const values = failure ? submitted : EMPTY;
  const reasonError = failure?.fieldErrors?.reason;

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        setSubmitted({ amount: String(data.get("amount") ?? ""), reason: String(data.get("reason") ?? "") });
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="id" value={id} />
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {tSettlements(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <FormField
        // Remount with the kept value; Base UI inputs reject a changing defaultValue.
        key={values.amount}
        name="amount"
        label={t("amount", { currency })}
        hint={t("amountHint")}
        defaultValue={values.amount}
        error={failure?.fieldErrors?.amount}
        icon={CircleDollarSign}
        inputMode="decimal"
        maxLength={13}
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        className="sm:max-w-xs"
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-reason">{t("reason")}</Label>
        <Textarea
          key={values.reason}
          id="field-reason"
          name="reason"
          rows={3}
          maxLength={ADJUSTMENT_REASON_MAX}
          dir="auto"
          defaultValue={values.reason}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? "field-reason-error field-reason-hint" : "field-reason-hint"}
          className="min-h-24 rounded-xl px-4 py-3 md:text-base"
        />
        {reasonError && (
          <p id="field-reason-error" className="text-sm text-destructive">
            {tAuth(`errors.${reasonError}`)}
          </p>
        )}
        <p id="field-reason-hint" className="text-sm text-muted-foreground">
          {t("reasonHint", { max: ADJUSTMENT_REASON_MAX })}
        </p>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
