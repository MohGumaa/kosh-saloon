import { describe, expect, it } from "vitest";
import { getDirection, isLocale, localeFromCookie } from "@/i18n/locales";

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

describe("localeFromCookie", () => {
  it("falls back to English without a cookie", () => {
    expect(localeFromCookie("")).toBe("en");
  });

  it("reads a stored locale", () => {
    expect(localeFromCookie("NEXT_LOCALE=ar")).toBe("ar");
    expect(localeFromCookie("NEXT_LOCALE=en")).toBe("en");
  });

  it("finds the locale among other cookies", () => {
    expect(localeFromCookie("theme=dark; NEXT_LOCALE=ar; other=1")).toBe("ar");
  });

  it("falls back to English for an unknown value", () => {
    expect(localeFromCookie("NEXT_LOCALE=fr")).toBe("en");
  });

  it("ignores cookies whose name only contains the locale cookie name", () => {
    expect(localeFromCookie("X_NEXT_LOCALE=ar")).toBe("en");
  });
});
