import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FormSelect } from "@/components/ui/form-select";
import { dateValue } from "@/lib/expenses";
import {
  SETTLEMENT_REPORT_PATH,
  SETTLEMENT_REPORT_PERIODS,
  settlementMonthOptions,
  settlementReportHref,
  type SettlementReportRange,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

const ERROR_ID = "settlement-range-error";

const chipClass =
  "flex h-9 items-center rounded-xl border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

const activeClass = "border-primary bg-primary text-primary-foreground hover:bg-primary/80";

/** Preset links plus a custom month-range GET form. The server parses the result; there is no client state. */
export async function SettlementReportControls({
  range,
  latest,
  firstMonth,
}: {
  range: SettlementReportRange;
  /** The latest settleable month, `YYYY-MM`. */
  latest: string;
  /** The first settled month the viewer may see, if any. */
  firstMonth: string | null;
}) {
  const [t, locale] = await Promise.all([getTranslations("settlementReport"), getLocale()]);
  // The first of the month at UTC midnight, formatted in UTC, names the same month for every viewer.
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const options = settlementMonthOptions(firstMonth, latest).map((month) => ({
    value: month,
    label: monthLabel.format(dateValue(`${month}-01`)),
  }));
  const customValues = range.period === "custom" || range.invalidCustom ? range.submitted : undefined;
  // A month the selects do not offer (malformed, or before the first settled month) shows the nearest end instead.
  const offered = (month: string | undefined) => options.find((option) => option.value === month)?.value;
  const year = latest.slice(0, 4);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
      <nav aria-label={t("periods.label")}>
        <ul className="flex flex-wrap gap-2">
          {SETTLEMENT_REPORT_PERIODS.filter((period) => period !== "custom").map((period) => {
            const active = range.period === period && !range.invalidCustom;
            return (
              <li key={period}>
                <Link
                  href={settlementReportHref(period)}
                  aria-current={active ? "page" : undefined}
                  className={cn(chipClass, active && activeClass)}
                >
                  {period === "year" ? <span dir="ltr">{year}</span> : t(`periods.${period}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        method="get"
        action={SETTLEMENT_REPORT_PATH}
        aria-label={t("periods.custom")}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="period" value="custom" />
        {(["from", "to"] as const).map((key) => (
          <div key={key} className="flex w-48 flex-col gap-2">
            <label htmlFor={`settlement-report-${key}`} className="text-sm font-medium">
              {t(`custom.${key}`)}
            </label>
            <FormSelect
              // Remount on navigation so the select shows the values the server used.
              key={`${range.period}-${customValues?.[key] ?? ""}`}
              id={`settlement-report-${key}`}
              name={key}
              options={options}
              defaultValue={offered(customValues?.[key]) ?? offered(range[key]) ?? (key === "from" ? options.at(-1) : options[0])?.value}
              aria-invalid={range.invalidCustom || undefined}
              aria-describedby={range.invalidCustom ? ERROR_ID : undefined}
            />
          </div>
        ))}
        <button
          type="submit"
          aria-current={range.period === "custom" ? "page" : undefined}
          className={cn(
            "h-11 rounded-xl border px-5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
            range.period === "custom" && activeClass,
          )}
        >
          {t("custom.apply")}
        </button>
        {range.invalidCustom && (
          <p id={ERROR_ID} role="alert" className="basis-full text-sm text-destructive">
            {t("custom.invalid", { year })}
          </p>
        )}
      </form>
    </div>
  );
}
