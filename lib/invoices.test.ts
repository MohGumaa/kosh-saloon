import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/auth/permissions";
import {
  canChangeStatus,
  canManageInvoices,
  canViewEmployeeInvoices,
  createInvoiceSchema,
  employeeInvoiceListHref,
  formatInvoiceNumber,
  invoiceCountSchema,
  invoiceCreatedAt,
  invoiceDateSchema,
  invoiceDaySchema,
  invoiceListHref,
  invoiceWhere,
  isOwnScope,
  nextInvoiceNumber,
  nextInvoiceNumbers,
  parseInvoiceFilters,
  parseSalonDateTime,
  salonDateTimeInput,
  salonDayRange,
} from "@/lib/invoices";

describe("invoice numbers", () => {
  it("starts at INV-000001", () => {
    expect(nextInvoiceNumber(null)).toBe("INV-000001");
  });

  it("adds one to the highest stored number", () => {
    expect(nextInvoiceNumber("INV-000041")).toBe("INV-000042");
    expect(nextInvoiceNumber("INV-099999")).toBe("INV-100000");
  });

  it("throws past INV-999999 instead of breaking the string order", () => {
    expect(nextInvoiceNumber("INV-999998")).toBe("INV-999999");
    expect(() => nextInvoiceNumber("INV-999999")).toThrow();
  });

  it("throws on a stored number in another format", () => {
    expect(() => nextInvoiceNumber("INV-42")).toThrow();
  });

  it("formats only whole numbers in range", () => {
    expect(formatInvoiceNumber(7)).toBe("INV-000007");
    expect(() => formatInvoiceNumber(0)).toThrow();
    expect(() => formatInvoiceNumber(1.5)).toThrow();
  });
});

describe("nextInvoiceNumbers", () => {
  it("returns consecutive numbers after the highest", () => {
    expect(nextInvoiceNumbers(null, 3)).toEqual(["INV-000001", "INV-000002", "INV-000003"]);
    expect(nextInvoiceNumbers("INV-000041", 3)).toEqual(["INV-000042", "INV-000043", "INV-000044"]);
    expect(nextInvoiceNumbers("INV-000041", 1)).toEqual(["INV-000042"]);
  });

  it("throws when the batch would pass INV-999999", () => {
    expect(nextInvoiceNumbers("INV-999998", 1)).toEqual(["INV-999999"]);
    expect(() => nextInvoiceNumbers("INV-999998", 2)).toThrow();
  });
});

describe("invoice create day and count", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 10:30 on 15 September in Dubai.
  const now = new Date("2026-09-15T06:30:00.000Z");

  it.each([
    ["1", 1],
    ["20", 20],
    ["٣", 3],
    [" 05 ", 5],
  ])("accepts the count %j as %j", (count, expected) => {
    expect(invoiceCountSchema.parse(count)).toBe(expected);
  });

  it.each(["0", "21", "1.5", "-1", "", "abc", "100"])("rejects the count %j", (count) => {
    expect(invoiceCountSchema.safeParse(count).success).toBe(false);
  });

  it("accepts today and a past day, and rejects a future or invalid day", () => {
    vi.useFakeTimers({ now });
    expect(invoiceDaySchema.safeParse("2026-09-15").success).toBe(true);
    expect(invoiceDaySchema.safeParse("2026-08-01").success).toBe(true);
    for (const day of ["2026-09-16", "2026-02-30", "15-09-2026", "2026-9-1", ""]) {
      expect(invoiceDaySchema.safeParse(day).success).toBe(false);
    }
  });

  it("uses the salon day, not the UTC day, for today", () => {
    // 01:00 on 16 September in Dubai, still 15 September in UTC.
    vi.useFakeTimers({ now: new Date("2026-09-15T21:00:00.000Z") });
    expect(invoiceDaySchema.safeParse("2026-09-16").success).toBe(true);
  });

  it("dates today's invoice now and a past day's at 12:00 salon time", () => {
    expect(invoiceCreatedAt("2026-09-15", now)).toBe(now);
    expect(invoiceCreatedAt("2026-09-01", now)).toEqual(new Date("2026-09-01T08:00:00.000Z"));
  });
});

