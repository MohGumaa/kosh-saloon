"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Shows a success toast each time a form action returns a new successful result. */
export function useSuccessToast(state: { success: boolean } | null, message: string) {
  useEffect(() => {
    if (state?.success) toast.success(message);
    // Only a new action result shows a toast; a language switch must not repeat the last one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
