import { getLocale, getTranslations } from "next-intl/server";
import { FormSelect } from "@/components/ui/form-select";
import { dateValue } from "@/lib/expenses";
import { CLOSING_STATEMENT_PATH, settlementMonthOptions } from "@/lib/reports";

/** A GET form for the statement month; the server validates the result. There is no client state. */
export async function ClosingMonthSelect({
  month,
  latest,
  firstMonth,
}: {
  month: string;
  /** The latest completed month, `YYYY-MM`. */
  latest: string;
  /** The first settled month, if any. */
  firstMonth: string | null;
}) {
  const [t, locale] = await Promise.all([getTranslations("closingStatement"), getLocale()]);
  // The first of the month at UTC midnight, formatted in UTC, names the same month for every viewer.
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const options = settlementMonthOptions(firstMonth, latest).map((value) => ({
    value,
    label: monthLabel.format(dateValue(`${value}-01`)),
  }));
  // A valid month older than the offered list is still shown as chosen.
  if (!options.some((option) => option.value === month)) {
    options.push({ value: month, label: monthLabel.format(dateValue(`${month}-01`)) });
  }

  return (
    <form method="get" action={CLOSING_STATEMENT_PATH} className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex w-56 flex-col gap-2">
        <label htmlFor="closing-month" className="text-sm font-medium">
          {t("month")}
        </label>
        <FormSelect key={month} id="closing-month" name="month" options={options} defaultValue={month} />
      </div>
      <button
        type="submit"
        className="h-11 rounded-xl border px-5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
      >
        {t("show")}
      </button>
    </form>
  );
}
