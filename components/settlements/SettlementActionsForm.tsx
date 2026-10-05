"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  approveSettlement,
  markSettlementCalculated,
  markSettlementPaid,
  recalculateSettlement,
  type SettlementFormState,
} from "@/actions/settlements";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";
import type { SettlementAction, SettlementStatusValue } from "@/lib/settlements";

const ACTIONS: Record<SettlementAction, (prev: SettlementFormState, formData: FormData) => Promise<SettlementFormState>> =
  {
    recalculate: recalculateSettlement,
    calculate: markSettlementCalculated,
    approve: approveSettlement,
    pay: markSettlementPaid,
  };

/** Runs the server action named by the submitted button's form. */
function run(prev: SettlementFormState, formData: FormData) {
  return ACTIONS[formData.get("action") as SettlementAction](prev, formData);
}

interface SettlementActionsFormProps {
  id: string;
  /**
   * The stored status. The form stays mounted when it changes, so the success toast
   * of the change that caused it still shows.
   */
  status: SettlementStatusValue;
  /** The actions the server allows this viewer now, in flow order. */
  actions: SettlementAction[];
}

const buttonClass = "h-11 rounded-xl px-5";

export function SettlementActionsForm({ id, status, actions }: SettlementActionsFormProps) {
  const t = useTranslations("settlements");
  const [state, action, pending] = useActionState<SettlementFormState, FormData>(run, null);
  const { messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("actions.success"));
  const failure = state && !state.success ? state : null;
  const [confirming, setConfirming] = useState(false);
  const [shownStatus, setShownStatus] = useState(status);
  // A new stored status closes any open payment confirmation.
  if (status !== shownStatus) {
    setShownStatus(status);
    setConfirming(false);
  }
  const payRef = useRef<HTMLButtonElement>(null);

  const keep = () => {
    setConfirming(false);
    // The confirm step is gone, so return focus to the button that opened it.
    requestAnimationFrame(() => payRef.current?.focus());
  };

  const hidden = (name: SettlementAction) => (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={name} />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {failure && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}

      {status === "PAID" ? (
        <p className="text-sm text-muted-foreground">{t("actions.paidNote")}</p>
      ) : actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("actions.none")}</p>
      ) : confirming ? (
        <form action={action} className="flex flex-col gap-4">
          {hidden("pay")}
          <p className="text-sm" id="pay-settlement-warning">
            {t("actions.confirmText")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              autoFocus
              aria-describedby="pay-settlement-warning"
              className={buttonClass}
            >
              {pending ? t("actions.submitting") : t("actions.confirmPay")}
            </Button>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={keep} className={buttonClass}>
              {t("actions.keep")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {actions.map((name) =>
            name === "pay" ? (
              <Button
                key={name}
                ref={payRef}
                type="button"
                size="lg"
                disabled={pending}
                onClick={() => setConfirming(true)}
                className={buttonClass}
              >
                {t("actions.pay")}
              </Button>
            ) : (
              <form key={name} action={action}>
                {hidden(name)}
                <Button
                  type="submit"
                  size="lg"
                  // Recalculating is the secondary choice next to moving forward.
                  variant={name === "recalculate" ? "outline" : "default"}
                  disabled={pending}
                  className={buttonClass}
                >
                  {pending ? t("actions.submitting") : t(`actions.${name}`)}
                </Button>
              </form>
            ),
          )}
        </div>
      )}
    </div>
  );
}
