# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-09 [P3] open - Change password checks the current password with no attempt limit

**File:** actions/auth.ts:271
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `changePassword` verifies `currentPassword` on every call and never calls `consumeAttempt`. Sign-in allows 5 guesses per identifier per 15 minutes, but anyone holding a signed-in session for an account (for example an unattended salon workstation) can guess that account's current password without limit through this action, then change it and sign every other device out. The current-password prompt is the only thing between a borrowed session and a permanent takeover. Confirmed by code path; not exercised against a running server.
**Suggested fix:** Before `verifyPassword`, call `consumeAttempt` with a per-user key such as `password:user:<id>` and `LOGIN_IDENTIFIER_LIMIT`, return `rate_limited` when it is refused, and `clearAttempts` on success. Add a test next to the existing `changePassword` cases.
**Resolution:**
