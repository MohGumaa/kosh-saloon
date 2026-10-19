/**
 * The V1 money rules from the project overview, one `describe` per rule, run through the
 * same pure functions the actions, dashboards, and reports use.
 */
import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { effectiveSharePercentage, paidRevenueWhere } from "@/lib/earnings";
import { calculateSettlement, expensesWhere, sumAdjustments } from "@/lib/settlements";

type Inputs = Parameters<typeof calculateSettlement>[0];

const settle = (inputs: Partial<Inputs>) =>
  calculateSettlement({ paidRevenue: 0, sharePercentage: 50, expenses: 0, adjustments: 0, ...inputs });

const share = (paidRevenue: string, sharePercentage: string) =>
  settle({ paidRevenue, sharePercentage }).employeeShare.toFixed(2);

describe("rule: the effective share is the employee's own percentage, otherwise the salon default", () => {
  it("uses the salon default (50 by default) when the employee has none", () => {
    expect(effectiveSharePercentage(null, "50")).toEqual({ value: new Prisma.Decimal(50), source: "salon" });
  });

  it("uses an own 0.00 as 0%, not as unset", () => {
    const result = effectiveSharePercentage(new Prisma.Decimal("0.00"), "50");

    expect(result.source).toBe("employee");
    expect(result.value.isZero()).toBe(true);
    expect(settle({ paidRevenue: "1200", sharePercentage: result.value }).employeeShare.toFixed(2)).toBe("0.00");
  });

  it("uses an own 100% for the whole paid revenue", () => {
    const { value } = effectiveSharePercentage(new Prisma.Decimal("100"), "50");

    expect(settle({ paidRevenue: "750.25", sharePercentage: value }).employeeShare.toFixed(2)).toBe("750.25");
  });
});

describe("rule: paid revenue counts only PAID invoices of the salon month", () => {
  it.each(["2026-01", "2026-09", "2028-02"])("filters %s to PAID only, so UNPAID and CANCELLED never count", (month) => {
    expect(paidRevenueWhere(month).status).toBe("PAID");
  });

  it("adds many 2-decimal invoices without float drift", () => {
    const invoices = Array.from({ length: 1000 }, () => "0.10");
    const paidRevenue = sumAdjustments(invoices);

    expect(paidRevenue.toFixed(2)).toBe("100.00");
    expect(settle({ paidRevenue }).employeeShare.toFixed(2)).toBe("50.00");
  });
});

describe("rule: employeeShare = paidRevenue * sharePercentage / 100, rounded to 2 decimals half up", () => {
  it.each([
    ["0", "50", "0.00"],
    ["5000", "0", "0.00"],
    ["5000", "100", "5000.00"],
    ["1000", "12.5", "125.00"],
    ["100", "33.33", "33.33"],
    // 3.333
    ["10", "33.33", "3.33"],
    // 0.015 rounds up
    ["0.03", "50", "0.02"],
    // 0.014997 rounds down
    ["0.03", "49.99", "0.01"],
    // 2.675: a float would give 2.67
    ["5.35", "50", "2.68"],
    // 49999999.995, the largest invoice amount
    ["99999999.99", "50", "50000000.00"],
  ])("%s at %s%% is %s", (revenue, percentage, expected) => {
    expect(share(revenue, percentage)).toBe(expected);
  });
});

describe("rule: finalAmount = employeeShare - employeeExpenses + adjustments", () => {
  it("matches the worked example: AED 5,000 at 50%, AED 300 expenses, final AED 2,200", () => {
    const result = settle({ paidRevenue: "5000", sharePercentage: "50", expenses: "300" });

    expect(result.employeeShare.toFixed(2)).toBe("2500.00");
    expect(result.finalAmount.toFixed(2)).toBe("2200.00");
  });

  it("goes negative when expenses exceed the share", () => {
    expect(settle({ paidRevenue: "200", expenses: "250.75" }).finalAmount.toFixed(2)).toBe("-150.75");
  });

  it("goes negative when a deduction exceeds the share", () => {
    expect(settle({ paidRevenue: "200", adjustments: "-300" }).finalAmount.toFixed(2)).toBe("-200.00");
  });

  it("is unchanged by adjustments that cancel out", () => {
    const adjustments = sumAdjustments(["120.50", "-120.50"]);

    expect(adjustments.isZero()).toBe(true);
    expect(settle({ paidRevenue: "5000", expenses: "300", adjustments }).finalAmount.toFixed(2)).toBe("2200.00");
  });

  it("rounds only the share, so expenses and adjustments subtract exactly", () => {
    // 2.675 rounds to 2.68 before 0.01 and -0.01 apply.
    expect(settle({ paidRevenue: "5.35", expenses: "0.01", adjustments: "-0.01" }).finalAmount.toFixed(2)).toBe("2.66");
  });
});

describe("rule: salon expenses and tax never change an employee payout", () => {
  it("takes only the employee's own expenses, filtered by their day in the month", () => {
    // EmployeeExpense rows only: salon expenses are another model with no input here.
    expect(Object.keys(expensesWhere("2026-09"))).toEqual(["date"]);
  });

  it("returns only the six stored settlement values, none of them a tax", () => {
    expect(Object.keys(settle({ paidRevenue: "5000" })).sort()).toEqual([
      "employeeShare",
      "finalAmount",
      "sharePercentage",
      "totalAdjustments",
      "totalExpenses",
      "totalRevenue",
    ]);
  });
});

describe("rule: every surface shows the share a settlement stores", () => {
  const aed = new Intl.NumberFormat("en", { style: "currency", currency: "AED" });

  it("shows 5.35 at 50% as AED 2.68, the stored half-up share", () => {
    const stored = settle({ paidRevenue: "5.35" }).employeeShare;

    expect(stored.toFixed(2)).toBe("2.68");
    expect(aed.format(stored.toNumber())).toBe(aed.format(2.68));
  });
});

describe("rule: a settlement keeps the share percentage it was calculated with", () => {
  it("reproduces its stored values from its own inputs after the salon default changes", () => {
    // September was settled at 50%; the salon default is now 60%.
    const september = settle({ paidRevenue: "5000", sharePercentage: "50", expenses: "300" });
    const newDefault = effectiveSharePercentage(null, "60").value;

    const again = calculateSettlement({
      paidRevenue: september.totalRevenue,
      sharePercentage: september.sharePercentage,
      expenses: september.totalExpenses,
      adjustments: september.totalAdjustments,
    });

    expect(again).toEqual(september);
    expect(again.sharePercentage.toFixed(2)).toBe("50.00");
    // Only a fresh calculation picks up the new default.
    expect(settle({ paidRevenue: "5000", sharePercentage: newDefault, expenses: "300" }).finalAmount.toFixed(2)).toBe(
      "2700.00",
    );
  });
});
