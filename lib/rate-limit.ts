import { db } from "@/lib/db";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

const MINUTE = 60 * 1000;

export const LOGIN_IDENTIFIER_LIMIT: RateLimitRule = { limit: 5, windowMs: 15 * MINUTE };
export const LOGIN_IP_LIMIT: RateLimitRule = { limit: 20, windowMs: 15 * MINUTE };
export const RESET_IDENTIFIER_LIMIT: RateLimitRule = { limit: 3, windowMs: 60 * MINUTE };
export const RESET_IP_LIMIT: RateLimitRule = { limit: 10, windowMs: 60 * MINUTE };

/**
 * Counts one attempt and reports whether it is within the limit. Call before the
 * guarded work: counting and deciding happen in one statement, so parallel
 * requests cannot all pass a check made before any of them is counted.
 */
export async function consumeAttempt(key: string, rule: RateLimitRule): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + rule.windowMs);

  // An expired window restarts at 1; an open window increments.
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"
  `;
  return row.count <= rule.limit;
}

/** Gives back one consumed attempt, so a limit counts failures rather than every request. */
export async function refundAttempt(key: string): Promise<void> {
  await db.rateLimit.updateMany({ where: { key, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
}

export async function clearAttempts(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Removes counters whose window has ended; nothing else ever deletes them. */
export async function deleteExpiredRateLimits(): Promise<void> {
  await db.rateLimit.deleteMany({ where: { resetAt: { lte: new Date() } } });
}
