import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  key: string;
  count: number;
  resetAt: Date;
}

// A tiny in-memory stand-in for the RateLimit table.
const rows = new Map<string, Row>();

vi.mock("@/lib/db", () => ({
  db: {
    // Mirrors the single upsert statement in consumeAttempt: (key, resetAt, now, now, resetAt).
    $queryRaw: async (_sql: TemplateStringsArray, key: string, resetAt: Date, now: Date) => {
      const row = rows.get(key);
      const next = !row || row.resetAt <= now ? { key, count: 1, resetAt } : { ...row, count: row.count + 1 };
      rows.set(key, next);
      return [{ count: next.count }];
    },
    rateLimit: {
      updateMany: async ({ where }: { where: { key: string } }) => {
        const row = rows.get(where.key);
        if (row && row.count > 0) rows.set(where.key, { ...row, count: row.count - 1 });
      },
      deleteMany: async ({ where }: { where: { key?: string; resetAt?: { lte: Date } } }) => {
        for (const [key, row] of rows) {
          if (where.key !== undefined && key !== where.key) continue;
          if (where.resetAt && row.resetAt > where.resetAt.lte) continue;
          rows.delete(key);
        }
      },
    },
  },
}));

const { clearAttempts, consumeAttempt, deleteExpiredRateLimits, refundAttempt } = await import("@/lib/rate-limit");

const rule = { limit: 3, windowMs: 60_000 };

describe("rate limit", () => {
  beforeEach(() => {
    rows.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows attempts up to the limit, then blocks within the window", async () => {
    for (let i = 0; i < 3; i++) expect(await consumeAttempt("k", rule)).toBe(true);
    expect(await consumeAttempt("k", rule)).toBe(false);
    expect(await consumeAttempt("k", rule)).toBe(false);
  });

  it("allows only the limit when attempts arrive together", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeAttempt("k", rule)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it("restarts the window after it expires", async () => {
    for (let i = 0; i < 4; i++) await consumeAttempt("k", rule);
    vi.advanceTimersByTime(60_000);
    expect(await consumeAttempt("k", rule)).toBe(true);
    expect(rows.get("k")).toEqual({ key: "k", count: 1, resetAt: new Date("2026-10-01T10:02:00Z") });
  });

  it("keeps keys independent and clears on request", async () => {
    for (let i = 0; i < 4; i++) await consumeAttempt("a", rule);
    expect(await consumeAttempt("b", rule)).toBe(true);
    await clearAttempts("a");
    expect(await consumeAttempt("a", rule)).toBe(true);
  });

  it("gives an attempt back on refund", async () => {
    for (let i = 0; i < 3; i++) await consumeAttempt("k", rule);
    await refundAttempt("k");
    expect(await consumeAttempt("k", rule)).toBe(true);
    expect(await consumeAttempt("k", rule)).toBe(false);
  });

  it("deletes only counters whose window has ended", async () => {
    await consumeAttempt("old", rule);
    vi.advanceTimersByTime(30_000);
    await consumeAttempt("new", rule);
    vi.advanceTimersByTime(30_000);
    await deleteExpiredRateLimits();
    expect([...rows.keys()]).toEqual(["new"]);
  });
});
