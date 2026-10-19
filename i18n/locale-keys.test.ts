import { describe, expect, it } from "vitest";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

/** Every leaf key as a dotted path, sorted. */
function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe("locale files", () => {
  it("have the same keys in English and Arabic", () => {
    expect(keysOf(ar)).toEqual(keysOf(en));
  });
});
