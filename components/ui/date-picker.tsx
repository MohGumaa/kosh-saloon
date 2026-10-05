"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ar } from "react-day-picker/locale/ar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** Lands on the trigger button, so a `<label htmlFor>` names it. */
  id: string;
  name: string;
  /** A `YYYY-MM-DD` calendar day, or `""` for none. */
  defaultValue?: string;
  /** The latest `YYYY-MM-DD` day that can be picked. */
  max?: string;
  /** Shows a button that empties the field, for optional filters. */
  clearable?: boolean;
  /** Size and padding for the trigger, matching the surrounding inputs. */
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** `YYYY-MM-DD` to a local-midnight Date, the form the calendar works in. */
function toDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

function toValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A themed calendar picker that submits like a native date input: a `YYYY-MM-DD`
 * value under `name` via a hidden input. The server still validates the day.
 */
export function DatePicker({
  id,
  name,
  defaultValue = "",
  max,
  clearable,
  className,
  ...aria
}: DatePickerProps) {
  const locale = useLocale();
  const t = useTranslations("datePicker");
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const latest = max ? toDate(max) : undefined;
  const label = selected
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(selected)
    : t("placeholder");

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          {...aria}
          className={cn(
            "flex h-11 w-full items-center gap-3 rounded-xl border border-input bg-transparent px-3 text-start text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50",
            clearable && value && "pe-11",
            className
          )}
        >
          <CalendarDays aria-hidden className="size-[1.125rem] shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>{label}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? latest}
            disabled={latest ? { after: latest } : undefined}
            locale={locale === "ar" ? ar : undefined}
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSelect={(date) => {
              setValue(date ? toValue(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <button
          type="button"
          aria-label={t("clear")}
          title={t("clear")}
          onClick={() => setValue("")}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
