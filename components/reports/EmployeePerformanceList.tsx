import type { ReactNode } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { ReportEmptyState } from "@/components/reports/ReportEmptyState";
import { employeeLabels } from "@/lib/names";
import type { EmployeePerformanceListData } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

// min-w-0 lets a grid cell shrink below its content, so a wide table scrolls instead of widening the page.
const panelClass = "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6";

const numberCell = "px-3 py-3 tabular-nums whitespace-nowrap";

const linkClass =
  "rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring";

type Column = "invoices" | "paid" | "unpaid" | "share" | "earnings" | "expenses" | "payout";

// Counts and percentages are centered; money lines up at the end of its column.
const align = (column: Column) => (column === "invoices" || column === "share" ? "text-center" : "text-end");

/** Every employee with invoices or deductions in the period, each linking to their own view. */
export async function EmployeePerformanceList({
  data,
  locale,
  rangeLabel,
  showExpenses,
  hrefOf,
}: {
  data: EmployeePerformanceListData;
  locale: string;
  rangeLabel: string;
  /** Deductions and payout, only with `employee_expenses.view`; the data has none otherwise. */
  showExpenses: boolean;
  /** The single-employee view, keeping the period. */
  hrefOf: (employeeId: string) => string;
}) {
  const t = await getTranslations("employeeReport");
  const price = new Intl.NumberFormat(locale, { style: "currency", currency: data.currency });
  const count = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });

  const columns: Column[] = ["invoices", "paid", "unpaid", "share", "earnings"];
  if (showExpenses) columns.push("expenses", "payout");

  const labels = employeeLabels(data.rows.map((row) => row.detail.name), locale);

  const money = (value: { toNumber(): number }) => <span dir="ltr">{price.format(value.toNumber())}</span>;

  return (
    <section aria-labelledby="employee-performance-list" className={panelClass}>
      <h2 id="employee-performance-list" className="text-lg font-semibold">
        {t("list.title")}
      </h2>
      {data.rows.length === 0 ? (
        <ReportEmptyState icon={Users}>{t("list.empty")}</ReportEmptyState>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <caption className="sr-only">{t("list.caption", { range: rangeLabel })}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-3 py-2.5 text-start font-medium">
                  {t("columns.employee")}
                </th>
                {columns.map((column) => (
                  <th key={column} scope="col" className={cn("px-3 py-2.5 font-medium", align(column))}>
                    {t(`columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.rows.map((row, i) => {
                const name = row.detail.name;
                const label = labels[i];
                const cells: Record<Column, ReactNode> = {
                  invoices: count.format(row.paidCount + row.unpaidCount),
                  paid: money(row.paid),
                  unpaid: money(row.unpaid),
                  share: <span dir="ltr">{percent.format(row.sharePercentage.toNumber() / 100)}</span>,
                  earnings: money(row.earnings),
                  expenses: money(row.expenses),
                  payout: money(row.payout),
                };
                return (
                  <tr key={row.id}>
                    <th scope="row" className="px-3 py-3 text-start font-medium">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={name} image={row.detail.image} className="size-8 text-xs" />
                        <span className="min-w-0">
                          <Link href={hrefOf(row.id)} className={linkClass}>
                            <span dir="auto" className="break-words" title={label === name ? undefined : name}>
                              {label}
                            </span>
                          </Link>
                          {!row.detail.isActive && (
                            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                              {t("inactive")}
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    {columns.map((column) => (
                      <td key={column} className={cn(numberCell, align(column))}>
                        {cells[column]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <th scope="row" className="px-3 py-3 text-start">
                  {t("total")}
                </th>
                {columns.map((column) => (
                  <td key={column} className={cn(numberCell, align(column))}>
                    {column === "invoices"
                      ? count.format(data.totals.count)
                      : column === "share"
                        ? null
                        : money(data.totals[column])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
