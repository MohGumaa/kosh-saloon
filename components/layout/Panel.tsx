import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const panelClass = "min-w-0 rounded-2xl border bg-card text-card-foreground shadow-card";

interface PanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}

/** A card with an icon, heading, and description above its content. */
export function Panel({ icon: Icon, title, description, children }: PanelProps) {
  return (
    <section className={panelClass}>
      <div className="flex items-center gap-4 border-b p-5 lg:px-7">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5 lg:p-7">{children}</div>
    </section>
  );
}

interface DetailProps {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}

/** One labelled value in a `dl`. */
export function Detail({ icon: Icon, label, children }: DetailProps) {
  return (
    // A dl row may hold only dt and dd, so the icon sits inside the dt, placed in the row's start padding.
    <div className="relative flex min-h-18 flex-col justify-center py-4 ps-14">
      <dt className="text-xs text-muted-foreground">
        <span className="absolute inset-y-0 inset-s-0 my-auto flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon aria-hidden className="size-[1.125rem]" />
        </span>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}
