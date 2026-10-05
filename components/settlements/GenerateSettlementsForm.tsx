"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { generateSettlements, type SettlementFormState } from "@/actions/settlements";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

/** Generates the month's missing settlements. Rendered only for a viewer who may create them. */
export function GenerateSettlementsForm({ month }: { month: string }) {
  const t = useTranslations("settlements");
  const [state, action, pending] = useActionState<SettlementFormState, FormData>(generateSettlements, null);
  const { messageRef } = useFocusOnError(state);
  // Only a generate that created settlements gets a toast; "nothing to generate" stays inline.
  const nothing = state?.success ? state.nothing : undefined;
  useSuccessToast(nothing ? null : state, t("generate.success", { count: state?.success ? (state.created ?? 0) : 0 }));
  const failure = state && !state.success ? state : null;

  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="month" value={month} />
      {failure && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <Button type="submit" size="lg" disabled={pending} aria-describedby="generate-hint" className="h-11 rounded-xl px-5">
        {pending ? t("generate.submitting") : t("generate.submit")}
      </Button>
      <p role="status" className="text-sm font-medium empty:hidden">
        {nothing && t(`generate.nothing.${nothing}`)}
      </p>
      <p id="generate-hint" className="text-sm text-muted-foreground">
        {t("generate.hint")}
      </p>
    </form>
  );
}
