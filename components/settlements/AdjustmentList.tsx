import Link from "next/link";
import { LocalDateTime } from "@/components/layout/LocalDateTime";
import { cn } from "@/lib/utils";

export interface AdjustmentRow {
  id: string;
  /** Signed, as stored. */
  amount: { isNegative(): boolean; toNumber(): number };
  reason: string;
  createdBy: string;
  createdAt: Date;
  /** The other settlement this row points at, or none while it is still pending. */
  link: { href: string; label: string } | null;
}

interface AdjustmentListProps {
  rows: AdjustmentRow[];
  locale: string;
  currency: string;
  /** Shown instead of a link while an adjustment is pending. */
  pendingLabel: string;
  /** "Added by {name}", already translated. */
  addedBy: (name: string) => string;
}

/** Signed corrections, newest last. The reason is shown as plain text, never as markup. */
export function AdjustmentList({ rows, locale, currency, pendingLabel, addedBy }: AdjustmentListProps) {
  const price = new Intl.NumberFormat(locale, { style: "currency", currency, signDisplay: "always" });

  return (
    <ul className="flex flex-col divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6">
          <span
            dir="ltr"
            className={cn(
              "shrink-0 text-base font-semibold tabular-nums sm:w-36 sm:text-end",
              row.amount.isNegative() && "text-destructive",
            )}
          >
            {price.format(row.amount.toNumber())}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p dir="auto" className="text-sm break-words whitespace-pre-line">
              {row.reason}
            </p>
            <p className="text-xs text-muted-foreground">
              <span dir="auto">{addedBy(row.createdBy)}</span>
              {" · "}
              <LocalDateTime iso={row.createdAt.toISOString()} timeStyle="short" />
            </p>
          </div>
          {row.link ? (
            <Link
              href={row.link.href}
              className="shrink-0 self-start rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
            >
              {row.link.label}
            </Link>
          ) : (
            <span className="shrink-0 self-start rounded-full bg-st-draft-soft px-2.5 py-1 text-xs font-medium whitespace-nowrap text-st-draft">
              {pendingLabel}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
