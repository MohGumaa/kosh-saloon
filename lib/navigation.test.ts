import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, ROLE_DEFAULTS } from "@/lib/auth/permissions";
import { NAVIGATION, visibleNavGroups, visibleNavKeys } from "@/lib/navigation";

const allItems = NAVIGATION.flatMap((group) => group.items.map((item) => item.key));
const withoutAdminOnly = allItems.filter((key) => key !== "auditLog");

describe("visibleNavKeys", () => {
  it("shows an ADMIN every item", () => {
    expect(visibleNavKeys(new Set(PERMISSION_KEYS), "ADMIN")).toEqual(allItems);
  });

  it("hides the admin-only item from a Supervisor who holds every permission", () => {
    expect(visibleNavKeys(new Set(PERMISSION_KEYS), "SUPERVISOR")).toEqual(withoutAdminOnly);
  });

  it("shows a default Supervisor everything except settings and the audit log", () => {
    expect(visibleNavKeys(new Set(ROLE_DEFAULTS.SUPERVISOR), "SUPERVISOR")).toEqual(
      withoutAdminOnly.filter((key) => key !== "settings"),
    );
  });

  it("shows a default Staff user only their own areas", () => {
    expect(visibleNavKeys(new Set(ROLE_DEFAULTS.STAFF), "STAFF")).toEqual([
      "dashboard",
      "invoices",
      "services",
      "employeePerformance",
      "settlements",
    ]);
  });

  it("shows a user with no permissions only the dashboard", () => {
    expect(visibleNavKeys(new Set(), "STAFF")).toEqual(["dashboard"]);
  });

  it("uses unique item keys, so a key identifies one item", () => {
    expect(new Set(allItems).size).toBe(allItems.length);
  });
});

describe("visibleNavGroups", () => {
  it("keeps every group for an ADMIN", () => {
    const groups = visibleNavGroups(visibleNavKeys(new Set(PERMISSION_KEYS), "ADMIN"));

    expect(groups.map((group) => group.key)).toEqual([undefined, "transactions", "manage", "reports", "system"]);
  });

  it("drops the system group for a default Staff user and keeps only their items", () => {
    const groups = visibleNavGroups(visibleNavKeys(new Set(ROLE_DEFAULTS.STAFF), "STAFF"));

    expect(groups.map((group) => group.key)).toEqual([undefined, "transactions", "manage", "reports"]);
    expect(groups.map((group) => group.items.map((item) => item.key))).toEqual([
      ["dashboard"],
      ["invoices"],
      ["services"],
      ["employeePerformance", "settlements"],
    ]);
  });

  it("leaves only the ungrouped dashboard for a user with no permissions", () => {
    const groups = visibleNavGroups(visibleNavKeys(new Set(), "STAFF"));

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBeUndefined();
    expect(groups[0].items.map((item) => item.key)).toEqual(["dashboard"]);
  });
});
