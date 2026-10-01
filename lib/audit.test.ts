import { describe, expect, it, vi } from "vitest";
import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { auditLog: { create: mocks.create } } }));

const { AUDIT_ACTIONS, AUDIT_ENTITIES, auditChanges, recordAudit, resolvePage } = await import("@/lib/audit");

describe("recordAudit", () => {
  it("inserts exactly the entry and returns the operation itself", () => {
    mocks.create.mockReturnValueOnce("create-op");
    const entry = {
      userId: "u1",
      action: "permissions.updated",
      entity: "User",
      entityId: "u2",
      oldValue: { permissions: ["services.view"] },
      newValue: { permissions: [] },
    } as const;

    // The unawaited operation, so a `$transaction` array can run it.
    expect(recordAudit(entry)).toBe("create-op");
    expect(mocks.create).toHaveBeenCalledWith({ data: entry });
  });

  it("leaves out the old and new values when there are none", () => {
    recordAudit({ userId: "u1", action: "auth.login", entity: "User", entityId: "u1" });

    expect(mocks.create.mock.lastCall?.[0].data).toEqual({
      userId: "u1",
      action: "auth.login",
      entity: "User",
      entityId: "u1",
    });
  });

  it("writes through the given transaction client instead of the shared one", () => {
    mocks.create.mockClear();
    const tx = { auditLog: { create: vi.fn(() => "tx-op") } };

    expect(recordAudit({ userId: "u1", action: "auth.logout", entity: "User", entityId: "u1" }, tx as never)).toBe(
      "tx-op",
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("resolvePage", () => {
  it("shows page 1 for a missing, non-numeric, zero, or negative value", () => {
    for (const raw of [undefined, "", "abc", "2x", "1.5", "0", "-3"]) expect(resolvePage(raw, 10)).toBe(1);
  });

  it("keeps a page inside the range and uses the first of repeated values", () => {
    expect(resolvePage("4", 10)).toBe(4);
    expect(resolvePage("10", 10)).toBe(10);
    expect(resolvePage(["3", "7"], 10)).toBe(3);
  });

  it("shows the last page for a value past the end", () => {
    expect(resolvePage("11", 10)).toBe(10);
    expect(resolvePage("9".repeat(40), 10)).toBe(10);
  });

  it("shows page 1 when there are no entries", () => {
    expect(resolvePage("5", 0)).toBe(1);
  });
});

describe("auditChanges", () => {
  it("pairs each field's value before and after", () => {
    expect(auditChanges({ name: "Sara" }, { name: "Sara Ali" })).toEqual([
      { field: "name", before: "Sara", after: "Sara Ali" },
    ]);
  });

  it("joins arrays and shows an empty one as empty text", () => {
    expect(auditChanges({ permissions: ["services.view", "invoices.view"] }, { permissions: [] })).toEqual([
      { field: "permissions", before: "services.view, invoices.view", after: "" },
    ]);
  });

  it("shows a null or missing value as null, old fields first", () => {
    expect(auditChanges({ phone: "+971 50 123 4567", removed: "x" }, { phone: null, added: 5 })).toEqual([
      { field: "phone", before: "+971 50 123 4567", after: null },
      { field: "removed", before: "x", after: null },
      { field: "added", before: null, after: "5" },
    ]);
  });

  it("returns nothing when both values are empty", () => {
    expect(auditChanges(null, null)).toEqual([]);
    expect(auditChanges(undefined, {})).toEqual([]);
  });
});

describe("audit labels", () => {
  const label = (messages: unknown, path: string) =>
    path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);

  it.each([
    ["en", en],
    ["ar", ar],
  ])("has a %s label for every action and entity", (_locale, messages) => {
    for (const action of AUDIT_ACTIONS) expect(label(messages, `audit.actions.${action}`), action).toBeTypeOf("string");
    for (const entity of AUDIT_ENTITIES) expect(label(messages, `audit.entities.${entity}`), entity).toBeTypeOf("string");
  });
});
