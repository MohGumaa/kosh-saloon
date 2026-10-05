import { describe, expect, it } from "vitest";
import {
  EXPENSE_CATEGORIES,
  dateValue,
  dayOf,
  expenseListHref,
  expenseSchema,
  expenseWhere,
  parseExpenseFilters,
  salonToday,
} from "@/lib/expenses";

const TODAY = "2026-10-05";
const schema = expenseSchema(TODAY);
const valid = { title: "October rent", description: "", category: "RENT", amount: "4500", date: "2026-10-01" };

const fieldsWithIssues = (input: Record<string, string>) => {
  const result = schema.safeParse(input);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path[0]))];
};

describe("expenseSchema", () => {
  it("accepts a valid expense and normalizes it", () => {
    expect(schema.parse({ ...valid, title: "  October rent  ", amount: "٤٥٠٠٫٥٠" })).toEqual({
      title: "October rent",
      description: null,
      category: "RENT",
      amount: "4500.5",
      date: "2026-10-01",
    });
  });

  it("rejects an empty, overlong, or multi-line title", () => {
    expect(fieldsWithIssues({ ...valid, title: "   " })).toEqual(["title"]);
    expect(fieldsWithIssues({ ...valid, title: "a".repeat(101) })).toEqual(["title"]);
    expect(fieldsWithIssues({ ...valid, title: "rent\nOctober" })).toEqual(["title"]);
    expect(schema.parse({ ...valid, title: "a".repeat(100) }).title).toHaveLength(100);
  });

  it("keeps line breaks in the description and caps it at 500 characters", () => {
    expect(schema.parse({ ...valid, description: " Paid in cash\r\nReceipt in drawer " }).description).toBe(
      "Paid in cash\nReceipt in drawer",
    );
    expect(schema.parse({ ...valid, description: "a".repeat(500) }).description).toHaveLength(500);
    expect(fieldsWithIssues({ ...valid, description: "a".repeat(501) })).toEqual(["description"]);
    expect(fieldsWithIssues({ ...valid, description: "tab\there" })).toEqual(["description"]);
  });

  it.each(EXPENSE_CATEGORIES)("accepts the %s category", (category) => {
    expect(schema.safeParse({ ...valid, category }).success).toBe(true);
  });

  it("rejects an empty or unknown category", () => {
    expect(fieldsWithIssues({ ...valid, category: "" })).toEqual(["category"]);
    expect(fieldsWithIssues({ ...valid, category: "UTILITIES" })).toEqual(["category"]);
  });

  it("rejects a zero, negative, or too precise amount", () => {
    for (const amount of ["0", "-5", "10.555", "", "abc", "123456789"]) {
      expect(fieldsWithIssues({ ...valid, amount }), amount).toEqual(["amount"]);
    }
  });

  it("accepts any real day up to today and rejects the rest", () => {
    expect(schema.safeParse({ ...valid, date: TODAY }).success).toBe(true);
    expect(schema.safeParse({ ...valid, date: "2020-02-29" }).success).toBe(true);
    for (const date of ["2026-10-06", "2026-02-30", "2026-10-5", "05/10/2026", ""]) {
      expect(fieldsWithIssues({ ...valid, date }), date).toEqual(["date"]);
    }
  });
});

describe("salonToday", () => {
  it("gives the calendar day in the salon time zone", () => {
    expect(salonToday(new Date("2026-10-04T20:30:00Z"))).toBe("2026-10-05");
    expect(salonToday(new Date("2026-10-04T19:30:00Z"))).toBe("2026-10-04");
  });

  it("takes the time zone as a parameter", () => {
    expect(salonToday(new Date("2026-10-04T20:30:00Z"), "UTC")).toBe("2026-10-04");
  });
});

describe("dateValue and dayOf", () => {
  it("round-trips a calendar day through a UTC midnight Date", () => {
    expect(dateValue("2026-10-01").toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(dayOf(dateValue("2026-10-01"))).toBe("2026-10-01");
  });
});

describe("parseExpenseFilters", () => {
  it("keeps every valid filter", () => {
    expect(parseExpenseFilters({ q: " rent ", category: "RENT", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      q: "rent",
      category: "RENT",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("drops invalid values without erroring", () => {
    expect(
      parseExpenseFilters({ q: "  ", category: "UTILITIES", from: "2026-02-30", to: "yesterday", page: "2" }),
    ).toEqual({});
    expect(parseExpenseFilters({ q: "a".repeat(101) })).toEqual({});
  });

  it("drops both dates of a backwards range", () => {
    expect(parseExpenseFilters({ from: "2026-10-02", to: "2026-10-01" })).toEqual({});
  });

  it("keeps either date alone and uses the first of repeated values", () => {
    expect(parseExpenseFilters({ from: "2026-10-01" })).toEqual({ from: "2026-10-01" });
    expect(parseExpenseFilters({ to: ["2026-10-01", "2026-10-09"] })).toEqual({ to: "2026-10-01" });
  });
});

describe("expenseWhere", () => {
  it("lists everything with no filters", () => {
    expect(expenseWhere({})).toEqual({});
  });

  it("bounds the date column inclusively and matches the category and search text", () => {
    expect(expenseWhere({ q: "rent", category: "RENT", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      category: "RENT",
      date: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") },
      OR: [
        { title: { contains: "rent", mode: "insensitive" } },
        { description: { contains: "rent", mode: "insensitive" } },
      ],
    });
  });

  it("handles one open end, including the last representable day", () => {
    expect(expenseWhere({ to: "9999-12-31" })).toEqual({ date: { lte: new Date("9999-12-31T00:00:00.000Z") } });
  });
});

describe("expenseListHref", () => {
  it("keeps the filters and leaves out page 1", () => {
    expect(expenseListHref({})).toBe("/expenses");
    expect(expenseListHref({ category: "RENT", q: "a b" }, 1)).toBe("/expenses?q=a+b&category=RENT");
    expect(expenseListHref({ from: "2026-10-01" }, 3)).toBe("/expenses?from=2026-10-01&page=3");
  });
});
