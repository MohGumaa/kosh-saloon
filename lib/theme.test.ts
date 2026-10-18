import { describe, expect, it } from "vitest";
import { fromStoredTheme, isThemeValue, toStoredTheme } from "@/lib/theme";

describe("theme values", () => {
  it("accepts only the three switcher values", () => {
    expect(["light", "dark", "system"].every(isThemeValue)).toBe(true);
    for (const value of ["LIGHT", "Dark", "", "blue", null, undefined, 1, {}]) {
      expect(isThemeValue(value)).toBe(false);
    }
  });

  it("maps one-to-one between switcher and stored values", () => {
    expect(toStoredTheme("light")).toBe("LIGHT");
    expect(toStoredTheme("dark")).toBe("DARK");
    expect(toStoredTheme("system")).toBe("SYSTEM");
    expect(fromStoredTheme("LIGHT")).toBe("light");
    expect(fromStoredTheme("DARK")).toBe("dark");
    expect(fromStoredTheme("SYSTEM")).toBe("system");
  });
});