describe("createInvoiceSchema", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const valid = { employeeId: "u1", serviceId: "s1", amount: "50", status: "PAID", date: "2026-09-15", count: "1" };

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-09-15T06:30:00.000Z") });
  });

  it("returns the day and count", () => {
    expect(createInvoiceSchema.parse({ ...valid, count: "3" })).toMatchObject({ date: "2026-09-15", count: 3 });
  });

  it("rejects a missing day or count", () => {
    expect(createInvoiceSchema.safeParse({ ...valid, date: "" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...valid, count: "" }).success).toBe(false);
  });

  it("accepts Paid and Unpaid", () => {
    expect(createInvoiceSchema.safeParse(valid).success).toBe(true);
    expect(createInvoiceSchema.safeParse({ ...valid, status: "UNPAID" }).success).toBe(true);
  });

  it.each(["CANCELLED", "", "REFUNDED", "paid"])("rejects the status %j", (status) => {
    expect(createInvoiceSchema.safeParse({ ...valid, status }).success).toBe(false);
  });

  it.each([
    ["50", "50"],
    ["50.50", "50.5"],
    ["٢٥٫٥", "25.5"],
    ["99999999.99", "99999999.99"],
  ])("normalizes the amount %j to %j", (amount, expected) => {
    expect(createInvoiceSchema.parse({ ...valid, amount }).amount).toBe(expected);
  });

  it.each(["0", "-1", "50.555", "abc", "", "100000000"])("rejects the amount %j", (amount) => {
    expect(createInvoiceSchema.safeParse({ ...valid, amount }).success).toBe(false);
  });

  it("rejects an empty employee or service", () => {
    expect(createInvoiceSchema.safeParse({ ...valid, employeeId: "" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...valid, serviceId: "" }).success).toBe(false);
  });
});

describe("canChangeStatus", () => {
  it("allows any move between different statuses until cancelled", () => {
    expect(canChangeStatus("UNPAID", "PAID")).toBe(true);
    expect(canChangeStatus("PAID", "UNPAID")).toBe(true);
    expect(canChangeStatus("PAID", "CANCELLED")).toBe(true);
    expect(canChangeStatus("UNPAID", "CANCELLED")).toBe(true);
  });

  it("never moves a cancelled invoice and treats the same status as no change", () => {
    expect(canChangeStatus("CANCELLED", "PAID")).toBe(false);
    expect(canChangeStatus("CANCELLED", "CANCELLED")).toBe(false);
    expect(canChangeStatus("PAID", "PAID")).toBe(false);
  });
});

describe("scope helpers", () => {
  it.each([
    ["ADMIN", false, true],
    ["SUPERVISOR", false, true],
    ["STAFF", true, false],
  ] as const)("%s: own scope %s, manages %s", (role, own, manages) => {
    expect(isOwnScope({ role })).toBe(own);
    expect(canManageInvoices({ role })).toBe(manages);
  });
});

describe("parseInvoiceFilters", () => {
  it("keeps every valid filter", () => {
    expect(
      parseInvoiceFilters({
        q: "  hair ",
        employee: "u1",
        service: "s1",
        status: "UNPAID",
        from: "2026-10-01",
        to: "2026-10-04",
        min: "١٠",
        max: "99.90",
      }),
    ).toEqual({
      q: "hair",
      employee: "u1",
      service: "s1",
      status: "UNPAID",
      from: "2026-10-01",
      to: "2026-10-04",
      min: "10",
      max: "99.9",
    });
  });

  it("drops invalid values without failing", () => {
    expect(
      parseInvoiceFilters({
        q: "   ",
        employee: "x".repeat(101),
        status: "REFUNDED",
        from: "2026-02-30",
        to: "04/10/2026",
        min: "-5",
        max: "ten",
      }),
    ).toEqual({});
  });

  it("drops a multi-line or too-long search", () => {
    expect(parseInvoiceFilters({ q: "a\nb" })).toEqual({});
    expect(parseInvoiceFilters({ q: "a".repeat(101) })).toEqual({});
  });

  it("drops both dates when from is after to", () => {
    expect(parseInvoiceFilters({ from: "2026-10-05", to: "2026-10-04" })).toEqual({});
  });

  it("keeps a single date end and allows a zero amount", () => {
    expect(parseInvoiceFilters({ to: "2026-10-04", min: "0" })).toEqual({ to: "2026-10-04", min: "0" });
  });

  it("uses the first of repeated values", () => {
    expect(parseInvoiceFilters({ status: ["PAID", "UNPAID"] })).toEqual({ status: "PAID" });
  });
});

