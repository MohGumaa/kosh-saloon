"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createService, type ServiceField, type ServiceFormState } from "@/actions/services";
import { FormMessage } from "@/components/auth/FormMessage";
import { useFocusOnError } from "@/components/auth/useFocusOnError";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { ServiceFields } from "@/components/services/ServiceFields";
import { Button } from "@/components/ui/button";

const EMPTY: Record<ServiceField, string> = { nameEn: "", nameAr: "", defaultPrice: "" };

export function ServiceCreateForm({ currency }: { currency: string }) {
  const t = useTranslations("services");
  const router = useRouter();
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(createService, null);
  const { formRef, messageRef } = useFocusOnError(state);
  useSuccessToast(state, t("create.success"));
  const failure = state && !state.success ? state : null;
  const created = state?.success === true;

  useEffect(() => {
    if (created) router.push("/services");
  }, [created, router]);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      {failure && !failure.fieldErrors && (
        <FormMessage ref={messageRef} tone="error">
          {t(`errors.${failure.error}`)}
        </FormMessage>
      )}
      <ServiceFields values={failure?.values ?? EMPTY} errors={failure?.fieldErrors} currency={currency} />
      <Button type="submit" size="lg" disabled={pending} className="h-11 self-start rounded-xl px-5">
        {pending ? t("create.submitting") : t("create.submit")}
      </Button>
    </form>
  );
}
