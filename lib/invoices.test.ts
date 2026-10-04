import { describe, expect, it } from "vitest";
import {
  canChangeStatus,
  canManageInvoices,
  createInvoiceSchema,
  formatInvoiceNumber,
  invoiceListHref,
  invoiceWhere,
  isOwnScope,
  nextInvoiceNumber,
  parseInvoiceFilters,
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

describe("createInvoiceSchema", () => {
  const valid = { employeeId: "u1", serviceId: "s1", amount: "50", status: "PAID" };

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