describe("salonDayRange", () => {
  it("bounds a Dubai day in UTC", () => {
    expect(salonDayRange("2026-10-04", "2026-10-04", "Asia/Dubai")).toEqual({
      gte: new Date("2026-10-03T20:00:00.000Z"),
      lt: new Date("2026-10-04T20:00:00.000Z"),
    });
  });

  it("crosses a month end and allows one open end", () => {
    expect(salonDayRange(undefined, "2026-10-31", "Asia/Dubai")).toEqual({ lt: new Date("2026-10-31T20:00:00.000Z") });
    expect(salonDayRange("2026-10-01", undefined, "Asia/Dubai")).toEqual({ gte: new Date("2026-09-30T20:00:00.000Z") });
  });

  it("handles the last day a date input allows", () => {
    expect(salonDayRange("9999-12-31", "9999-12-31", "Asia/Dubai")).toEqual({
      gte: new Date("9999-12-30T20:00:00.000Z"),
      lt: new Date("9999-12-31T20:00:00.000Z"),
    });
  });

  it("follows a daylight saving zone", () => {
    // London is UTC+1 until 25 October 2026, then UTC+0.
    expect(salonDayRange("2026-10-25", "2026-10-25", "Europe/London")).toEqual({
      gte: new Date("2026-10-24T23:00:00.000Z"),
      lt: new Date("2026-10-26T00:00:00.000Z"),
    });
  });
});

describe("salon date and time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts a Dubai wall-clock time to an instant and back", () => {
    const instant = parseSalonDateTime("2026-10-04T14:30");
    expect(instant).toEqual(new Date("2026-10-04T10:30:00.000Z"));
    expect(salonDateTimeInput(instant!)).toBe("2026-10-04T14:30");
  });

  it("keeps 00:30 on the 1st in that salon month, though UTC is still the previous month", () => {
    expect(parseSalonDateTime("2026-10-01T00:30")).toEqual(new Date("2026-09-30T20:30:00.000Z"));
    expect(salonDateTimeInput(new Date("2026-09-30T20:30:45.500Z"))).toBe("2026-10-01T00:30");
  });

  it("follows a daylight saving zone", () => {
    expect(parseSalonDateTime("2026-10-24T12:00", "Europe/London")).toEqual(new Date("2026-10-24T11:00:00.000Z"));
    expect(parseSalonDateTime("2026-10-26T12:00", "Europe/London")).toEqual(new Date("2026-10-26T12:00:00.000Z"));
  });

  it.each(["", "2026-10-04", "2026-10-04T14:30:00", "2026-02-30T10:00", "2026-10-04T25:00", "2026-10-04T10:60", "4/10/2026 10:00"])(
    "rejects %j",
    (value) => {
      expect(parseSalonDateTime(value)).toBeNull();
    },
  );

  it("accepts a past or current time and rejects a future one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T08:00:30.000Z"));

    expect(invoiceDateSchema.safeParse("2026-10-19T12:00").success).toBe(true);
    expect(invoiceDateSchema.safeParse("2026-10-19T12:01").success).toBe(false);
    expect(invoiceDateSchema.safeParse("2026-02-30T10:00").success).toBe(false);
  });
});

