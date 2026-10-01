"use client";

import { useEffect, useRef } from "react";
import type { AuthFormState } from "@/actions/auth";

/**
 * After a failed submit, moves focus to the first invalid field, or to the
 * form-level message when no field is at fault.
 */
export function useFocusOnError(state: AuthFormState) {
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state || state.success) return;
    const invalidField = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    (invalidField ?? messageRef.current)?.focus();
  }, [state]);

  return { formRef, messageRef };
}
