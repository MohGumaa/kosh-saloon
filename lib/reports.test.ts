import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { PERMISSION_KEYS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/auth/permissions";
import {
  breakdownRows,
  canViewEmployeePerformance,
  canViewExpenseReport,
  employeePerformanceRows,
  employeeReportScope,
  employeeReportSections,
  canViewRevenueReport,
  expenseBreakdown,
  expenseSections,
  parseRevenueReport,
  reportHref,
  revenueSections,
  parseSettlementReport,
  settlementMonthOptions,
  settlementReportHref,
  settlementReportScope,
  settlementReportTotals,
  type GroupedExpense,
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

describe("reportHref", () => {
  const PATH = "/reports/revenue";
  const month = parseRevenueReport({}, today);

  it("leaves out default values", () => {
    expect(reportHref(PATH, month, { period: "month" }, today)).toBe("/reports/revenue");
    expect(reportHref(PATH, month, { group: "day" }, today)).toBe("/reports/revenue");
  });

  it("keeps the grouping when changing the period, unless the new range refuses it", () => {
    const weekly = parseRevenueReport({ group: "week" }, today);
    expect(reportHref(PATH, weekly, { period: "today" }, today)).toBe("/reports/revenue?period=today&group=week");

    const daily = parseRevenueReport({ period: "week" }, today);
    expect(reportHref(PATH, daily, { period: "year" }, today)).toBe("/reports/revenue?period=year");
  });

  it("keeps a custom range when changing the grouping", () => {
    const custom = parseRevenueReport({ period: "custom", from: "2026-09-01", to: "2026-09-30" }, today);
    expect(reportHref(PATH, custom, { group: "week" }, today)).toBe(
      "/reports/revenue?period=custom&from=2026-09-01&to=2026-09-30&group=week",
    );
  });

  it("links to the given report path", () => {
    expect(reportHref("/reports/expenses", month, { period: "month" }, today)).toBe("/reports/expenses");
    expect(reportHref("/reports/expenses", month, { period: "week" }, today)).toBe("/reports/expenses?period=week");
  });

  it("keeps other params of the page, leaving out empty ones", () => {
    const keep = { employee: "emp1" };
    expect(reportHref(PATH, month, { period: "month" }, today, keep)).toBe("/reports/revenue?employee=emp1");
    expect(reportHref(PATH, month, { period: "week" }, today, keep)).toBe("/reports/revenue?period=week&employee=emp1");
    expect(reportHref(PATH, month, { group: "week" }, today, keep)).toBe("/reports/revenue?group=week&employee=emp1");
    const custom = parseRevenueReport({ period: "custom", from: "2026-09-01", to: "2026-09-30" }, today);
    expect(reportHref(PATH, custom, { group: "day" }, today, keep)).toBe(
      "/reports/revenue?period=custom&from=2026-09-01&to=2026-09-30&employee=emp1",
    );
    expect(reportHref(PATH, month, { period: "week" }, today, { employee: "" })).toBe("/reports/revenue?period=week");
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

describe("expense report access", () => {
  const set = (keys: readonly PermissionKey[]) => new Set(keys);
  const without = (...drop: PermissionKey[]) => ROLE_DEFAULTS.SUPERVISOR.filter((key) => !drop.includes(key));

  it("allows an ADMIN and a default Supervisor with every section", () => {
    expect(canViewExpenseReport({ role: "ADMIN" }, set(PERMISSION_KEYS))).toBe(true);
    expect(canViewExpenseReport({ role: "SUPERVISOR" }, set(ROLE_DEFAULTS.SUPERVISOR))).toBe(true);
    expect(expenseSections(set(ROLE_DEFAULTS.SUPERVISOR))).toEqual({ salon: true, employee: true, byEmployee: true });
  });

  it("denies a Supervisor without reports.view or without either expense view", () => {
    expect(canViewExpenseReport({ role: "SUPERVISOR" }, set(without("reports.view")))).toBe(false);
    const neither = without("expenses.view", "employee_expenses.view");
    expect(canViewExpenseReport({ role: "SUPERVISOR" }, set(neither))).toBe(false);
  });

  it("allows one expense view alone, with only its section", () => {
    const salonOnly = set(without("employee_expenses.view"));
    expect(canViewExpenseReport({ role: "SUPERVISOR" }, salonOnly)).toBe(true);
    expect(expenseSections(salonOnly)).toEqual({ salon: true, employee: false, byEmployee: false });

    const employeeOnly = set(without("expenses.view"));
    expect(canViewExpenseReport({ role: "SUPERVISOR" }, employeeOnly)).toBe(true);
    expect(expenseSections(employeeOnly)).toEqual({ salon: false, employee: true, byEmployee: true });
  });

  it("shows deductions by employee only with reports.view_all_employees", () => {
    expect(expenseSections(set(without("reports.view_all_employees")))).toEqual({
      salon: true,
      employee: true,
      byEmployee: false,
    });
  });

  it("denies Staff even when granted every key", () => {
    expect(canViewExpenseReport({ role: "STAFF" }, set(PERMISSION_KEYS))).toBe(false);
  });
});

describe("expenseBreakdown", () => {
  const row = (id: string, amount: string | null, count: number): GroupedExpense => ({
    id,
    amount: amount === null ? null : new Prisma.Decimal(amount),
    count,
  });
  const names = new Map([
    ["RENT", "Rent"],
    ["WATER", "Water"],
    ["OTHER", "Other"],
  ]);

  it("skips unknown ids, treats a null sum as zero, and sorts by total then name", () => {
    const rows = expenseBreakdown(
      [row("WATER", "50", 1), row("gone", "900", 2), row("RENT", "3000", 1), row("OTHER", "50", 3), row("x", null, 0)],
      new Map([...names, ["x", "Zero"]]),
      (name) => name,
    );
    expect(rows.map((r) => [r.id, r.count, r.total.toString()])).toEqual([
      ["RENT", 1, "3000"],
      ["OTHER", 3, "50"],
      ["WATER", 1, "50"],
      ["x", 0, "0"],
    ]);
  });
});

describe("employee performance report access", () => {
  const set = (keys: readonly PermissionKey[]) => new Set(keys);
  const without = (keys: readonly PermissionKey[], ...drop: PermissionKey[]) => keys.filter((key) => !drop.includes(key));

  it("covers every employee for an Admin and a default Supervisor", () => {
    expect(employeeReportScope({ role: "ADMIN" }, set(PERMISSION_KEYS))).toBe("all");
    expect(employeeReportScope({ role: "SUPERVISOR" }, set(ROLE_DEFAULTS.SUPERVISOR))).toBe("all");
  });

  it("falls back to the viewer's own figures without reports.view_all_employees", () => {
    const keys = [...without(ROLE_DEFAULTS.SUPERVISOR, "reports.view_all_employees"), "reports.view_own_performance"] as const;
    expect(employeeReportScope({ role: "SUPERVISOR" }, set(keys))).toBe("own");
  });

  it("denies a Supervisor with neither all-employees nor own performance", () => {
    expect(employeeReportScope({ role: "SUPERVISOR" }, set(without(ROLE_DEFAULTS.SUPERVISOR, "reports.view_all_employees")))).toBe(
      null,
    );
  });

  it("limits Staff to their own figures, even when granted every key", () => {
    expect(employeeReportScope({ role: "STAFF" }, set(ROLE_DEFAULTS.STAFF))).toBe("own");
    expect(employeeReportScope({ role: "STAFF" }, set(PERMISSION_KEYS))).toBe("own");
    expect(employeeReportScope({ role: "STAFF" }, set(without(ROLE_DEFAULTS.STAFF, "reports.view_own_performance")))).toBe(
      null,
    );
  });

  it("shows the profile Performance tab for any employee in scope all, otherwise only on the viewer's own", () => {
    const admin = { id: "a1", role: "ADMIN" } as const;
    const supervisor = { id: "s1", role: "SUPERVISOR" } as const;
    const staff = { id: "t1", role: "STAFF" } as const;
    expect(canViewEmployeePerformance(admin, set(PERMISSION_KEYS), "u2")).toBe(true);
    expect(canViewEmployeePerformance(supervisor, set(ROLE_DEFAULTS.SUPERVISOR), "u2")).toBe(true);
    const own = [...without(ROLE_DEFAULTS.SUPERVISOR, "reports.view_all_employees"), "reports.view_own_performance"] as const;
    expect(canViewEmployeePerformance(supervisor, set(own), "u2")).toBe(false);
    expect(canViewEmployeePerformance(supervisor, set(own), "s1")).toBe(true);
    expect(canViewEmployeePerformance(supervisor, set(without(ROLE_DEFAULTS.SUPERVISOR, "reports.view_all_employees")), "s1")).toBe(false);
    expect(canViewEmployeePerformance(staff, set(PERMISSION_KEYS), "u2")).toBe(false);
    expect(canViewEmployeePerformance(staff, set(PERMISSION_KEYS), "t1")).toBe(true);
  });

  it("shows deductions with employee_expenses.view, and always for the viewer's own", () => {
    expect(employeeReportSections("all", set(ROLE_DEFAULTS.SUPERVISOR))).toEqual({ expenses: true });
    expect(employeeReportSections("all", set(["reports.view", "reports.view_all_employees"]))).toEqual({ expenses: false });
    expect(employeeReportSections("own", set(ROLE_DEFAULTS.STAFF))).toEqual({ expenses: true });
  });
});

describe("employeePerformanceRows", () => {
  const d = (value: string) => new Prisma.Decimal(value);
  const invoice = (id: string, status: string, amount: string, count: number): GroupedRevenue => ({
    id,
    status,
    amount: d(amount),
    count,
  });
  const employee = (id: string, name: string, share: string | null = null) => ({
    id,
    name,
    image: null,
    isActive: true,
    sharePercentage: share === null ? null : d(share),
  });
  const details = new Map([
    ["a", employee("a", "Omar")],
    ["b", employee("b", "Ali", "0")],
    ["c", employee("c", "Sami")],
  ]);

  it("follows the worked example: paid 5,000 at 50% less 300 pays 2,200", () => {
    const [row] = employeePerformanceRows(
      [invoice("a", "PAID", "5000", 10), invoice("a", "UNPAID", "400", 2), invoice("a", "CANCELLED", "900", 3)],
      [{ id: "a", amount: d("300"), count: 2 }],
      details,
      "50",
    );
    expect(row.paid.toString()).toBe("5000");
    expect(row.unpaid.toString()).toBe("400");
    expect([row.paidCount, row.unpaidCount, row.expenseCount]).toEqual([10, 2, 2]);
    expect(row.sharePercentage.toString()).toBe("50");
    expect(row.shareSource).toBe("salon");
    expect(row.earnings.toString()).toBe("2500");
    expect(row.expenses.toString()).toBe("300");
    expect(row.payout.toString()).toBe("2200");
  });

  it("uses an employee's own 0% share, so deductions make the payout negative", () => {
    const [row] = employeePerformanceRows([invoice("b", "PAID", "1000", 1)], [{ id: "b", amount: d("50"), count: 1 }], details, "50");
    expect(row.shareSource).toBe("employee");
    expect(row.earnings.toString()).toBe("0");
    expect(row.payout.toString()).toBe("-50");
  });

  it("rounds earnings as a settlement does", () => {
    const [row] = employeePerformanceRows([invoice("a", "PAID", "10.05", 1)], [], details, "50");
    expect(row.earnings.toString()).toBe("5.03");
  });

  it("lists an employee with deductions only, and leaves out cancelled-only and unknown ids", () => {
    const rows = employeePerformanceRows(
      [invoice("c", "CANCELLED", "100", 1), invoice("x", "PAID", "100", 1)],
      [{ id: "c", amount: d("20"), count: 1 }],
      details,
      "50",
    );
    expect(rows.map((row) => [row.id, row.paid.toString(), row.payout.toString()])).toEqual([["c", "0", "-20"]]);
  });

  it("sorts by paid revenue, then by name", () => {
    const rows = employeePerformanceRows(
      [invoice("a", "PAID", "100", 1), invoice("b", "PAID", "300", 1), invoice("c", "PAID", "100", 1)],
      [],
      details,
      "50",
    );
    expect(rows.map((row) => row.id)).toEqual(["b", "a", "c"]);
  });
});

describe("settlementReportScope", () => {
  const set = (keys: readonly PermissionKey[]) => new Set(keys);
  const without = (keys: readonly PermissionKey[], ...drop: PermissionKey[]) => keys.filter((key) => !drop.includes(key));

  it("covers every employee for an Admin and a default Supervisor", () => {
    expect(settlementReportScope({ role: "ADMIN" }, set(PERMISSION_KEYS))).toBe("all");
    expect(settlementReportScope({ role: "SUPERVISOR" }, set(ROLE_DEFAULTS.SUPERVISOR))).toBe("all");
  });

  it("denies a Supervisor without reports.view or settlements.view", () => {
    expect(settlementReportScope({ role: "SUPERVISOR" }, set(without(ROLE_DEFAULTS.SUPERVISOR, "reports.view")))).toBeNull();
    expect(settlementReportScope({ role: "SUPERVISOR" }, set(without(ROLE_DEFAULTS.SUPERVISOR, "settlements.view")))).toBeNull();
  });

  it("keeps Staff to their own settlements, whatever they hold", () => {
    expect(settlementReportScope({ role: "STAFF" }, set(ROLE_DEFAULTS.STAFF))).toBe("own");
    expect(settlementReportScope({ role: "STAFF" }, set(PERMISSION_KEYS))).toBe("own");
    expect(settlementReportScope({ role: "STAFF" }, set(without(ROLE_DEFAULTS.STAFF, "settlements.view")))).toBeNull();
  });
});

describe("parseSettlementReport", () => {
  const latest = "2026-09";
  const parseMonths = (params: Record<string, string>, last = latest) => {
    const { period, from, to, invalidCustom } = parseSettlementReport(params, last);
    return { period, from, to, invalidCustom };
  };

  it("defaults to the latest month's year for a missing or unknown period", () => {
    const year = { period: "year", from: "2026-01", to: latest, invalidCustom: false };
    expect(parseMonths({})).toEqual(year);
    expect(parseMonths({ period: "forever" })).toEqual(year);
  });

  it("covers the last twelve months", () => {
    expect(parseMonths({ period: "last12" })).toEqual({ period: "last12", from: "2025-10", to: latest, invalidCustom: false });
  });

  it("covers the previous year in January, when the latest settleable month is December", () => {
    expect(parseMonths({}, "2025-12")).toMatchObject({ from: "2025-01", to: "2025-12" });
    expect(parseMonths({ period: "last12" }, "2025-12")).toMatchObject({ from: "2025-01", to: "2025-12" });
  });

  it("accepts a custom range up to the latest month", () => {
    expect(parseSettlementReport({ period: "custom", from: "2024-11", to: latest }, latest)).toEqual({
      period: "custom",
      from: "2024-11",
      to: latest,
      invalidCustom: false,
      submitted: { from: "2024-11", to: latest },
    });
    expect(parseMonths({ period: "custom", from: "2026-03", to: "2026-03" })).toMatchObject({ from: "2026-03", to: "2026-03" });
  });

  it.each<[Record<string, string>]>([
    [{ period: "custom" }],
    [{ period: "custom", from: "2026-3", to: "2026-05" }],
    [{ period: "custom", from: "2026-13", to: "2026-05" }],
    [{ period: "custom", from: "2026-06", to: "2026-05" }],
    [{ period: "custom", from: "2026-01", to: "2026-10" }],
  ])("falls back to the year for an invalid custom range %o", (params) => {
    const range = parseSettlementReport(params, latest);
    expect(range).toMatchObject({ period: "year", from: "2026-01", to: latest, invalidCustom: true });
    expect(range.submitted).toEqual({ from: params.from, to: params.to });
  });
});

describe("settlementReportHref", () => {
  it("leaves the default period out of the URL", () => {
    expect(settlementReportHref("year")).toBe("/reports/settlements");
    expect(settlementReportHref("last12")).toBe("/reports/settlements?period=last12");
  });
});

describe("settlementMonthOptions", () => {
  it("offers the latest month's year when nothing is settled, newest first", () => {
    expect(settlementMonthOptions(null, "2026-03")).toEqual(["2026-03", "2026-02", "2026-01"]);
  });

  it("reaches back to the first settled month", () => {
    expect(settlementMonthOptions("2025-11", "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
    expect(settlementMonthOptions("2026-02", "2026-03")).toEqual(["2026-03", "2026-02", "2026-01"]);
  });
});

describe("settlementReportTotals", () => {
  const d = (value: string) => new Prisma.Decimal(value);
  const sara = { id: "e1", name: "Sara" };
  const adam = { id: "e2", name: "Adam" };
  const settlement = (
    month: string,
    status: "DRAFT" | "CALCULATED" | "APPROVED" | "PAID",
    employee: { id: string; name: string },
    share: string,
    revenue: string,
    earnings: string,
    expenses: string,
    adjustments: string,
    final: string,
  ) => ({
    periodStart: new Date(`${month}-01T00:00:00.000Z`),
    status,
    employee,
    sharePercentage: d(share),
    totalRevenue: d(revenue),
    employeeShare: d(earnings),
    totalExpenses: d(expenses),
    totalAdjustments: d(adjustments),
    finalAmount: d(final),
  });

  const rows = [
    settlement("2026-08", "PAID", sara, "50", "5000.00", "2500.00", "300.00", "0", "2200.00"),
    settlement("2026-06", "PAID", sara, "60", "1000.10", "600.06", "0", "-100.00", "500.06"),
    settlement("2026-08", "APPROVED", adam, "50", "100.00", "50.00", "200.00", "0", "-150.00"),
    settlement("2026-08", "DRAFT", { id: "e3", name: "Zaid" }, "50", "0.20", "0.10", "0", "0", "0.10"),
    settlement("2026-06", "CALCULATED", adam, "50", "200.00", "100.00", "0", "0", "100.00"),
  ];

  it("totals every status, drafts included", () => {
    const { total, awaitingApproval, byStatus } = settlementReportTotals(rows);
    expect(total.count).toBe(5);
    expect(total.revenue.toString()).toBe("6300.3");
    expect(total.final.toString()).toBe("2650.16");
    expect(total.paid.toString()).toBe("2700.06");
    expect(awaitingApproval.count).toBe(2);
    expect(awaitingApproval.final.toString()).toBe("100.1");
    expect(byStatus.map((row) => [row.status, row.count, row.final.toString()])).toEqual([
      ["DRAFT", 1, "0.1"],
      ["CALCULATED", 1, "100"],
      ["APPROVED", 1, "-150"],
      ["PAID", 2, "2700.06"],
    ]);
  });

  it("lists only months with settlements, oldest first", () => {
    const { byMonth } = settlementReportTotals(rows);
    expect(byMonth.map((row) => [row.month, row.count, row.final.toString(), row.paid.toString()])).toEqual([
      ["2026-06", 2, "600.06", "500.06"],
      ["2026-08", 3, "2050.1", "2200"],
    ]);
  });

  it("sums each employee by name, with the share range when it changed", () => {
    const { byEmployee } = settlementReportTotals(rows, "en");
    expect(byEmployee.map((row) => row.employee.name)).toEqual(["Adam", "Sara", "Zaid"]);
    const [adamRow, saraRow] = byEmployee;
    expect(adamRow.count).toBe(2);
    expect(adamRow.final.toString()).toBe("-50");
    expect(adamRow.final.isNegative()).toBe(true);
    expect([adamRow.minShare.toString(), adamRow.maxShare.toString()]).toEqual(["50", "50"]);
    expect([saraRow.minShare.toString(), saraRow.maxShare.toString()]).toEqual(["50", "60"]);
    expect(saraRow.adjustments.toString()).toBe("-100");
  });

  it("is all zeros without settlements", () => {
    const { total, byStatus, byMonth, byEmployee } = settlementReportTotals([]);
    expect(total.count).toBe(0);
    expect(total.final.isZero()).toBe(true);
    expect(byStatus).toHaveLength(4);
    expect(byMonth).toEqual([]);
    expect(byEmployee).toEqual([]);
  });
});
