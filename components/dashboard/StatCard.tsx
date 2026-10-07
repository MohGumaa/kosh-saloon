import type { LucideIcon } from "lucide-react";

/** One dashboard figure. `value` is already formatted; numbers render left-to-right in both directions. */
export function StatCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums break-words lg:text-3xl">
        <span dir="ltr">{value}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
