import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

interface FormMessageProps {
  tone: "error" | "success";
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Form-level status; errors use role="alert", success uses role="status". */
export function FormMessage({ tone, children, ref }: FormMessageProps) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm outline-none",
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary/10 text-foreground",
      )}
    >
      {children}
    </div>
  );
}
