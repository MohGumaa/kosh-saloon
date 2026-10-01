import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the original password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("correct horsE", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("returns false for malformed stored hashes instead of throwing", async () => {
    for (const stored of ["", "plain", "bcrypt$1$2$3$4$5", "scrypt$x$8$1$c2FsdA==$aGFzaA==", "scrypt$16384$8$1$$"]) {
      expect(await verifyPassword("anything", stored)).toBe(false);
    }
  });
});
