import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DatePicker } from "@/components/ui/date-picker";
import { REVENUE_PERIODS, reportHref, type RevenueReportRange } from "@/lib/reports";
import { cn } from "@/lib/utils";

const ERROR_ID = "report-range-error";

const chipClass =
  "flex h-9 items-center rounded-xl border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

const activeClass = "border-primary bg-primary text-primary-foreground hover:bg-primary/80";

/** Preset and grouping links plus a custom-range GET form. The server parses the result; there is no client state. */
export async function ReportPeriodControls({
  path,
  range,
  today,
  params = {},
}: {
  /** The report page the links and the custom form point at. */
  path: string;
  range: RevenueReportRange;
  today: string;
  /** Other params of the page the links and the form keep, such as the employee. */
  params?: Record<string, string>;
}) {
  const t = await getTranslations("reportPeriod");
  const customValues = range.period === "custom" || range.invalidCustom ? range.submitted : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
      <nav aria-label={t("periods.label")}>
        <ul className="flex flex-wrap gap-2">
          {REVENUE_PERIODS.filter((period) => period !== "custom").map((period) => {
            const active = range.period === period && !range.invalidCustom;
            return (
              <li key={period}>
                <Link
                  href={reportHref(path, range, { period }, today, params)}
                  aria-current={active ? "page" : undefined}
                  className={cn(chipClass, active && activeClass)}
                >
                  {t(`periods.${period}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action={path} aria-label={t("periods.custom")} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="period" value="custom" />
        <input type="hidden" name="group" value={range.group} />
        {Object.entries(params).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
        {(["from", "to"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`report-${key}`} className="text-sm font-medium">
              {t(`custom.${key}`)}
            </label>
            <DatePicker
              // Remount on navigation so the picker shows the values the server used.
              key={`${range.period}-${customValues?.[key] ?? ""}`}
              id={`report-${key}`}
              name={key}
              max={today}
              defaultValue={customValues?.[key]}
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
            {t("custom.invalid")}
          </p>
        )}
      </form>

      <nav aria-label={t("group.label")} className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="text-sm font-medium">
          {t("group.label")}
        </span>
        <ul className="flex flex-wrap gap-2">
          {range.allowedGroups.map((group) => {
            const active = range.group === group;
            return (
              <li key={group}>
                <Link
                  href={reportHref(path, range, { group }, today, params)}
                  aria-current={active ? "page" : undefined}
                  className={cn(chipClass, active && activeClass)}
                >
                  {t(`group.${group}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
