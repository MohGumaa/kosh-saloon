import type { Instrumentation } from "next";
import { missingRequiredEnv, requestErrorLog } from "@/lib/ops";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const missing = missingRequiredEnv(process.env);
  if (missing.length > 0) {
    console.error(`[env] Missing required environment variables: ${missing.join(", ")}`);
  }
}

// One redacted line per server error; Vercel Runtime Logs collects it.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error("[request-error]", JSON.stringify(requestErrorLog(error, request, context)));
};
