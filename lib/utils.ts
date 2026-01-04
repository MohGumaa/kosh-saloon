import { twMerge } from "tailwind-merge"
import { clsx, type ClassValue } from "clsx"
import { Revenue } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (amount: number) => {
  // return amount.toLocaleString('ar-AE', {
  //   style: 'currency',
  //   currency: 'AED',
  //   currencyDisplay: 'name',
  //   maximumFractionDigits: 0,
  // });
  return `${amount.toLocaleString('ar-AE')} درهم`;
};

export const generateYAxis = (revenue: Revenue[]) => {
  // Calculate what labels we need to display on the y-axis
  // based on highest record and in 1000s
  const yAxisLabels = [];
  const highestRecord = Math.max(...revenue.map((month) => month.revenue));
  const topLabel = Math.ceil(highestRecord / 1000) * 1000;

  for (let i = topLabel; i >= 0; i -= 1000) {
    yAxisLabels.push(`$${i / 1000}K`);
  }

  return { yAxisLabels, topLabel };
};
