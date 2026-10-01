import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const deleteMany = vi.fn();
const create = vi.fn();
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/db", () => ({ db: { session: { findUnique, deleteMany, create } } }));

const {
  SESSION_DURATION_MS,
  createSession,
  deleteCurrentSession,
  deleteExpiredSessions,
  generateToken,
  hashToken,
  validateSessionToken,
} = await import("@/lib/auth/session");

const user = { id: "u1", name: "Sara", email: "sara@kosh.ae", role: "STAFF", language: "EN" };

function sessionRow(overrides: { expiresAt?: Date; isActive?: boolean } = {}) {
  return {
    id: "s1",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    user: { ...user, isActive: overrides.isActive ?? true },
  };
}

describe("session tokens", () => {
  it("generates distinct 32-byte tokens and stores only a SHA-256 hash", () => {
    const token = generateToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(generateToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("validateSessionToken", () => {
  beforeEach(() => {
    findUnique.mockReset();
    deleteMany.mockReset();
  });

  it("looks up by token hash and returns the active user without isActive", async () => {
    findUnique.mockResolvedValue(sessionRow());
    expect(await validateSessionToken("tok")).toEqual({ sessionId: "s1", user });
    expect(findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken("tok") });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("rejects unknown tokens", async () => {
    findUnique.mockResolvedValue(null);
    expect(await validateSessionToken("tok")).toBeNull();
  });

  it("deletes and rejects expired sessions", async () => {
    findUnique.mockResolvedValue(sessionRow({ expiresAt: new Date(Date.now() - 1) }));
    expect(await validateSessionToken("tok")).toBeNull();
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("deletes and rejects sessions of inactive users", async () => {
    findUnique.mockResolvedValue(sessionRow({ isActive: false }));
    expect(await validateSessionToken("tok")).toBeNull();
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});

describe("session cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("stores only the hash and sets an httpOnly, lax, 7-day cookie", async () => {
    await createSession("u1");

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe("kosh_session");
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(options).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/", expires: expiresAt });
    expect(create).toHaveBeenCalledWith({ data: { tokenHash: hashToken(token), userId: "u1", expiresAt } });
  });

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("u1");
    expect(cookieStore.set.mock.calls[0][2]).toMatchObject({ secure: true, httpOnly: true });
  });

  it("deletes the session row and the cookie on sign-out", async () => {
    cookieStore.get.mockReturnValue({ value: "tok" });
    await deleteCurrentSession();
    expect(cookieStore.get).toHaveBeenCalledWith("kosh_session");
    expect(deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashToken("tok") } });
    expect(cookieStore.delete).toHaveBeenCalledWith("kosh_session");
  });

  it("still clears the cookie when there is no session to delete", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await deleteCurrentSession();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("kosh_session");
  });

  it("removes every session past its expiry", async () => {
    await deleteExpiredSessions();
    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: new Date() } } });
  });
});
