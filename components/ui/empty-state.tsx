import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  /** With a title, a whole list is empty; without one, a section inside a panel. */
  title?: string;
  description: string;
  action?: ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string;
}

/** The one empty-state pattern for lists, tables, reports, and tabs. */
export function EmptyState({ icon: Icon, title, description, action, headingLevel = "h2", className }: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      {title && <Heading className="text-lg font-semibold">{title}</Heading>}
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
