import { describe, expect, it } from "vitest";
import { initials } from "@/lib/initials";

describe("initials", () => {
  it("uses the first letter of a single word", () => {
    expect(initials("sara")).toBe("S");
  });

  it("uses the first and last word of several", () => {
    expect(initials("Sara Ali")).toBe("SA");
    expect(initials("sara bint ali khan")).toBe("SK");
  });

  it("ignores extra spaces and an empty name", () => {
    expect(initials("  Sara   Ali  ")).toBe("SA");
    expect(initials("   ")).toBe("");
  });

  it("handles an Arabic name", () => {
    expect(initials("سارة علي")).toBe("سع");
  });

  it("keeps an emoji whole", () => {
    expect(initials("😀 Sara")).toBe("😀S");
    expect(initials("Sara 🌸")).toBe("S🌸");
  });
});
