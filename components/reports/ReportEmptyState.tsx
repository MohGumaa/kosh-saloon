import type { LucideIcon } from "lucide-react";

/** A report section with nothing to show for the period. */
export function ReportEmptyState({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
