import { describe, expect, it } from "vitest";
import {
  LOGO_MAX_BYTES,
  detectImageType,
  financialSettingsSchema,
  salonInformationSchema,
} from "@/lib/settings-validation";

const information = { name: "Kosh Salon", licenseNumber: "", address: "", phone: "", email: "", taxId: "" };
const financial = { currency: "AED", taxRate: "0", employeeSharePercentage: "50" };

describe("salonInformationSchema", () => {
  it("trims the name and requires it", () => {
    expect(salonInformationSchema.parse({ ...information, name: "  Kosh  " }).name).toBe("Kosh");
    expect(salonInformationSchema.safeParse({ ...information, name: "   " }).success).toBe(false);
    expect(salonInformationSchema.safeParse({ ...information, name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects a name with a line break or control character", () => {
    expect(salonInformationSchema.safeParse({ ...information, name: "Kosh\nSalon" }).success).toBe(false);
    expect(salonInformationSchema.safeParse({ ...information, name: "Kosh\u0000" }).success).toBe(false);
  });

  it("accepts an Arabic name", () => {
    expect(salonInformationSchema.parse({ ...information, name: "صالون كوش" }).name).toBe("صالون كوش");
  });

  it("stores empty optional fields as empty strings", () => {
    expect(
      salonInformationSchema.parse({ ...information, licenseNumber: "  ", address: " ", phone: " ", email: " ", taxId: "" }),
    ).toEqual(information);
  });

  it("trims optional text and enforces its length", () => {
    const parsed = salonInformationSchema.parse({
      ...information,
      licenseNumber: " CN-123 ",
      address: " Al Wasl Road, Dubai ",
      taxId: " 100200300400003 ",
    });
    expect(parsed).toMatchObject({ licenseNumber: "CN-123", address: "Al Wasl Road, Dubai", taxId: "100200300400003" });
    expect(salonInformationSchema.safeParse({ ...information, licenseNumber: "x".repeat(51) }).success).toBe(false);
    expect(salonInformationSchema.safeParse({ ...information, address: "x".repeat(201) }).success).toBe(false);
    expect(salonInformationSchema.safeParse({ ...information, taxId: "x".repeat(51) }).success).toBe(false);
  });

  it("lowercases the email and rejects an invalid one", () => {
    expect(salonInformationSchema.parse({ ...information, email: "  Info@Kosh.AE " }).email).toBe("info@kosh.ae");
    expect(salonInformationSchema.safeParse({ ...information, email: "not-an-email" }).success).toBe(false);
  });

  it("normalizes Arabic-Indic digits in the phone and rejects letters", () => {
    expect(salonInformationSchema.parse({ ...information, phone: "+٩٧١ ٥٠ ١٢٣ ٤٥٦٧" }).phone).toBe("+971 50 123 4567");
    expect(salonInformationSchema.safeParse({ ...information, phone: "call us" }).success).toBe(false);
  });
});

describe("financialSettingsSchema", () => {
  it("uppercases the currency and rejects an unknown code", () => {
    expect(financialSettingsSchema.parse({ ...financial, currency: " usd " }).currency).toBe("USD");
    for (const currency of ["", "XYZ", "AE", "AEDX", "12$"]) {
      expect(financialSettingsSchema.safeParse({ ...financial, currency }).success, currency).toBe(false);
    }
  });

  it.each(["taxRate", "employeeSharePercentage"] as const)("accepts %s from 0 to 100 with two decimals", (field) => {
    const parse = (value: string) => financialSettingsSchema.parse({ ...financial, [field]: value })[field];

    expect(parse("0")).toBe("0");
    expect(parse("100")).toBe("100");
    expect(parse(" 12.5 ")).toBe("12.5");
    expect(parse("50.0")).toBe("50");
    expect(parse("5.25")).toBe("5.25");
    expect(parse("٦٠")).toBe("60");
    expect(parse("١٢٫٥")).toBe("12.5");
  });

  it.each(["taxRate", "employeeSharePercentage"] as const)("rejects an out-of-range or malformed %s", (field) => {
    for (const value of ["", "-1", "100.01", "101", "12.345", "abc", "1e2", "5,5", ".5", "5."]) {
      expect(financialSettingsSchema.safeParse({ ...financial, [field]: value }).success, value).toBe(false);
    }
  });
});

describe("detectImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

  it("recognizes PNG, JPEG, and WebP from their leading bytes", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toEqual({
      contentType: "image/png",
      extension: "png",
    });
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")))).toEqual({
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("returns null for SVG, other RIFF files, empty, and truncated input", () => {
    expect(detectImageType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEB")))).toBeNull();
  });
});

describe("LOGO_MAX_BYTES", () => {
  it("is 1 MB", () => {
    expect(LOGO_MAX_BYTES).toBe(1_048_576);
  });
});
