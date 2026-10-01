import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  identifierWhere,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "@/lib/auth/validation";

describe("login identifier", () => {
  it("trims and lowercases, matching email when it contains @", () => {
    const parsed = loginSchema.parse({ identifier: "  Admin@Kosh.AE ", password: "x" });
    expect(parsed.identifier).toBe("admin@kosh.ae");
    expect(identifierWhere(parsed.identifier)).toEqual({ email: "admin@kosh.ae" });
    expect(identifierWhere("sara")).toEqual({ username: "sara" });
  });

  it("rejects an empty identifier or password", () => {
    expect(loginSchema.safeParse({ identifier: "   ", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "sara", password: "" }).success).toBe(false);
  });
});

describe("new password rules", () => {
  const base = { currentPassword: "old", newPassword: "12345678", confirmPassword: "12345678" };

  it("accepts 8 to 128 characters", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
    const long = "a".repeat(128);
    expect(changePasswordSchema.safeParse({ ...base, newPassword: long, confirmPassword: long }).success).toBe(true);
  });

  it("rejects too short, too long, and mismatched confirmation", () => {
    expect(changePasswordSchema.safeParse({ ...base, newPassword: "1234567", confirmPassword: "1234567" }).success).toBe(false);
    const tooLong = "a".repeat(129);
    expect(changePasswordSchema.safeParse({ ...base, newPassword: tooLong, confirmPassword: tooLong }).success).toBe(false);

    const mismatch = resetPasswordSchema.safeParse({ token: "t", password: "12345678", confirmPassword: "12345679" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].path).toEqual(["confirmPassword"]);
  });
});

describe("profile rules", () => {
  it("trims the name and stores an empty phone as null", () => {
    expect(profileSchema.parse({ name: " Sara ", phone: "  " })).toEqual({ name: "Sara", phone: null });
    expect(profileSchema.parse({ name: "Sara", phone: "+971 (50) 123-4567" }).phone).toBe("+971 (50) 123-4567");
  });

  it("rejects an empty name, an over-long value, and phone letters", () => {
    expect(profileSchema.safeParse({ name: "  ", phone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "a".repeat(101), phone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Sara", phone: "1".repeat(31) }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Sara", phone: "050-abc" }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Sara", phone: "<script>" }).success).toBe(false);
  });

  it("rejects control, invisible, and letterless names", () => {
    for (const name of ["Sa\u0000ra", "Sara\nAli", "Sara\u2028Ali", "Sara\u2029Ali", "Sara\u202eAli", "\u200b", "\u200c\u200d", "Sara\u200b", "123", "!!!"]) {
      expect(profileSchema.safeParse({ name, phone: "" }).success, JSON.stringify(name)).toBe(false);
    }
  });

  it("accepts names in other scripts, with joiners, digits, and punctuation", () => {
    for (const name of ["سارة علي", "می\u200cخواهم", "Sara O'Neil-2", "José"]) {
      expect(profileSchema.parse({ name, phone: "" }).name).toBe(name);
    }
  });

  it("stores Arabic digits and Unicode spaces in a phone as ASCII", () => {
    expect(profileSchema.parse({ name: "Sara", phone: "٠٥٠ ١٢٣ ٤٥٦٧" }).phone).toBe("050 123 4567");
    expect(profileSchema.parse({ name: "Sara", phone: "۰۵۰ ۱۲۳ ۴۵۶۷" }).phone).toBe("050 123 4567");
    expect(profileSchema.parse({ name: "Sara", phone: " " }).phone).toBeNull();
    expect(profileSchema.safeParse({ name: "Sara", phone: "٠٥٠-abc" }).success).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/account/password?x=1")).toBe("/account/password?x=1");
    expect(safeRedirectPath("/reports?from=2026-01#top")).toBe("/reports?from=2026-01#top");
  });

  it("falls back for external, protocol-relative, and missing values", () => {
    for (const value of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", undefined, null]) {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    }
  });

  it("falls back for paths that browsers resolve off-site", () => {
    for (const value of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\t\\evil.com", "/a\\..\\evil.com", "/\u0000"]) {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    }
  });

  it("falls back when dot segments collapse into a protocol-relative path", () => {
    for (const value of ["/.//evil.com", "/..//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/.///evil.com", "/%2E%2E//evil.com"]) {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    }
  });

  it("never returns a path that resolves to another origin", () => {
    const segments = ["", ".", "..", "%2e", "%2E%2e", "a", "evil.com", "@evil.com", ":80", "?", "#", "%2f", "%5c", " "];
    for (const a of segments) {
      for (const b of segments) {
        for (const c of segments) {
          const result = safeRedirectPath(`/${a}/${b}/${c}`);
          expect(result.startsWith("//")).toBe(false);
          expect(new URL(result, "https://app.example").origin).toBe("https://app.example");
        }
      }
    }
  });
});
