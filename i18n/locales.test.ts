import { describe, expect, it } from "vitest";
import { getDirection, isLocale } from "@/i18n/locales";

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
  });

  it("rejects unsupported, mis-cased, and non-string values", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(1)).toBe(false);
  });
});

describe("getDirection", () => {
  it("returns rtl for Arabic and ltr for English", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });
});
