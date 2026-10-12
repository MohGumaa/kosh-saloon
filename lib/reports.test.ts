import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSION_KEYS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/auth/permissions";
import {
  breakdownRows,
  canViewRevenueReport,
  parseRevenueReport,
  revenueReportHref,
  revenueSections,
  type GroupedRevenue,
} from "@/lib/reports";

const today = "2026-10-07"; // a Wednesday

const parse = (params: Record<string, string>, day = today) => {
  const { period, from, to, group, allowedGroups, invalidCustom } = parseRevenueReport(params, day);
  return { period, from, to, group, allowedGroups, invalidCustom };
};

describe("parseRevenueReport presets", () => {
  it("defaults to this month by day for a missing or unknown period", () => {
    const month = {
      period: "month",
      from: "2026-10-01",
      to: today,
      group: "day",
      allowedGroups: ["day", "week", "month"],
      invalidCustom: false,
    };
    expect(parse({})).toEqual(month);
    expect(parse({ period: "forever" })).toEqual(month);
  });

  it("covers today only", () => {
    expect(parse({ period: "today" })).toMatchObject({ from: today, to: today, group: "day" });
  });

  it.each([
    ["2026-10-05", "2026-10-05"], // Monday: just today
    ["2026-10-11", "2026-10-05"], // Sunday: the whole week
  ])("covers this week from Monday when today is %s", (day, monday) => {
    expect(parse({ period: "week" }, day)).toMatchObject({ period: "week", from: monday, to: day });
  });

  it("covers this year from 1 January, grouped by month", () => {
    expect(parse({ period: "year" })).toEqual({
      period: "year",
      from: "2026-01-01",
      to: today,
      group: "month",
      allowedGroups: ["week", "month"],
      invalidCustom: false,
    });
  });

  it("offers days early in the year, while the range is short", () => {
    expect(parse({ period: "year" }, "2026-02-10")).toMatchObject({ group: "day", allowedGroups: ["day", "week", "month"] });
  });
});

describe("parseRevenueReport custom", () => {
  it("accepts a valid range, including a full year", () => {
    expect(parse({ period: "custom", from: "2026-09-01", to: "2026-09-30" })).toMatchObject({
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
      invalidCustom: false,
    });
    expect(parse({ period: "custom", from: "2025-10-07", to: today })).toMatchObject({ period: "custom", group: "month" });
  });

  it.each([
    ["reversed", { from: "2026-09-30", to: "2026-09-01" }],
    ["in the future", { from: "2026-10-01", to: "2026-10-08" }],
    ["longer than 366 days", { from: "2025-10-06", to: today }],
    ["malformed", { from: "2026-02-30", to: "2026-03-01" }],
    ["missing an end", { from: "2026-09-01" }],
  ])("falls back to this month and flags a range that is %s", (_, dates) => {
    const result = parseRevenueReport({ period: "custom", ...dates }, today);
    expect(result).toMatchObject({ period: "month", from: "2026-10-01", to: today, invalidCustom: true });
    expect(result.submitted).toEqual({ from: dates.from, to: (dates as { to?: string }).to });
  });
});

describe("parseRevenueReport grouping", () => {
  it("uses an allowed requested grouping", () => {
    expect(parse({ group: "week" })).toMatchObject({ group: "week" });
    expect(parse({ group: "month" })).toMatchObject({ group: "month" });
  });

  it("ignores an unknown grouping", () => {
    expect(parse({ group: "hour" })).toMatchObject({ group: "day" });
  });

  it("refuses days for a 63-day range but allows them at 62", () => {
    expect(parse({ period: "custom", from: "2026-08-06", to: today, group: "day" })).toMatchObject({
      group: "month",
      allowedGroups: ["week", "month"],
    });
    expect(parse({ period: "custom", from: "2026-08-07", to: today, group: "day" })).toMatchObject({ group: "day" });
  });
});

describe("revenueReportHref", () => {
  const month = parseRevenueReport({}, today);

  it("leaves out default values", () => {
    expect(revenueReportHref(month, { period: "month" }, today)).toBe("/reports/revenue");
    expect(revenueReportHref(month, { group: "day" }, today)).toBe("/reports/revenue");
  });

  it("keeps the grouping when changing the period, unless the new range refuses it", () => {
    const weekly = parseRevenueReport({ group: "week" }, today);
    expect(revenueReportHref(weekly, { period: "today" }, today)).toBe("/reports/revenue?period=today&group=week");

    const daily = parseRevenueReport({ period: "week" }, today);
    expect(revenueReportHref(daily, { period: "year" }, today)).toBe("/reports/revenue?period=year");
  });

  it("keeps a custom range when changing the grouping", () => {
    const custom = parseRevenueReport({ period: "custom", from: "2026-09-01", to: "2026-09-30" }, today);
    expect(revenueReportHref(custom, { group: "week" }, today)).toBe(
      "/reports/revenue?period=custom&from=2026-09-01&to=2026-09-30&group=week",
    );
  });
});

describe("revenue report access", () => {
  const set = (keys: readonly PermissionKey[]) => new Set(keys);

  it("allows an ADMIN and a default Supervisor", () => {
    expect(canViewRevenueReport({ role: "ADMIN" }, set(PERMISSION_KEYS))).toBe(true);
    expect(canViewRevenueReport({ role: "SUPERVISOR" }, set(ROLE_DEFAULTS.SUPERVISOR))).toBe(true);
  });

  it("denies a Supervisor without reports.view", () => {
    const keys = ROLE_DEFAULTS.SUPERVISOR.filter((key) => key !== "reports.view");
    expect(canViewRevenueReport({ role: "SUPERVISOR" }, set(keys))).toBe(false);
  });

  it("denies Staff even when granted reports.view", () => {
    expect(canViewRevenueReport({ role: "STAFF" }, set([...ROLE_DEFAULTS.STAFF, "reports.view"]))).toBe(false);
  });

  it("shows revenue by employee only with reports.view_all_employees", () => {
    expect(revenueSections(set(ROLE_DEFAULTS.SUPERVISOR))).toEqual({ byEmployee: true });
    expect(revenueSections(set(["reports.view"]))).toEqual({ byEmployee: false });
  });
});

describe("breakdownRows", () => {
  const row = (id: string, status: string, amount: string | null, count: number): GroupedRevenue => ({
    id,
    status,
    amount: amount === null ? null : new Prisma.Decimal(amount),
    count,
  });
  const names = new Map([
    ["a", "Beard"],
    ["b", "Haircut"],
    ["c", "Color"],
  ]);

  it("merges statuses per id, skips cancelled and unknown ids, and sorts by gross then name", () => {
    const rows = breakdownRows(
      [
        row("b", "PAID", "100", 2),
        row("a", "PAID", "60", 3),
        row("a", "UNPAID", "40", 1),
        row("c", "CANCELLED", "500", 4),
        row("gone", "PAID", "900", 1),
        row("c", "UNPAID", null, 0),
      ],
      names,
      (name) => name,
    );
    expect(rows.map((r) => [r.id, r.count, r.paid.toString(), r.unpaid.toString(), r.gross.toString()])).toEqual([
      ["a", 4, "60", "40", "100"],
      ["b", 2, "100", "0", "100"],
      ["c", 0, "0", "0", "0"],
    ]);
  });
});
