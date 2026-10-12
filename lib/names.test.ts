import { describe, expect, it } from "vitest";
import { employeeLabels, firstName, nameLabels } from "@/lib/names";

describe("firstName", () => {
  it("returns the first word of the name", () => {
    expect(firstName("Tamir Abdelrahman")).toBe("Tamir");
  });

  it("keeps a single-word name and trims extra spaces", () => {
    expect(firstName("Huda")).toBe("Huda");
    expect(firstName("  Omar   Khalid  ")).toBe("Omar");
  });

  it("handles Arabic names", () => {
    expect(firstName("تامر عبدالرحمن")).toBe("تامر");
  });
});

describe("employeeLabels", () => {
  it("shows the first name", () => {
    expect(employeeLabels(["Tamir Abdelrahman", "Sara Ali"])).toEqual(["Tamir", "Sara"]);
  });

  it("keeps a single-word name and trims extra spaces", () => {
    expect(employeeLabels(["Huda", "  Omar   Khalid  "])).toEqual(["Huda", "Omar"]);
  });

  it("shows full names when first names clash, ignoring case", () => {
    expect(employeeLabels(["Tamir Abdelrahman", "tamir Hassan", "Sara Ali"], "en")).toEqual([
      "Tamir Abdelrahman",
      "tamir Hassan",
      "Sara",
    ]);
  });

  it("applies the same rules to Arabic names", () => {
    expect(employeeLabels(["تامر عبدالرحمن", "سارة علي", "سارة محمد", "هدى"], "ar")).toEqual([
      "تامر",
      "سارة علي",
      "سارة محمد",
      "هدى",
    ]);
  });
});

describe("nameLabels", () => {
  it("counts each person once, so repeated rows keep the first name", () => {
    const labels = nameLabels([
      { id: "1", name: "Tamir Abdelrahman" },
      { id: "1", name: "Tamir Abdelrahman" },
      { id: "2", name: "Sara Ali" },
    ]);
    expect([...labels]).toEqual([
      ["1", "Tamir"],
      ["2", "Sara"],
    ]);
  });

  it("shows full names for different people who share a first name", () => {
    const labels = nameLabels([
      { id: "1", name: "Tamir Abdelrahman" },
      { id: "2", name: "Tamir Hassan" },
    ]);
    expect(labels.get("1")).toBe("Tamir Abdelrahman");
    expect(labels.get("2")).toBe("Tamir Hassan");
  });
});
