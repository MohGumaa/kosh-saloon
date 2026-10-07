"use client";

import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface RevenueChartPoint {
  /** Already formatted on the server, so server and client agree. */
  label: string;
  paid: number;
  unpaid: number;
  expenses?: number;
}

interface RevenueChartProps {
  data: RevenueChartPoint[];
  locale: string;
  currency: string;
  rtl: boolean;
  showExpenses: boolean;
  labels: { period: string; paid: string; unpaid: string; expenses: string; empty: string; caption: string };
}

/** Paid and unpaid revenue stacked per bucket, with salon expenses beside them when the viewer may see them. */
export function RevenueChart({ data, locale, currency, rtl, showExpenses, labels }: RevenueChartProps) {
  const price = new Intl.NumberFormat(locale, { style: "currency", currency });
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const empty = data.every((point) => point.paid === 0 && point.unpaid === 0 && !point.expenses);

  if (empty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <BarChart3 aria-hidden className="size-5" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">{labels.empty}</p>
      </div>
    );
  }

  return (
    <>
      <div aria-hidden className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              minTickGap={12}
            />
            <YAxis
              orientation={rtl ? "right" : "left"}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(value: number) => compact.format(value)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              formatter={(value) => price.format(Number(value))}
              contentStyle={{
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="paid" name={labels.paid} stackId="revenue" fill="var(--chart-1)" />
            <Bar dataKey="unpaid" name={labels.unpaid} stackId="revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            {showExpenses && <Bar dataKey="expenses" name={labels.expenses} fill="var(--chart-5)" radius={[4, 4, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{labels.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{labels.period}</th>
            <th scope="col">{labels.paid}</th>
            <th scope="col">{labels.unpaid}</th>
            {showExpenses && <th scope="col">{labels.expenses}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{price.format(point.paid)}</td>
              <td>{price.format(point.unpaid)}</td>
              {showExpenses && <td>{price.format(point.expenses ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
