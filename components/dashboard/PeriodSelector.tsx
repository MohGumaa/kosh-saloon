import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DatePicker } from "@/components/ui/date-picker";
import { DASHBOARD_PERIODS, DEFAULT_PERIOD, type DashboardRange } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const ERROR_ID = "dashboard-range-error";

function presetHref(period: string): string {
  return period === DEFAULT_PERIOD ? "/dashboard" : `/dashboard?period=${period}`;
}

/** Preset links plus a custom-range GET form. The server parses the result; there is no client state. */
export async function PeriodSelector({ range, today }: { range: DashboardRange; today: string }) {
  const t = await getTranslations("dashboard");
  const customValues = range.period === "custom" || range.invalidCustom ? range.submitted : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card lg:p-6">
      <nav aria-label={t("periods.label")}>
        <ul className="flex flex-wrap gap-2">
          {DASHBOARD_PERIODS.filter((period) => period !== "custom").map((period) => {
            const active = range.period === period && !range.invalidCustom;
            return (
              <li key={period}>
                <Link
                  href={presetHref(period)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-xl border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    active && "border-primary bg-primary text-primary-foreground hover:bg-primary/80",
                  )}
                >
                  {t(`periods.${period}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/dashboard" aria-label={t("periods.custom")} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="period" value="custom" />
        {(["from", "to"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <label htmlFor={`dashboard-${key}`} className="text-sm font-medium">
              {t(`custom.${key}`)}
            </label>
            <DatePicker
              // Remount on navigation so the picker shows the values the server used.
              key={`${range.period}-${customValues?.[key] ?? ""}`}
              id={`dashboard-${key}`}
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
            range.period === "custom" && "border-primary bg-primary text-primary-foreground hover:bg-primary/80",
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
    </div>
  );
}
