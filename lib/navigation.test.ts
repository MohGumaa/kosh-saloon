import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS } from "@/lib/auth/permissions";
import { NAVIGATION, visibleNavGroups, visibleNavKeys } from "@/lib/navigation";

const allItems = NAVIGATION.flatMap((group) => group.items.map((item) => item.key));

describe("visibleNavKeys", () => {
  it("shows an ADMIN every item", () => {
    expect(visibleNavKeys(new Set(PERMISSION_KEYS))).toEqual(allItems);
  });

  it("shows a default Supervisor everything except settings", () => {
    expect(visibleNavKeys(new Set(ROLE_DEFAULTS.SUPERVISOR))).toEqual(allItems.filter((key) => key !== "settings"));
  });

  it("shows a default Staff user only their own areas", () => {
    expect(visibleNavKeys(new Set(ROLE_DEFAULTS.STAFF))).toEqual([
      "dashboard",
      "invoices",
      "services",
      "employeePerformance",
      "settlements",
    ]);
  });

  it("shows a user with no permissions only the dashboard", () => {
    expect(visibleNavKeys(new Set())).toEqual(["dashboard"]);
  });

  it("uses unique item keys, so a key identifies one item", () => {
    expect(new Set(allItems).size).toBe(allItems.length);
  });
});

describe("visibleNavGroups", () => {
  const groupKeys = (permissions: readonly (typeof PERMISSION_KEYS)[number][]) =>
    visibleNavGroups(visibleNavKeys(new Set(permissions))).map((group) => group.key);

  it("keeps every group for an ADMIN", () => {
    expect(groupKeys(PERMISSION_KEYS)).toEqual([undefined, "transactions", "manage", "reports", "system"]);
  });

  it("drops the system group for a default Staff user and keeps only their items", () => {
    const groups = visibleNavGroups(visibleNavKeys(new Set(ROLE_DEFAULTS.STAFF)));

    expect(groups.map((group) => group.key)).toEqual([undefined, "transactions", "manage", "reports"]);
    expect(groups.map((group) => group.items.map((item) => item.key))).toEqual([
      ["dashboard"],
      ["invoices"],
      ["services"],
      ["employeePerformance", "settlements"],
    ]);
  });

  it("leaves only the ungrouped dashboard for a user with no permissions", () => {
    const groups = visibleNavGroups(visibleNavKeys(new Set()));

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBeUndefined();
    expect(groups[0].items.map((item) => item.key)).toEqual(["dashboard"]);
  });
});
