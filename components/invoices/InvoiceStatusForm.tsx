"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { setInvoiceStatus, type InvoiceFormState } from "@/actions/invoices";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";
import type { InvoiceStatusValue } from "@/lib/invoices";

interface InvoiceStatusFormProps {
  id: string;
  /**
   * The stored status. The form stays mounted when it changes, so the success toast
   * of the change that caused it still shows; a cancelled invoice shows a note instead.
   */
  status: InvoiceStatusValue;
}

const buttonClass = "h-11 rounded-xl px-5";

export function InvoiceStatusForm({ id, status }: InvoiceStatusFormProps) {
  const t = useTranslations("invoices");
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(setInvoiceStatus, null);
  const { messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("statusForm.success"));
  const failure = state && !state.success ? state : null;
  const [confirming, setConfirming] = useState(false);
  const [shownStatus, setShownStatus] = useState(status);
  // A new stored status closes any open cancel confirmation.
  if (status !== shownStatus) {
    setShownStatus(status);
    setConfirming(false);
  }
  const cancelRef = useRef<HTMLButtonElement>(null);
  const other = status === "PAID" ? "UNPAID" : "PAID";

  const keep = () => {
    setConfirming(false);
    // The confirm step is gone, so return focus to the button that opened it.
    requestAnimationFrame(() => cancelRef.current?.focus());
  };

  return (
    <div className="flex flex-col gap-4">
      {failure && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}

      {status === "CANCELLED" ? (
        <p className="text-sm text-muted-foreground">{t("statusForm.cancelledDescription")}</p>
      ) : confirming ? (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="CANCELLED" />
          <p className="text-sm" id="cancel-invoice-warning">
            {t("statusForm.confirmText")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={pending}
              autoFocus
              aria-describedby="cancel-invoice-warning"
              className={buttonClass}
            >
              {pending ? t("statusForm.submitting") : t("statusForm.confirmCancel")}
            </Button>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={keep} className={buttonClass}>
              {t("statusForm.keep")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={other} />
            <Button type="submit" size="lg" disabled={pending} className={buttonClass}>
              {pending
                ? t("statusForm.submitting")
                : t(other === "PAID" ? "statusForm.markPaid" : "statusForm.markUnpaid")}
            </Button>
          </form>
          <Button
            ref={cancelRef}
            type="button"
            variant="destructive"
            size="lg"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className={buttonClass}
          >
            {t("statusForm.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
