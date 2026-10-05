import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS, type PermissionKey } from "@/lib/auth/permissions";
import {
  ADJUSTMENT_REASON_MAX,
  SETTLEMENT_STATUSES,
  adjustmentAmountSchema,
  adjustmentReasonSchema,
  calculateSettlement,
  canAdjustSettlement,
  canRunSettlementAction,
  expensesWhere,
  isSettleableMonth,
  monthOf,
  monthPeriod,
  parseSettlementMonth,
  sumAdjustments,
  type SettlementAction,
} from "@/lib/settlements";

const values = (result: ReturnType<typeof calculateSettlement>) =>
  Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.toFixed(2)]));

describe("calculateSettlement", () => {
  it("matches the worked example", () => {
    expect(
      values(calculateSettlement({ paidRevenue: "5000", sharePercentage: "50", expenses: "300", adjustments: 0 })),
    ).toEqual({
      totalRevenue: "5000.00",
      sharePercentage: "50.00",
      employeeShare: "2500.00",
      totalExpenses: "300.00",
      totalAdjustments: "0.00",
      finalAmount: "2200.00",
    });
  });

  it("gives a 0% employee a negative payout of their expenses", () => {
    const result = calculateSettlement({ paidRevenue: "1200", sharePercentage: "0", expenses: "150", adjustments: 0 });

    expect(result.employeeShare.toFixed(2)).toBe("0.00");
    expect(result.finalAmount.toFixed(2)).toBe("-150.00");
  });

  it("keeps a negative payout when expenses exceed the share", () => {
    const result = calculateSettlement({ paidRevenue: "100", sharePercentage: "50", expenses: "80", adjustments: 0 });

    expect(result.finalAmount.toFixed(2)).toBe("-30.00");
  });

  it("adds signed adjustments", () => {
    const result = calculateSettlement({ paidRevenue: "100", sharePercentage: "50", expenses: "0", adjustments: "-5.5" });

    expect(result.finalAmount.toFixed(2)).toBe("44.50");
  });

  it("rounds the share to 2 decimals, half up", () => {
    const share = (paidRevenue: string, sharePercentage: string) =>
      calculateSettlement({ paidRevenue, sharePercentage, expenses: 0, adjustments: 0 }).employeeShare.toString();

    // 208.33125
    expect(share("333.33", "62.5")).toBe("208.33");
    // 0.005
    expect(share("0.01", "50")).toBe("0.01");
    // 0.00495
    expect(share("0.01", "49.5")).toBe("0");
  });

  it("stays exact where floats drift", () => {
    const result = calculateSettlement({ paidRevenue: "0.3", sharePercentage: "100", expenses: "0.1", adjustments: "0.2" });

    expect(result.finalAmount.toString()).toBe("0.4");
  });
});

describe("monthPeriod", () => {
  const days = (month: string) => {
    const { periodStart, periodEnd } = monthPeriod(month);
    return [periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)];
  };

  it("covers every day of the month", () => {
    expect(days("2024-02")).toEqual(["2024-02-01", "2024-02-29"]);
    expect(days("2026-02")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(days("2026-12")).toEqual(["2026-12-01", "2026-12-31"]);
  });

  it("stores UTC midnight days that map back to the month", () => {
    expect(monthPeriod("2026-09").periodStart).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(monthOf(monthPeriod("2026-09").periodStart)).toBe("2026-09");
  });

  it("selects expenses dated inside the month", () => {
    expect(expensesWhere("2026-09")).toEqual({
      date: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-30T00:00:00.000Z") },
    });
  });
});

describe("isSettleableMonth", () => {
  it("allows only completed months", () => {
    expect(isSettleableMonth("2026-09", "2026-10")).toBe(true);
    expect(isSettleableMonth("2025-12", "2026-01")).toBe(true);
    expect(isSettleableMonth("2026-10", "2026-10")).toBe(false);
    expect(isSettleableMonth("2026-11", "2026-10")).toBe(false);
    expect(isSettleableMonth("2026-13", "2027-10")).toBe(false);
    expect(isSettleableMonth("abc", "2026-10")).toBe(false);
  });
});

describe("parseSettlementMonth", () => {
  it("keeps a completed month", () => {
    expect(parseSettlementMonth("2026-03", "2026-10")).toBe("2026-03");
  });

  it("falls back to the previous month for anything else", () => {
    for (const value of [undefined, ["2026-03"], "", "abc", "2026-10", "2027-01", "2026-9"]) {
      expect(parseSettlementMonth(value, "2026-10"), String(value)).toBe("2026-09");
    }
    expect(parseSettlementMonth(undefined, "2026-01")).toBe("2025-12");
  });
});

