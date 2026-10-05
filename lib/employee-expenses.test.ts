import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_EXPENSE_CATEGORIES,
  employeeExpenseListHref,
  employeeExpenseSchema,
  employeeExpenseWhere,
  parseEmployeeExpenseFilters,
} from "@/lib/employee-expenses";

const TODAY = "2026-10-05";
const schema = employeeExpenseSchema(TODAY);
const valid = { category: "CASH_ADVANCE", amount: "300", description: "", date: "2026-10-01" };

const fieldsWithIssues = (input: Record<string, string>) => {
  const result = schema.safeParse(input);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path[0]))];
};

describe("employeeExpenseSchema", () => {
  it("accepts a valid deduction and normalizes it", () => {
    expect(schema.parse({ ...valid, amount: "٣٠٠٫٥٠" })).toEqual({
      category: "CASH_ADVANCE",
      amount: "300.5",
      description: null,
      date: "2026-10-01",
    });
  });

  it.each(EMPLOYEE_EXPENSE_CATEGORIES)("accepts the %s category", (category) => {
    expect(schema.safeParse({ ...valid, category }).success).toBe(true);
  });

  it("rejects an empty or unknown category, including a salon expense category", () => {
    expect(fieldsWithIssues({ ...valid, category: "" })).toEqual(["category"]);
    expect(fieldsWithIssues({ ...valid, category: "RENT" })).toEqual(["category"]);
  });

  it("rejects a zero, negative, or too precise amount", () => {
    for (const amount of ["0", "٠", "-5", "10.555", "", "abc", "123456789"]) {
      expect(fieldsWithIssues({ ...valid, amount }), amount).toEqual(["amount"]);
    }
  });

  it("accepts any real day up to today and rejects the rest", () => {
    expect(schema.safeParse({ ...valid, date: TODAY }).success).toBe(true);
    for (const date of ["2026-10-06", "2026-02-30", "2026-10-5", "05/10/2026", ""]) {
      expect(fieldsWithIssues({ ...valid, date }), date).toEqual(["date"]);
    }
  });

  it("keeps line breaks in the description and caps it at 500 characters", () => {
    expect(schema.parse({ ...valid, description: " Taken in cash\r\nRepay in November " }).description).toBe(
      "Taken in cash\nRepay in November",
    );
    expect(schema.parse({ ...valid, description: "a".repeat(500) }).description).toHaveLength(500);
    expect(fieldsWithIssues({ ...valid, description: "a".repeat(501) })).toEqual(["description"]);
  });
});

describe("parseEmployeeExpenseFilters", () => {
  it("keeps every valid filter", () => {
    expect(parseEmployeeExpenseFilters({ category: "WITHDRAWAL", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      category: "WITHDRAWAL",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("drops invalid values without erroring", () => {
    expect(
      parseEmployeeExpenseFilters({ category: "RENT", from: "2026-02-30", to: "yesterday", tab: "expenses" }),
    ).toEqual({});
  });

  it("drops both dates of a backwards range and keeps either date alone", () => {
    expect(parseEmployeeExpenseFilters({ from: "2026-10-02", to: "2026-10-01" })).toEqual({});
    expect(parseEmployeeExpenseFilters({ from: "2026-10-01" })).toEqual({ from: "2026-10-01" });
    expect(parseEmployeeExpenseFilters({ to: ["2026-10-01", "2026-10-09"] })).toEqual({ to: "2026-10-01" });
  });
});

describe("employeeExpenseWhere", () => {
  it("always limits the list to the one employee", () => {
    expect(employeeExpenseWhere("emp1", {})).toEqual({ employeeId: "emp1" });
  });

  it("bounds the date column inclusively and matches the category", () => {
    expect(employeeExpenseWhere("emp1", { category: "OTHER", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      employeeId: "emp1",
      category: "OTHER",
      date: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") },
    });
  });
});

describe("employeeExpenseListHref", () => {
  it("stays on the tab, keeps the filters, and leaves out page 1", () => {
    expect(employeeExpenseListHref("emp1", {})).toBe("/employees/emp1?tab=expenses");
    expect(employeeExpenseListHref("emp1", { category: "OTHER" }, 1)).toBe("/employees/emp1?tab=expenses&category=OTHER");
    expect(employeeExpenseListHref("emp1", { from: "2026-10-01" }, 3)).toBe(
      "/employees/emp1?tab=expenses&from=2026-10-01&page=3",
    );
  });
});
