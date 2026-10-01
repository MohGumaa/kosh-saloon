"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

interface LocalDateTimeProps {
  iso: string;
  dateStyle?: "full" | "long" | "medium";
  /** Omit to show the date only. */
  timeStyle?: "short";
}

const subscribe = () => () => {};

/**
 * Shows a timestamp in the viewer's own time zone. The server cannot know that
 * zone, so it renders UTC (labelled when a time is shown) until the browser takes over.
 */
export function LocalDateTime({ iso, dateStyle = "medium", timeStyle }: LocalDateTimeProps) {
  const locale = useLocale();
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  const date = new Date(iso);

  const text = inBrowser
    ? new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date)
    : timeStyle
      ? new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
          timeZoneName: "short",
        }).format(date)
      : new Intl.DateTimeFormat(locale, { dateStyle, timeZone: "UTC" }).format(date);

  return <time dateTime={iso}>{text}</time>;
}
