"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog, where the viewer can also save a PDF. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring print:hidden"
    >
      <Printer aria-hidden className="size-4" />
      {label}
    </button>
  );
}
