# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-09 [P3] fixed - Change password checks the current password with no attempt limit

**File:** actions/auth.ts:271
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `changePassword` verifies `currentPassword` on every call and never calls `consumeAttempt`. Sign-in allows 5 guesses per identifier per 15 minutes, but anyone holding a signed-in session for an account (for example an unattended salon workstation) can guess that account's current password without limit through this action, then change it and sign every other device out. The current-password prompt is the only thing between a borrowed session and a permanent takeover. Confirmed by code path; not exercised against a running server.
**Suggested fix:** Before `verifyPassword`, call `consumeAttempt` with a per-user key such as `password:user:<id>` and `LOGIN_IDENTIFIER_LIMIT`, return `rate_limited` when it is refused, and `clearAttempts` on success. Add a test next to the existing `changePassword` cases.
**Resolution:** Fixed 2026-10-01 on `fix/repair-open-review-findings-f-09-to-f-16`. `changePassword` consumes one attempt on `password:user:<userId>` with `LOGIN_IDENTIFIER_LIMIT` before loading or verifying the password, returns `rate_limited` when refused, and clears the key after a successful change. Covered in `actions/auth.test.ts`. Re-reviewed 2026-10-01 by /audit independent at `447ce0a`: the original defect is gone (`actions/auth.ts:271-272` counts the attempt before `verifyPassword`, the sixth guess returns `rate_limited` without reading the hash, and `pnpm test` passes). Left `fixed`, not closed, because the repair introduced F-19 (the counter cleanup at line 289 can turn a committed password change into an `unexpected` error).

### F-10 [P3] fixed - Profile name accepts control and invisible characters

**File:** lib/auth/validation.ts:49
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `profileSchema.name` is `z.string().trim().min(1).max(100)` with no character rule, and `updateProfile` now lets every signed-in user write it. Running the real schema showed it accepts a NUL character (`a\u0000b`), a newline plus a right-to-left override (`Sara\nAli‮`), and a name that is only a zero-width space. PostgreSQL text columns reject NUL, so that input falls through to the `catch` in `actions/account.ts:43` and the user gets the generic `unexpected` message and a server error log instead of a field error. The invisible and bidi cases are stored and then shown in the header, the dashboard, and the notification emails, and later in admin lists and reports, where an empty-looking or direction-flipped name is confusing. Output is escaped everywhere it is used today (React, `escapeHtml` in `lib/auth/emails.ts`), so this is not an injection.
**Suggested fix:** Reject control and bidi-control characters in the name, for example `.regex(/^[^\p{Cc}\p{Cf}]+$/u)` before the length checks (note that `\p{Cf}` also covers the zero-width joiner; allow `‌` and `‍` explicitly if Arabic or Persian names need them), and add the cases to `lib/auth/validation.test.ts`.
**Resolution:** Fixed 2026-10-01. `profileSchema.name` now requires at least one letter and rejects `\p{Cc}` and `\p{Cf}` characters except U+200C and U+200D. Covered in `lib/auth/validation.test.ts` (NUL, newline, right-to-left override, zero-width only, Arabic and Persian names). Re-reviewed 2026-10-01 by /audit independent at `447ce0a`: every case in the original finding is now rejected (confirmed by running the real schema). Left `fixed`, not closed, because the repair leaves F-17 (line and paragraph separators are still accepted) and introduced F-18 (the allowed joiners are invisible literals in the rule).

### F-17 [P3] open - Profile name still accepts line and paragraph separators

**File:** lib/auth/validation.ts:62
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** The F-10 repair rejects `\p{Cc}` and `\p{Cf}`, but U+2028 (line separator) and U+2029 (paragraph separator) are in the `Zl` and `Zp` categories, so they pass. Running the real schema at `447ce0a` accepts `Sara Ali` and `Sara Ali`. `.trim()` only removes them at the ends. This is the same class of input the newline case in F-10 was about: a stored name that breaks onto a second line where it is shown as plain text, for example the greeting in the text part of the sign-in and reset emails (`lib/auth/emails.ts:54`, `:78`). HTML output is escaped and collapses them, so this is not an injection.
**Suggested fix:** Add the two categories to the rejected set, for example `[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]`, and add both characters to the rejected names in `lib/auth/validation.test.ts`.
**Resolution:**

### F-18 [P3] open - Invisible and bidi-override characters are written as literals in source

**File:** lib/auth/validation.ts:62
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The character class that allows the two joiners holds the raw U+200C and U+200D characters, so the rule reads as an empty `[]` in an editor, a diff, and a review; nobody can see what it allows, and an editor or tool that strips zero-width characters would silently turn it into an empty class and change the validation. `lib/auth/validation.test.ts:60` and `:66` do the same with a raw U+202E (right-to-left override, which reorders how the rest of that line is displayed), U+200B, U+200C, and U+200D inside string literals, while the neighbouring NUL case already uses an escape. Confirmed by inspecting the file bytes. Lint does not flag it.
**Suggested fix:** Write them as escapes: `[‌‍]` in the rule, and `"Sara‮Ali"`, `"​"`, `"‌‍"`, `"Sara​"`, and the joiner in the Persian sample in the test. No behaviour changes.
**Resolution:**

### F-19 [P3] open - A failed counter cleanup reports a completed password change as an error

**File:** actions/auth.ts:289
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `clearAttempts(attemptKey)` runs after the transaction that changes the password and signs out the other sessions, inside the same `try`. If that one delete fails (a dropped connection between the two statements), the `catch` returns `unexpected`, so the user is told the change failed although the new password is already in effect and their other devices are signed out. Retrying with the old password then shows "current password is incorrect". The sign-in action clears its counter before any change is committed, so it does not have this ordering problem. Confirmed by code path; the failure needs a database error at that exact point, so it is unlikely.
**Suggested fix:** Make the cleanup unable to fail the action: add the `db.rateLimit.deleteMany({ where: { key: attemptKey } })` call to the existing `$transaction` array so it commits or rolls back with the password change, or catch and log a `clearAttempts` error on its own (the counter expires after 15 minutes anyway). Add a test where `clearAttempts` rejects and the action still returns success.
**Resolution:**
