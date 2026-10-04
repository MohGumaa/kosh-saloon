import { describe, expect, it } from "vitest";
import { priceSchema, serviceIdSchema, serviceSchema } from "@/lib/services";

const service = { nameEn: "Haircut", nameAr: "حلاقة شعر", defaultPrice: "50" };

describe("serviceSchema", () => {
  it("trims both names", () => {
    expect(serviceSchema.parse({ ...service, nameEn: "  Haircut ", nameAr: " حلاقة شعر  " })).toEqual(service);
  });

  it("requires both names", () => {
    expect(serviceSchema.safeParse({ ...service, nameEn: "   " }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, nameAr: "" }).success).toBe(false);
  });

  it("limits each name to 100 characters", () => {
    expect(serviceSchema.safeParse({ ...service, nameEn: "a".repeat(100) }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...service, nameEn: "a".repeat(101) }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, nameAr: "ب".repeat(101) }).success).toBe(false);
  });

  it("rejects a name with a line break or control character", () => {
    expect(serviceSchema.safeParse({ ...service, nameEn: "Hair\ncut" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, nameAr: "حلاقة\u0000" }).success).toBe(false);
  });

  it("keeps the zero-width joiners some Arabic names use", () => {
    expect(serviceSchema.parse({ ...service, nameAr: "حلاقة‌شعر" }).nameAr).toBe("حلاقة‌شعر");
  });
});

describe("priceSchema", () => {
  const parse = (value: string) => priceSchema.safeParse(value);

  it("accepts whole and decimal prices in their shortest form", () => {
    expect(parse("50").data).toBe("50");
    expect(parse("50.5").data).toBe("50.5");
    expect(parse("50.50").data).toBe("50.5");
    expect(parse(" 0050.00 ").data).toBe("50");
    expect(parse("0.01").data).toBe("0.01");
  });

  it("rejects zero, negative, and non-numeric prices", () => {
    expect(parse("0").success).toBe(false);
    expect(parse("0.00").success).toBe(false);
    expect(parse("-1").success).toBe(false);
    expect(parse("abc").success).toBe(false);
    expect(parse("").success).toBe(false);
    expect(parse("1e3").success).toBe(false);
  });

  it("rejects more than two decimal places", () => {
    expect(parse("50.555").success).toBe(false);
  });

  it("accepts the column maximum and rejects anything wider", () => {
    expect(parse("99999999.99").data).toBe("99999999.99");
    expect(parse("100000000").success).toBe(false);
  });

  it("accepts Arabic-Indic digits and the Arabic decimal separator", () => {
    expect(parse("٥٠٫٥").data).toBe("50.5");
    expect(parse("۱۲۰").data).toBe("120");
  });
});

describe("serviceIdSchema", () => {
  it("requires a short non-empty id", () => {
    expect(serviceIdSchema.safeParse("").success).toBe(false);
    expect(serviceIdSchema.safeParse("a".repeat(101)).success).toBe(false);
    expect(serviceIdSchema.safeParse("cm1abc").success).toBe(true);
  });
});
