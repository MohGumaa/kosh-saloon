"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOutOtherSessions, type SignOutOthersState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";

/** `otherSessions` counts the signed-in user's other unexpired sessions, read on the server. */
export function SignOutOtherSessionsForm({ otherSessions }: { otherSessions: number }) {
  const t = useTranslations("settings.security.sessions");
  const [state, action, pending] = useActionState<SignOutOthersState, FormData>(signOutOtherSessions, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("success"));

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      {state && !state.success && (
        <FormMessage ref={messageRef} tone="error">
          {t("error")}
        </FormMessage>
      )}
      <p className="text-sm">{otherSessions > 0 ? t("count", { count: otherSessions }) : t("none")}</p>
      <Button
        type="submit"
        variant="outline"
        size="lg"
        disabled={pending || otherSessions === 0}
        className="h-11 self-start rounded-xl px-5"
      >
        <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
