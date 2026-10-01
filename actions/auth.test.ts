import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";
import { LOGIN_IDENTIFIER_LIMIT } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
  consumeAttempt: vi.fn<(key: string, rule: { limit: number }) => Promise<boolean>>(async () => true),
  refundAttempt: vi.fn(),
  clearAttempts: vi.fn(),
  deleteExpiredRateLimits: vi.fn(),
  createSession: vi.fn(),
  deleteExpiredSessions: vi.fn(),
  deleteCurrentSession: vi.fn(),
  requireSession: vi.fn(),
  getCurrentSession: vi.fn(),
  sendEmail: vi.fn(),
  afterCallbacks: [] as (() => Promise<void>)[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1", "user-agent": "Test UA" }),
  cookies: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ after: (cb: () => Promise<void>) => mocks.afterCallbacks.push(cb) }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail, appUrl: (p: string) => `http://app.test${p}` }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeAttempt: mocks.consumeAttempt,
  refundAttempt: mocks.refundAttempt,
  clearAttempts: mocks.clearAttempts,
  deleteExpiredRateLimits: mocks.deleteExpiredRateLimits,
}));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  createSession: mocks.createSession,
  deleteExpiredSessions: mocks.deleteExpiredSessions,
  deleteCurrentSession: mocks.deleteCurrentSession,
}));
vi.mock("@/lib/auth/current-user", () => ({
  requireSession: mocks.requireSession,
  getCurrentSession: mocks.getCurrentSession,
}));

const { changePassword, login, logout, requestPasswordReset, resetPassword } = await import("@/actions/auth");

const PASSWORD = "correct-password";
const passwordHash = await hashPassword(PASSWORD);
const activeUser = {
  id: "u1",
  name: "Sara",
  email: "sara@kosh.ae",
  language: "EN",
  isActive: true,
  passwordHash,
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function runAfter() {
  for (const cb of mocks.afterCallbacks.splice(0)) await cb();
}

/** Exactly one audit entry, with these fields and nothing else: no password, hash, or token. */
function expectAuditEntry(action: string, userId = "u1") {
  expect(mocks.db.auditLog.create).toHaveBeenCalledTimes(1);
  expect(mocks.db.auditLog.create).toHaveBeenCalledWith({
    data: { userId, action, entity: "User", entityId: userId },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  mocks.consumeAttempt.mockImplementation(async () => true);
});

describe("login", () => {
  it("returns the same error for an unknown user and a wrong password", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(null);
    const unknown = await login(null, form({ identifier: "nobody", password: PASSWORD }));

    mocks.db.user.findUnique.mockResolvedValueOnce(activeUser);
    const wrong = await login(null, form({ identifier: "sara", password: "wrong-password" }));

    expect(unknown).toEqual({ success: false, error: "invalid_credentials", identifier: "nobody" });
    expect(wrong).toEqual({ success: false, error: "invalid_credentials", identifier: "sara" });
    expect(mocks.consumeAttempt).toHaveBeenCalledWith("login:id:sara", expect.anything());
    expect(mocks.consumeAttempt).toHaveBeenCalledWith("login:ip:203.0.113.5", expect.anything());
    expect(mocks.refundAttempt).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("reports inactive only after the correct password, without a session", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });

    expect(await login(null, form({ identifier: "sara", password: "wrong-password" }))).toMatchObject({
      error: "invalid_credentials",
    });
    expect(await login(null, form({ identifier: "sara", password: PASSWORD }))).toMatchObject({ error: "inactive" });
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses rate-limited attempts before checking the password", async () => {
    mocks.consumeAttempt.mockImplementation(async (key) => !key.startsWith("login:id:"));
    expect(await login(null, form({ identifier: "Sara", password: PASSWORD }))).toMatchObject({
      error: "rate_limited",
    });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("lets only the limit through when wrong guesses arrive together", async () => {
    const counts = new Map<string, number>();
    mocks.consumeAttempt.mockImplementation(async (key, rule) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count <= rule.limit;
    });
    mocks.db.user.findUnique.mockResolvedValue(activeUser);

    const results = await Promise.all(
      Array.from({ length: 12 }, () => login(null, form({ identifier: "sara", password: "wrong-password" }))),
    );

    const errors = results.map((result) => (result && !result.success ? result.error : null));
    expect(errors.filter((error) => error === "invalid_credentials")).toHaveLength(5);
    expect(errors.filter((error) => error === "rate_limited")).toHaveLength(7);
    expect(mocks.db.user.findUnique).toHaveBeenCalledTimes(5);
  });

  it("creates no identifier counter once the IP is limited", async () => {
    mocks.consumeAttempt.mockImplementation(async (key) => !key.startsWith("login:ip:"));
    expect(await login(null, form({ identifier: "sara", password: PASSWORD }))).toMatchObject({
      error: "rate_limited",
    });
    expect(mocks.consumeAttempt).toHaveBeenCalledTimes(1);
  });

  it("matches email case-insensitively, creates a session, notifies, and redirects safely", async () => {
    mocks.db.user.findUnique.mockResolvedValue(activeUser);

    await expect(
      login(null, form({ identifier: " SARA@Kosh.ae ", password: PASSWORD, next: "//evil.com" })),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.db.user.findUnique.mock.calls[0][0].where).toEqual({ email: "sara@kosh.ae" });
    expect(mocks.createSession).toHaveBeenCalledWith("u1");
    expect(mocks.clearAttempts).toHaveBeenCalledWith("login:id:sara@kosh.ae");
    expect(mocks.refundAttempt).toHaveBeenCalledWith("login:ip:203.0.113.5");
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { lastLoginAt: expect.any(Date) } });
    // One transaction: the sign-in time and its audit entry are saved together.
    expectAuditEntry("auth.login");
    expect(mocks.db.$transaction.mock.calls[0][0]).toHaveLength(2);

    await runAfter();
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sara@kosh.ae", subject: "New sign-in to Kosh CRM" }),
    );
    expect(mocks.deleteExpiredRateLimits).toHaveBeenCalled();
    expect(mocks.deleteExpiredSessions).toHaveBeenCalled();
  });

  it("does not fail the login when the notification email fails", async () => {
    mocks.db.user.findUnique.mockResolvedValue(activeUser);
    mocks.sendEmail.mockRejectedValueOnce(new Error("provider down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(login(null, form({ identifier: "sara", password: PASSWORD, next: "/account/password" }))).rejects.toThrow(
      "REDIRECT:/account/password",
    );
    await expect(runAfter()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns field errors for empty input", async () => {
    expect(await login(null, form({ identifier: "", password: "" }))).toEqual({
      success: false,
      error: "invalid_input",
      fieldErrors: { identifier: "required", password: "required" },
      identifier: "",
    });
  });
});

