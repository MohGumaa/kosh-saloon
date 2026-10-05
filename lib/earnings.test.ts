import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  calculateEarnings,
  effectiveSharePercentage,
  paidRevenueWhere,
  parseMonth,
  salonMonth,
  salonMonthRange,
  shiftMonth,
} from "@/lib/earnings";

const share = (paidRevenue: string, sharePercentage: string) =>
  calculateEarnings({ paidRevenue, sharePercentage }).employeeShare.toString();

describe("calculateEarnings", () => {
  it("matches the worked example: AED 5,000 at 50% earns AED 2,500", () => {
    const result = calculateEarnings({ paidRevenue: "5000", sharePercentage: "50" });
    expect(result.paidRevenue.toString()).toBe("5000");
    expect(result.sharePercentage.toString()).toBe("50");
    expect(result.employeeShare.toString()).toBe("2500");
  });

  it.each([
    ["5000", "60", "3000"],
    ["0", "50", "0"],
    ["5000", "0", "0"],
    ["5000", "100", "5000"],
    ["1234.56", "62.5", "771.6"],
  ])("%s at %s%% earns %s", (revenue, percentage, expected) => {
    expect(share(revenue, percentage)).toBe(expected);
  });

  it("stays exact where floats drift", () => {
    const revenue = new Prisma.Decimal("0.10").plus("0.20");
    expect(revenue.toString()).toBe("0.3");
    expect(calculateEarnings({ paidRevenue: revenue, sharePercentage: "100" }).employeeShare.toString()).toBe("0.3");
    expect(share("33.33", "33.33")).toBe("11.108889");
  });
});

describe("effectiveSharePercentage", () => {
  it("uses the salon default when the employee has none", () => {
    const result = effectiveSharePercentage(null, new Prisma.Decimal("50"));
    expect(result.value.toString()).toBe("50");
    expect(result.source).toBe("salon");
  });

  it.each(["0", "62.5", "100"])("uses the employee's own %s%%, 0 included", (own) => {
    const result = effectiveSharePercentage(new Prisma.Decimal(own), "50");
    expect(result.value.toString()).toBe(own);
    expect(result.source).toBe("employee");
  });
});

describe("parseMonth", () => {
  const current = "2026-10";

  it.each(["2026-10", "2026-09", "2025-12", "2000-01"])("keeps %s", (month) => {
    expect(parseMonth(month, current)).toBe(month);
  });

  it.each([
    ["month 00", "2026-00"],
    ["month 13", "2026-13"],
    ["a day", "2026-10-01"],
    ["no padding", "2026-9"],
    ["text", "october"],
    ["empty", ""],
    ["a future month", "2026-11"],
    ["next year", "2027-01"],
  ])("falls back to the current month for %s", (_label, value) => {
    expect(parseMonth(value, current)).toBe(current);
  });

  it("falls back for an array or nothing", () => {
    expect(parseMonth(["2026-09"], current)).toBe(current);
    expect(parseMonth(undefined, current)).toBe(current);
  });
});

describe("shiftMonth", () => {
  it.each([
    ["2026-10", -1, "2026-09"],
    ["2026-10", 1, "2026-11"],
    ["2026-01", -1, "2025-12"],
    ["2025-12", 1, "2026-01"],
    ["2026-03", -15, "2024-12"],
  ])("%s shifted by %i is %s", (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected);
  });
});

describe("salonMonthRange", () => {
  it("covers every Dubai day of the month", () => {
    expect(salonMonthRange("2026-10")).toEqual({
      gte: new Date("2026-09-30T20:00:00.000Z"),
      lt: new Date("2026-10-31T20:00:00.000Z"),
    });
  });

  it("ends a leap-year February on the 29th", () => {
    expect(salonMonthRange("2028-02")).toEqual({
      gte: new Date("2028-01-31T20:00:00.000Z"),
      lt: new Date("2028-02-29T20:00:00.000Z"),
    });
  });

  it("ends December at the start of the next year", () => {
    expect(salonMonthRange("2026-12").lt).toEqual(new Date("2026-12-31T20:00:00.000Z"));
  });
});

describe("salonMonth", () => {
  it("is already the new month just after Dubai midnight on the 1st", () => {
    expect(salonMonth(new Date("2026-09-30T20:00:01Z"))).toBe("2026-10");
    expect(salonMonth(new Date("2026-09-30T19:59:59Z"))).toBe("2026-09");
  });
});

describe("paidRevenueWhere", () => {
  it("counts only PAID invoices in the month", () => {
    expect(paidRevenueWhere("2026-10")).toEqual({ status: "PAID", createdAt: salonMonthRange("2026-10") });
  });
});
