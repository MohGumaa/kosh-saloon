import type { SettlementStatusValue } from "@/lib/settlements";
import { cn } from "@/lib/utils";

const STYLES: Record<SettlementStatusValue, string> = {
  DRAFT: "bg-st-draft-soft text-st-draft",
  CALCULATED: "bg-st-calculated-soft text-st-calculated",
  APPROVED: "bg-st-approved-soft text-st-approved",
  PAID: "bg-st-paid-soft text-st-paid",
};

/** The status pill used by the settlement list and detail. The label is already translated. */
export function SettlementStatusBadge({ status, label }: { status: SettlementStatusValue; label: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", STYLES[status])}>{label}</span>
  );
}
