import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  requireSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth/current-user", () => ({ requireSession: mocks.requireSession }));

const { updateProfile } = await import("@/actions/account");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ sessionId: "s1", user: { id: "u1" } });
  mocks.findUnique.mockResolvedValue({ name: "Sara", phone: "+971 50 000 0000" });
});

describe("updateProfile", () => {
  it("updates only the signed-in user's name and phone, trimmed", async () => {
    const data = form({ name: "  Sara Ali ", phone: " +971 50 123 4567 ", id: "u2", role: "ADMIN", email: "x@y.z" });

    expect(await updateProfile(null, data)).toEqual({ success: true });
    expect(mocks.findUnique.mock.calls[0][0].where).toEqual({ id: "u1" });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Sara Ali", phone: "+971 50 123 4567" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("stores an empty phone as null", async () => {
    await updateProfile(null, form({ name: "Sara", phone: "   " }));
    expect(mocks.update.mock.calls[0][0].data).toEqual({ name: "Sara", phone: null });
  });

  it("records the change in the same transaction as the update", async () => {
    // Distinct return values prove the transaction received these two writes, not other values.
    mocks.update.mockReturnValueOnce("update-op");
    mocks.auditCreate.mockReturnValueOnce("audit-op");

    await updateProfile(null, form({ name: "Sara Ali", phone: "" }));

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction.mock.calls[0][0]).toEqual(["update-op", "audit-op"]);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        action: "user.profile_updated",
        entity: "User",
        entityId: "u1",
        oldValue: { name: "Sara", phone: "+971 50 000 0000" },
        newValue: { name: "Sara Ali", phone: null },
      },
    });
  });

  it("records only the fields that changed", async () => {
    await updateProfile(null, form({ name: "Sara Ali", phone: "+971 50 000 0000" }));

    expect(mocks.auditCreate.mock.calls[0][0].data).toMatchObject({
      oldValue: { name: "Sara" },
      newValue: { name: "Sara Ali" },
    });
  });

  it("writes nothing and still succeeds when nothing changed", async () => {
    expect(await updateProfile(null, form({ name: " Sara ", phone: "+971 50 000 0000" }))).toEqual({ success: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("returns field errors and the submitted values without writing", async () => {
    const result = await updateProfile(null, form({ name: "  ", phone: "call me" }));

    expect(result).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { name: "required", phone: "invalid_input" },
      values: { name: "  ", phone: "call me" },
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a name over 100 characters", async () => {
    expect(await updateProfile(null, form({ name: "a".repeat(101), phone: "" }))).toMatchObject({
      fieldErrors: { name: "invalid_input" },
    });
  });

  it("reports an unexpected error when the database write fails", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await updateProfile(null, form({ name: "Sara Ali", phone: "" }))).toEqual({
      success: false,
      error: "unexpected",
      values: { name: "Sara Ali", phone: "" },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("requires a session before reading the form", async () => {
    mocks.requireSession.mockRejectedValueOnce(new Error("REDIRECT:/login"));
    await expect(updateProfile(null, form({ name: "Sara", phone: "" }))).rejects.toThrow("REDIRECT:/login");
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
