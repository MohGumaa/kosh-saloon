import type { InvoiceStatusValue } from "@/lib/invoices";
import { cn } from "@/lib/utils";

const STYLES: Record<InvoiceStatusValue, string> = {
  PAID: "bg-success-soft text-success",
  UNPAID: "bg-warning-soft text-warning",
  CANCELLED: "bg-destructive-soft text-destructive",
};

/** The status pill used by the invoice list and detail. The label is already translated. */
export function InvoiceStatusBadge({ status, label }: { status: InvoiceStatusValue; label: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", STYLES[status])}>{label}</span>
  );
}
