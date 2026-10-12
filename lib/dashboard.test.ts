import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/auth/permissions";
import {
  addDays,
  averageBill,
  bucketExpenses,
  bucketInvoices,
  canViewSalonDashboard,
  chartBuckets,
  dashboardSections,
  parseDashboardPeriod,
  personalSections,
  weekStart,
} from "@/lib/dashboard";

const range = (params: Record<string, string>, today: string) => {
  const { period, from, to, granularity, invalidCustom } = parseDashboardPeriod(params, today);
  return { period, from, to, granularity, invalidCustom };
};

describe("weekStart", () => {
  it.each([
    ["2026-10-05", "2026-10-05"], // Monday
    ["2026-10-07", "2026-10-05"], // Wednesday
    ["2026-10-11", "2026-10-05"], // Sunday
    ["2027-01-01", "2026-12-28"], // across a year boundary
  ])("%s starts on %s", (day, monday) => {
    expect(weekStart(day)).toBe(monday);
  });
});

describe("parseDashboardPeriod presets", () => {
  const today = "2026-10-07";

  it("defaults to this month for a missing or unknown period", () => {
    const month = { period: "month", from: "2026-10-01", to: today, granularity: "day", invalidCustom: false };
    expect(range({}, today)).toEqual(month);
    expect(range({ period: "forever" }, today)).toEqual(month);
  });

  it.each([
    ["today", "2026-10-07", "2026-10-07", "day"],
    ["last7", "2026-10-01", "2026-10-07", "day"],
    ["week", "2026-10-05", "2026-10-07", "day"],
    ["previousMonth", "2026-09-01", "2026-09-30", "day"],
    ["last12", "2025-11-01", "2026-10-07", "month"],
  ])("%s covers %s to %s by %s", (period, from, to, granularity) => {
    expect(range({ period }, today)).toEqual({ period, from, to, granularity, invalidCustom: false });
  });

  it("crosses the year boundary for previousMonth and last12 in January", () => {
    expect(range({ period: "previousMonth" }, "2027-01-15")).toMatchObject({ from: "2026-12-01", to: "2026-12-31" });
    expect(range({ period: "last12" }, "2027-01-15")).toMatchObject({ from: "2026-02-01", to: "2027-01-15" });
  });

  it("handles a leap-year February as the previous month", () => {
    expect(range({ period: "previousMonth" }, "2028-03-10")).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("uses the first value of a repeated param", () => {
    expect(parseDashboardPeriod({ period: ["today", "month"] }, today).period).toBe("today");
  });
});

describe("parseDashboardPeriod custom", () => {
  const today = "2026-10-07";

  it("accepts a valid range and keeps the submitted dates", () => {
    const result = parseDashboardPeriod({ period: "custom", from: "2026-08-01", to: "2026-08-31" }, today);
    expect(result).toEqual({
      period: "custom",
      from: "2026-08-01",
      to: "2026-08-31",
      granularity: "day",
      invalidCustom: false,
      submitted: { from: "2026-08-01", to: "2026-08-31" },
    });
  });

  it("switches to monthly bars past 62 days", () => {
    expect(range({ period: "custom", from: "2026-08-01", to: "2026-10-01" }, today).granularity).toBe("day"); // 62 days
    expect(range({ period: "custom", from: "2026-08-01", to: "2026-10-02" }, today).granularity).toBe("month"); // 63 days
  });

  it("allows exactly 366 days", () => {
    expect(range({ period: "custom", from: addDays(today, -365), to: today }, today).invalidCustom).toBe(false);
  });

  it.each([
    ["missing dates", {}],
    ["a missing end", { from: "2026-09-01" }],
    ["an impossible date", { from: "2026-02-30", to: "2026-03-01" }],
    ["a backwards range", { from: "2026-09-10", to: "2026-09-01" }],
    ["a future end", { from: "2026-10-01", to: "2026-10-08" }],
    ["more than 366 days", { from: addDays(today, -366), to: today }],
  ])("falls back to this month for %s", (_, dates) => {
    const result = parseDashboardPeriod({ period: "custom", ...dates }, today);
    expect(result).toMatchObject({ period: "month", from: "2026-10-01", to: today, invalidCustom: true });
    expect(result.submitted).toEqual({ from: (dates as { from?: string }).from, to: (dates as { to?: string }).to });
  });
});

describe("chartBuckets", () => {
  it("lists every day, across a month boundary", () => {
    expect(chartBuckets("2026-09-29", "2026-10-02", "day")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("lists every month, across a year boundary", () => {
    expect(chartBuckets("2026-11-15", "2027-02-03", "month")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("lists every week's Monday, starting before `from` and across a year boundary", () => {
    // 2026-12-24 is a Thursday; 2027-01-04 is a Monday.
    expect(chartBuckets("2026-12-24", "2027-01-04", "week")).toEqual(["2026-12-21", "2026-12-28", "2027-01-04"]);
  });

  it("lists one week when the range sits inside it", () => {
    expect(chartBuckets("2026-10-06", "2026-10-07", "week")).toEqual(["2026-10-05"]);
  });
});

describe("bucketInvoices", () => {
  const keys = ["2026-10-06", "2026-10-07"];

  it("fills zeros and splits paid from unpaid, skipping cancelled", () => {
    const buckets = bucketInvoices(
      [
        { createdAt: new Date("2026-10-07T08:00:00Z"), amount: "100", status: "PAID" },
        { createdAt: new Date("2026-10-07T09:00:00Z"), amount: "40.50", status: "UNPAID" },
        { createdAt: new Date("2026-10-07T10:00:00Z"), amount: "999", status: "CANCELLED" },
      ],
      keys,
      "day",
    );
    expect(buckets.map((b) => [b.key, b.paid.toString(), b.unpaid.toString()])).toEqual([
      ["2026-10-06", "0", "0"],
      ["2026-10-07", "100", "40.5"],
    ]);
  });

  it("uses the salon day: 21:30 UTC is already the next day in Dubai", () => {
    const [previous, next] = bucketInvoices(
      [{ createdAt: new Date("2026-10-06T21:30:00Z"), amount: "50", status: "PAID" }],
      keys,
      "day",
    );
    expect(previous.paid.toString()).toBe("0");
    expect(next.paid.toString()).toBe("50");
  });

  it("groups by month and ignores rows outside the buckets", () => {
    const buckets = bucketInvoices(
      [
        { createdAt: new Date("2026-09-03T08:00:00Z"), amount: "10", status: "PAID" },
        { createdAt: new Date("2026-09-28T08:00:00Z"), amount: "15", status: "PAID" },
        { createdAt: new Date("2026-07-01T08:00:00Z"), amount: "70", status: "PAID" },
      ],
      ["2026-09", "2026-10"],
      "month",
    );
    expect(buckets.map((b) => b.paid.toString())).toEqual(["25", "0"]);
  });

  it("counts paid and unpaid invoices per bucket, never cancelled ones", () => {
    const [empty, full] = bucketInvoices(
      [
        { createdAt: new Date("2026-10-07T08:00:00Z"), amount: "100", status: "PAID" },
        { createdAt: new Date("2026-10-07T08:30:00Z"), amount: "20", status: "PAID" },
        { createdAt: new Date("2026-10-07T09:00:00Z"), amount: "40", status: "UNPAID" },
        { createdAt: new Date("2026-10-07T10:00:00Z"), amount: "999", status: "CANCELLED" },
      ],
      keys,
      "day",
    );
    expect([empty.paidCount, empty.unpaidCount]).toEqual([0, 0]);
    expect([full.paidCount, full.unpaidCount]).toEqual([2, 1]);
  });

  it("groups by week, across a month boundary, by salon day", () => {
    const buckets = bucketInvoices(
      [
        { createdAt: new Date("2026-09-28T08:00:00Z"), amount: "10", status: "PAID" }, // Monday
        { createdAt: new Date("2026-10-04T08:00:00Z"), amount: "15", status: "UNPAID" }, // Sunday, same week
        { createdAt: new Date("2026-10-04T21:00:00Z"), amount: "5", status: "PAID" }, // Monday 01:00 in Dubai
      ],
      ["2026-09-28", "2026-10-05"],
      "week",
    );
    expect(buckets.map((b) => [b.key, b.paid.toString(), b.unpaid.toString()])).toEqual([
      ["2026-09-28", "10", "15"],
      ["2026-10-05", "5", "0"],
    ]);
  });
});

describe("bucketExpenses", () => {
  it("totals by the expense's calendar day in key order", () => {
    const totals = bucketExpenses(
      [
        { date: new Date("2026-10-07T00:00:00Z"), amount: "20" },
        { date: new Date("2026-10-07T00:00:00Z"), amount: "5.25" },
        { date: new Date("2026-10-01T00:00:00Z"), amount: "100" },
      ],
      ["2026-10-06", "2026-10-07"],
      "day",
    );
    expect(totals.map(String)).toEqual(["0", "25.25"]);
  });
});

describe("averageBill", () => {
  it("is null with no bills", () => {
    expect(averageBill("0", 0)).toBeNull();
  });

  it("divides the total by the bill count", () => {
    expect(averageBill("250", 4)?.toString()).toBe("62.5");
  });
});

describe("dashboard access", () => {
  const all: ReadonlySet<PermissionKey> = new Set(PERMISSION_KEYS);
  const reports: ReadonlySet<PermissionKey> = new Set(["reports.view"]);

  it("lets an ADMIN and a Supervisor with reports.view see salon figures", () => {
    expect(canViewSalonDashboard({ role: "ADMIN" }, all)).toBe(true);
    expect(canViewSalonDashboard({ role: "SUPERVISOR" }, reports)).toBe(true);
  });

  it("denies a Supervisor without reports.view and Staff even with it", () => {
    expect(canViewSalonDashboard({ role: "SUPERVISOR" }, new Set(["invoices.view"]))).toBe(false);
    expect(canViewSalonDashboard({ role: "STAFF" }, all)).toBe(false);
  });

  it("enables each extra widget only with its permission", () => {
    expect(dashboardSections(all)).toEqual({ expenses: true, payouts: true, latestInvoices: true });
    expect(dashboardSections(reports)).toEqual({ expenses: false, payouts: false, latestInvoices: false });
    expect(dashboardSections(new Set(["expenses.view"]))).toEqual({
      expenses: true,
      payouts: false,
      latestInvoices: false,
    });
  });
});

describe("personalSections", () => {
  it("shows both sections with the Staff defaults", () => {
    expect(personalSections(new Set(ROLE_DEFAULTS.STAFF))).toEqual({ figures: true, settlement: true });
  });

  it("shows neither without the permissions", () => {
    expect(personalSections(new Set())).toEqual({ figures: false, settlement: false });
  });

  it("shows each section only with its own permission", () => {
    expect(personalSections(new Set(["reports.view_own_performance"]))).toEqual({ figures: true, settlement: false });
    expect(personalSections(new Set(["settlements.view"]))).toEqual({ figures: false, settlement: true });
  });
});