describe("invoiceWhere", () => {
  const admin = { id: "admin1", role: "ADMIN" } as const;
  const staff = { id: "staff1", role: "STAFF" } as const;

  it("limits a Staff user to their own invoices, ignoring the employee filter", () => {
    expect(invoiceWhere({ employee: "other" }, staff)).toEqual({ employeeId: "staff1" });
  });

  it("applies every filter for a manager", () => {
    expect(
      invoiceWhere(
        { employee: "u1", service: "s1", status: "PAID", from: "2026-10-04", min: "10", max: "20", q: "INV" },
        admin,
        "Asia/Dubai",
      ),
    ).toEqual({
      employeeId: "u1",
      serviceId: "s1",
      status: "PAID",
      createdAt: { gte: new Date("2026-10-03T20:00:00.000Z") },
      amount: { gte: "10", lte: "20" },
      OR: [
        { invoiceNumber: { contains: "INV", mode: "insensitive" } },
        { employee: { name: { contains: "INV", mode: "insensitive" } } },
        { employee: { username: { contains: "INV", mode: "insensitive" } } },
        { service: { nameEn: { contains: "INV", mode: "insensitive" } } },
        { service: { nameAr: { contains: "INV", mode: "insensitive" } } },
      ],
    });
  });

  it("lists everything for a manager with no filters", () => {
    expect(invoiceWhere({}, admin)).toEqual({});
  });
});

describe("invoiceListHref", () => {
  it("keeps the filters and leaves out page 1", () => {
    expect(invoiceListHref({ status: "PAID", q: "a b" })).toBe("/transactions?q=a+b&status=PAID");
    expect(invoiceListHref({}, 1)).toBe("/transactions");
    expect(invoiceListHref({ status: "PAID" }, 3)).toBe("/transactions?status=PAID&page=3");
  });
});

describe("employee profile Invoices tab", () => {
  const set = (keys: readonly PermissionKey[]) => new Set(keys);
  const admin = { id: "a1", role: "ADMIN" } as const;
  const supervisor = { id: "s1", role: "SUPERVISOR" } as const;
  const staff = { id: "t1", role: "STAFF" } as const;

  it("shows any employee's invoices with invoices.view, except to Staff", () => {
    expect(canViewEmployeeInvoices(admin, set(PERMISSION_KEYS), "u2")).toBe(true);
    expect(canViewEmployeeInvoices(supervisor, set(ROLE_DEFAULTS.SUPERVISOR), "u2")).toBe(true);
    const keys = ROLE_DEFAULTS.SUPERVISOR.filter((key) => key !== "invoices.view");
    expect(canViewEmployeeInvoices(supervisor, set(keys), "u2")).toBe(false);
    expect(canViewEmployeeInvoices(supervisor, set(keys), "s1")).toBe(false);
  });

  it("limits Staff to their own profile, even when granted every key", () => {
    expect(canViewEmployeeInvoices(staff, set(PERMISSION_KEYS), "u2")).toBe(false);
    expect(canViewEmployeeInvoices(staff, set(PERMISSION_KEYS), "t1")).toBe(true);
  });

  it("builds the tab URL with only its own filters", () => {
    expect(employeeInvoiceListHref("u2", {})).toBe("/employees/u2?tab=invoices");
    expect(employeeInvoiceListHref("u2", { status: "PAID", from: "2026-10-01", to: "2026-10-07" })).toBe(
      "/employees/u2?tab=invoices&status=PAID&from=2026-10-01&to=2026-10-07",
    );
    expect(employeeInvoiceListHref("u2", { q: "a", service: "s", employee: "x", min: "1", max: "2" })).toBe(
      "/employees/u2?tab=invoices",
    );
    expect(employeeInvoiceListHref("u2", { status: "UNPAID" }, 2)).toBe("/employees/u2?tab=invoices&status=UNPAID&page=2");
    expect(employeeInvoiceListHref("u2", {}, 1)).toBe("/employees/u2?tab=invoices");
  });
});