describe("logout", () => {
  it("records the sign-out, deletes the session, and redirects to login", async () => {
    mocks.getCurrentSession.mockResolvedValue({ sessionId: "s1", user: { id: "u1" } });

    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expectAuditEntry("auth.logout");
    expect(mocks.deleteCurrentSession).toHaveBeenCalledTimes(1);
  });

  it("still signs out when the audit entry cannot be written", async () => {
    mocks.getCurrentSession.mockResolvedValue({ sessionId: "s1", user: { id: "u1" } });
    mocks.db.auditLog.create.mockRejectedValueOnce(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.deleteCurrentSession).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("records nothing when there is no valid session", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.deleteCurrentSession).toHaveBeenCalledTimes(1);
  });
});

describe("requestPasswordReset", () => {
  it("returns the same result for active, unknown, and inactive users, emailing only the active one", async () => {
    mocks.db.user.findUnique
      .mockResolvedValueOnce(activeUser)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...activeUser, isActive: false });

    const results = [];
    for (const identifier of ["sara", "nobody", "inactive"]) {
      results.push(await requestPasswordReset(null, form({ identifier })));
    }
    // The token is written after the response, so every case does the same work before answering.
    expect(mocks.db.passwordResetToken.create).not.toHaveBeenCalled();
    await runAfter();

    expect(results).toEqual([{ success: true }, { success: true }, { success: true }]);
    expect(mocks.db.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain("http://app.test/reset-password?token=");
  });

  it("stays neutral and sends nothing when rate-limited", async () => {
    mocks.consumeAttempt.mockImplementation(async (key) => !key.startsWith("reset:id:"));
    expect(await requestPasswordReset(null, form({ identifier: "sara" }))).toEqual({ success: true });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  it("creates no identifier counter once the IP is limited", async () => {
    mocks.consumeAttempt.mockImplementation(async (key) => !key.startsWith("reset:ip:"));
    expect(await requestPasswordReset(null, form({ identifier: "random-name" }))).toEqual({ success: true });
    expect(mocks.consumeAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.consumeAttempt).toHaveBeenCalledWith("reset:ip:203.0.113.5", expect.anything());
    expect(mocks.afterCallbacks).toHaveLength(0);
  });
});

describe("resetPassword", () => {
  const valid = { token: "raw-token", password: "new-password", confirmPassword: "new-password" };

  it("rejects unknown and expired tokens", async () => {
    mocks.db.passwordResetToken.findUnique.mockResolvedValueOnce(null);
    expect(await resetPassword(null, form(valid))).toEqual({ success: false, error: "invalid_token" });

    mocks.db.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: "t1",
      userId: "u1",
      expiresAt: new Date(Date.now() - 1),
      user: { isActive: true },
    });
    expect(await resetPassword(null, form(valid))).toEqual({ success: false, error: "invalid_token" });
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("sets the password, removes tokens and every session, then redirects to login", async () => {
    mocks.db.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 60_000),
      user: { isActive: true },
    });

    await expect(resetPassword(null, form(valid))).rejects.toThrow("REDIRECT:/login?reset=1");
    expect(mocks.db.passwordResetToken.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken("raw-token") });
    expect(mocks.db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: expect.stringMatching(/^scrypt\$/) },
    });
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expectAuditEntry("auth.password_reset");
    expect(mocks.db.$transaction.mock.calls[0][0]).toHaveLength(4);
  });

  it("treats an over-long token as an invalid link, not a field error", async () => {
    expect(await resetPassword(null, form({ ...valid, token: "x".repeat(201) }))).toEqual({
      success: false,
      error: "invalid_token",
    });
    expect(mocks.db.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it("reports mismatched confirmation on the confirm field", async () => {
    expect(await resetPassword(null, form({ ...valid, confirmPassword: "different1" }))).toMatchObject({
      fieldErrors: { confirmPassword: "password_mismatch" },
    });
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue({ sessionId: "s-current", user: { id: "u1" } });
    mocks.db.user.findUnique.mockResolvedValue({ passwordHash });
  });

  it("rejects a wrong current password on its field", async () => {
    const result = await changePassword(
      null,
      form({ currentPassword: "nope-nope", newPassword: "new-password", confirmPassword: "new-password" }),
    );
    expect(result).toMatchObject({ fieldErrors: { currentPassword: "wrong_current_password" } });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.consumeAttempt).toHaveBeenCalledWith("password:user:u1", LOGIN_IDENTIFIER_LIMIT);
    expect(mocks.clearAttempts).not.toHaveBeenCalled();
  });

  it("refuses rate-limited attempts before checking the current password", async () => {
    mocks.consumeAttempt.mockImplementation(async (key) => !key.startsWith("password:user:"));
    const result = await changePassword(
      null,
      form({ currentPassword: PASSWORD, newPassword: "new-password", confirmPassword: "new-password" }),
    );
    expect(result).toEqual({ success: false, error: "rate_limited" });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });

  it("lets only the limit through when wrong guesses repeat", async () => {
    let count = 0;
    mocks.consumeAttempt.mockImplementation(async (_key, rule) => ++count <= rule.limit);

    const errors = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await changePassword(
        null,
        form({ currentPassword: "nope-nope", newPassword: "new-password", confirmPassword: "new-password" }),
      );
      errors.push(result && !result.success ? result.error : null);
    }
    expect(errors).toEqual([...Array(5).fill("wrong_current_password"), "rate_limited"]);
    expect(mocks.db.user.findUnique).toHaveBeenCalledTimes(5);
  });

  it("updates the password and keeps only the current session", async () => {
    const result = await changePassword(
      null,
      form({ currentPassword: PASSWORD, newPassword: "new-password", confirmPassword: "new-password" }),
    );
    expect(result).toEqual({ success: true });
    expect(mocks.db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: expect.stringMatching(/^scrypt\$/) },
    });
    expect(mocks.db.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", id: { not: "s-current" } } });
    // One transaction: the password never changes while other sessions stay signed in or the change goes unlogged.
    expectAuditEntry("auth.password_changed");
    expect(mocks.db.$transaction.mock.calls[0][0]).toHaveLength(4);
    await runAfter();
    expect(mocks.clearAttempts).toHaveBeenCalledWith("password:user:u1");
  });

  it("still succeeds when clearing the attempt counter fails", async () => {
    mocks.clearAttempts.mockRejectedValueOnce(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await changePassword(
      null,
      form({ currentPassword: PASSWORD, newPassword: "new-password", confirmPassword: "new-password" }),
    );
    expect(result).toEqual({ success: true });
    await expect(runAfter()).resolves.toBeUndefined();
    expect(mocks.clearAttempts).toHaveBeenCalledWith("password:user:u1");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("reports a too-short new password", async () => {
    expect(
      await changePassword(null, form({ currentPassword: PASSWORD, newPassword: "short", confirmPassword: "short" })),
    ).toMatchObject({ fieldErrors: { newPassword: "password_length" } });
  });
});