describe("canRunSettlementAction", () => {
  const all = new Set(PERMISSION_KEYS);
  const allowed: Record<SettlementAction, string[]> = {
    recalculate: ["DRAFT", "CALCULATED"],
    calculate: ["DRAFT"],
    approve: ["CALCULATED"],
    pay: ["APPROVED"],
  };

  it("allows each action only from its statuses", () => {
    for (const [action, statuses] of Object.entries(allowed) as [SettlementAction, string[]][]) {
      for (const status of SETTLEMENT_STATUSES) {
        expect(canRunSettlementAction(action, status, all, { role: "ADMIN" }), `${action} ${status}`).toBe(
          statuses.includes(status),
        );
      }
    }
  });

  it("allows nothing on a paid settlement", () => {
    for (const action of Object.keys(allowed) as SettlementAction[]) {
      expect(canRunSettlementAction(action, "PAID", all, { role: "ADMIN" })).toBe(false);
    }
  });

  it("requires each action's permission", () => {
    const only = (key: PermissionKey) => new Set([key]);

    expect(canRunSettlementAction("recalculate", "DRAFT", only("settlements.create"), { role: "SUPERVISOR" })).toBe(true);
    expect(canRunSettlementAction("approve", "CALCULATED", only("settlements.create"), { role: "SUPERVISOR" })).toBe(false);
    expect(canRunSettlementAction("approve", "CALCULATED", only("settlements.approve"), { role: "SUPERVISOR" })).toBe(true);
    expect(canRunSettlementAction("pay", "APPROVED", only("settlements.approve"), { role: "SUPERVISOR" })).toBe(false);
    expect(canRunSettlementAction("pay", "APPROVED", only("settlements.mark_paid"), { role: "SUPERVISOR" })).toBe(true);
  });

  it("lets a default Supervisor prepare settlements but not approve or pay them", () => {
    const defaults = new Set(ROLE_DEFAULTS.SUPERVISOR);
    const supervisor = { role: "SUPERVISOR" } as const;

    expect(canRunSettlementAction("calculate", "DRAFT", defaults, supervisor)).toBe(true);
    expect(canRunSettlementAction("approve", "CALCULATED", defaults, supervisor)).toBe(false);
    expect(canRunSettlementAction("pay", "APPROVED", defaults, supervisor)).toBe(false);
  });

  it("denies Staff every action, even holding every permission", () => {
    for (const [action, statuses] of Object.entries(allowed) as [SettlementAction, string[]][]) {
      expect(canRunSettlementAction(action, statuses[0] as "DRAFT", all, { role: "STAFF" })).toBe(false);
    }
  });
});

describe("adjustmentAmountSchema", () => {
  const parse = (value: string) => adjustmentAmountSchema.safeParse(value);

  it("accepts signed amounts with up to two decimals", () => {
    expect(parse("150").data).toBe("150");
    expect(parse("-150").data).toBe("-150");
    expect(parse(" -75.50 ").data).toBe("-75.5");
    expect(parse("0.01").data).toBe("0.01");
    expect(parse("99999999.99").data).toBe("99999999.99");
  });

  it("accepts the Unicode minus, Arabic-Indic digits, and the Arabic decimal separator", () => {
    expect(parse("−75.5").data).toBe("-75.5");
    expect(parse("-١٥٠٫٢٥").data).toBe("-150.25");
  });

  it("rejects zero, malformed, and oversized amounts", () => {
    for (const value of ["0", "-0", "0.00", "1.234", "+5", "abc", "", "  ", "123456789", "5-", "--5", "1e3"]) {
      expect(parse(value).success, value).toBe(false);
    }
  });
});

describe("adjustmentReasonSchema", () => {
  const parse = (value: string) => adjustmentReasonSchema.safeParse(value);

  it("trims and keeps line breaks", () => {
    expect(parse("  Invoice INV-000012 was refunded\r\nafter payment ").data).toBe(
      "Invoice INV-000012 was refunded\nafter payment",
    );
  });

  it("is required", () => {
    expect(parse("").success).toBe(false);
    expect(parse("   \n ").success).toBe(false);
  });

  it("has a length limit", () => {
    expect(parse("a".repeat(ADJUSTMENT_REASON_MAX)).success).toBe(true);
    expect(parse("a".repeat(ADJUSTMENT_REASON_MAX + 1)).success).toBe(false);
  });

  it("rejects control and format characters", () => {
    expect(parse("bad\u0007bell").success).toBe(false);
    expect(parse("bad\u202Eoverride").success).toBe(false);
  });
});

describe("canAdjustSettlement", () => {
  const all = new Set(PERMISSION_KEYS);

  it("allows only a PAID settlement", () => {
    for (const status of SETTLEMENT_STATUSES) {
      expect(canAdjustSettlement(status, all, { role: "ADMIN" }), status).toBe(status === "PAID");
    }
  });

  it("needs settlements.mark_paid", () => {
    expect(canAdjustSettlement("PAID", new Set(["settlements.mark_paid"] as PermissionKey[]), { role: "SUPERVISOR" })).toBe(
      true,
    );
    expect(canAdjustSettlement("PAID", new Set(["settlements.approve"] as PermissionKey[]), { role: "SUPERVISOR" })).toBe(
      false,
    );
    expect(canAdjustSettlement("PAID", new Set(ROLE_DEFAULTS.SUPERVISOR), { role: "SUPERVISOR" })).toBe(false);
  });

  it("never allows Staff, whatever they hold", () => {
    expect(canAdjustSettlement("PAID", all, { role: "STAFF" })).toBe(false);
  });
});

describe("sumAdjustments", () => {
  it("adds signed amounts exactly", () => {
    expect(sumAdjustments(["0.1", "0.2", "-0.3"]).toFixed(2)).toBe("0.00");
    expect(sumAdjustments(["-150", "25.25"]).toFixed(2)).toBe("-124.75");
    expect(sumAdjustments([]).toFixed(2)).toBe("0.00");
  });

  it("feeds the final amount: the worked example with a -150 correction", () => {
    const result = calculateSettlement({
      paidRevenue: "5000",
      sharePercentage: "50",
      expenses: "300",
      adjustments: sumAdjustments(["-150"]),
    });

    expect(result.totalAdjustments.toFixed(2)).toBe("-150.00");
    expect(result.finalAmount.toFixed(2)).toBe("2050.00");
  });

  it("adds a positive correction to the payout", () => {
    const result = calculateSettlement({ paidRevenue: "5000", sharePercentage: "50", expenses: "300", adjustments: "100" });

    expect(result.finalAmount.toFixed(2)).toBe("2300.00");
  });
});
