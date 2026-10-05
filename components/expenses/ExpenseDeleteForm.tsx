"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteExpense, type ExpenseFormState } from "@/actions/expenses";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";

const buttonClass = "h-11 rounded-xl px-5";

/**
 * Delete with a second, explicit confirmation step. The action does not refresh this
 * page, which would turn into the not-found page; the form shows its toast and then
 * leaves for the list itself.
 */
export function ExpenseDeleteForm({ id }: { id: string }) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(deleteExpense, null);
  const { messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("deleteForm.success"));
  const failure = state && !state.success ? state : null;
  const deleted = state?.success === true;
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Replace, so Back does not return to the deleted expense.
    if (deleted) router.replace("/expenses");
  }, [deleted, router]);

  const keep = () => {
    setConfirming(false);
    // The confirm step is gone, so return focus to the button that opened it.
    requestAnimationFrame(() => deleteRef.current?.focus());
  };

  return (
    <div className="flex flex-col gap-4">
      {failure && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}

      {confirming ? (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm" id="delete-expense-warning">
            {t("deleteForm.confirmText")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={pending || deleted}
              autoFocus
              aria-describedby="delete-expense-warning"
              className={buttonClass}
            >
              {pending ? t("deleteForm.submitting") : t("deleteForm.confirmDelete")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending || deleted}
              onClick={keep}
              className={buttonClass}
            >
              {t("deleteForm.keep")}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={deleteRef}
          type="button"
          variant="destructive"
          size="lg"
          onClick={() => setConfirming(true)}
          className={`${buttonClass} self-start`}
        >
          {t("deleteForm.delete")}
        </Button>
      )}
    </div>
  );
}
