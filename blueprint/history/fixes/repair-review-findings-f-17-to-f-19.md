# Fix: Repair review findings F-17 to F-19

**Type:** Fix
**Branch:** fix/repair-review-findings-f-17-to-f-19
**Status:** verified
**Fixes:** F-17, F-18, F-19

## The problem

The independent review of the last fix left three minor (P3) findings open in
`blueprint/context/findings.md`. Each is a follow-up to a repair made there:

| ID | Where | What is wrong |
|---|---|---|
| F-17 | `lib/auth/validation.ts` `profileSchema` | The name rule rejects control and format characters but still accepts the line separator (U+2028) and paragraph separator (U+2029), so a stored name can break onto a second line in plain-text email. |
| F-18 | `lib/auth/validation.ts`, `lib/auth/validation.test.ts` | The zero-width joiners in the name rule, and the right-to-left override and zero-width characters in the tests, are raw invisible characters in the source. The rule reads as an empty `[]`, and a tool that strips such characters would silently change the validation. |
| F-19 | `actions/auth.ts` `changePassword` | `clearAttempts` runs after the password transaction inside the same `try`. If that cleanup fails, the user sees the "unexpected" error although the password has already changed and other sessions are signed out. |

F-09 and F-10 stay `fixed` only because of these follow-ups. Once these are
repaired, a review can close all five.

## The fix

Repair each finding at its source, with no new dependency or abstraction. It
must not change sign-in, reset, the attempt limit itself, or which names and
phones are accepted beyond the two separator characters.

- **F-17:** add the `Zl` and `Zp` categories to the characters the name rule
  rejects. Names containing U+2028 or U+2029 get the existing `invalid_input`
  field error.
- **F-18:** write every invisible or direction-changing character as a `\u`
  escape: U+200C and U+200D in the name rule, and U+202E, U+200B, U+200C, and
  U+200D in the test strings (including the joiner in the Persian sample).
  Behaviour does not change.
- **F-19:** move the counter cleanup out of the action's failure path by
  running it through the existing `afterResponse` helper, which already logs a
  failed task without failing the request. A successful password change then
  always returns success; if the cleanup fails, the counter simply expires
  after its 15-minute window.

## Build steps

- [x] **1. Repair the three findings with tests.** Tighten the name rule,
  replace the raw characters with escapes, and make the counter cleanup unable
  to fail the action.
  **Done when:** `lib/auth/validation.test.ts` rejects names containing U+2028
  and U+2029 and still accepts the Arabic and Persian names; a byte scan of
  `lib/auth/validation.ts` and `lib/auth/validation.test.ts` finds no raw
  control, format, line-separator, or paragraph-separator character other than
  ordinary line breaks; `actions/auth.test.ts` shows `changePassword`
  returning success when `clearAttempts` rejects, and still clearing
  `password:user:<userId>` after a successful change.
- [x] **2. Verify and mark findings.** `pnpm test`, `pnpm exec tsc --noEmit`,
  `pnpm lint`, and `pnpm build` pass.
  **Done when:** all four commands pass and F-17, F-18, and F-19 are marked
  `fixed` in `blueprint/context/findings.md` for a later review to close.

## Verify

1. On Profile > Info, paste a name containing a line separator (U+2028) and
   confirm the field error; save an ordinary Arabic name and confirm it is
   accepted.
2. On Profile > Settings, change the password with the correct current
   password and confirm the success message.
3. Open `lib/auth/validation.ts` and confirm the name rule shows
   `‌‍` as visible escapes.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3676,"specSha256":"13f7444da2bed0a1475d9211a44447790f56247c96eacd7dc7a656947b235a38","branch":"refs/heads/fix/repair-review-findings-f-17-to-f-19","head":"28cd612e38953f5138f224d25ce8173ab5f59797","baseRef":"refs/heads/main","baseCommit":"1fded436453bb600fb2cdb7a5022f1c40d5a0ca0","sourceTree":"63926b0929c9175c6b343fb6b84cdd32b658b86b","absentOptional":[]} -->

## Findings

### repair-review-findings-f-17-to-f-19/F-09 [P3] closed - Change password checks the current password with no attempt limit

**File:** actions/auth.ts:271
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `changePassword` verifies `currentPassword` on every call and never calls `consumeAttempt`. Sign-in allows 5 guesses per identifier per 15 minutes, but anyone holding a signed-in session for an account (for example an unattended salon workstation) can guess that account's current password without limit through this action, then change it and sign every other device out. The current-password prompt is the only thing between a borrowed session and a permanent takeover. Confirmed by code path; not exercised against a running server.
**Suggested fix:** Before `verifyPassword`, call `consumeAttempt` with a per-user key such as `password:user:<id>` and `LOGIN_IDENTIFIER_LIMIT`, return `rate_limited` when it is refused, and `clearAttempts` on success. Add a test next to the existing `changePassword` cases.
**Resolution:** Fixed 2026-10-01 on `fix/repair-open-review-findings-f-09-to-f-16`. `changePassword` consumes one attempt on `password:user:<userId>` with `LOGIN_IDENTIFIER_LIMIT` before loading or verifying the password, returns `rate_limited` when refused, and clears the key after a successful change. Covered in `actions/auth.test.ts`. Re-reviewed 2026-10-01 by /audit independent at `447ce0a`: the original defect is gone (`actions/auth.ts:271-272` counts the attempt before `verifyPassword`, the sixth guess returns `rate_limited` without reading the hash, and `pnpm test` passes). Left `fixed`, not closed, because the repair introduced F-19 (the counter cleanup at line 289 can turn a committed password change into an `unexpected` error). Closed 2026-10-01 by /audit independent at `28cd612`: `actions/auth.ts` was in the reviewed set; the attempt is still counted at lines 271-272 before `verifyPassword`, the rate-limit cases in `actions/auth.test.ts` pass, and the follow-up F-19 is repaired and closed, so the repair leaves no known defect.

### repair-review-findings-f-17-to-f-19/F-10 [P3] closed - Profile name accepts control and invisible characters

**File:** lib/auth/validation.ts:49
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `profileSchema.name` is `z.string().trim().min(1).max(100)` with no character rule, and `updateProfile` now lets every signed-in user write it. Running the real schema showed it accepts a NUL character (`a\u0000b`), a newline plus a right-to-left override (`Sara\nAli‮`), and a name that is only a zero-width space. PostgreSQL text columns reject NUL, so that input falls through to the `catch` in `actions/account.ts:43` and the user gets the generic `unexpected` message and a server error log instead of a field error. The invisible and bidi cases are stored and then shown in the header, the dashboard, and the notification emails, and later in admin lists and reports, where an empty-looking or direction-flipped name is confusing. Output is escaped everywhere it is used today (React, `escapeHtml` in `lib/auth/emails.ts`), so this is not an injection.
**Suggested fix:** Reject control and bidi-control characters in the name, for example `.regex(/^[^\p{Cc}\p{Cf}]+$/u)` before the length checks (note that `\p{Cf}` also covers the zero-width joiner; allow `‌` and `‍` explicitly if Arabic or Persian names need them), and add the cases to `lib/auth/validation.test.ts`.
**Resolution:** Fixed 2026-10-01. `profileSchema.name` now requires at least one letter and rejects `\p{Cc}` and `\p{Cf}` characters except U+200C and U+200D. Covered in `lib/auth/validation.test.ts` (NUL, newline, right-to-left override, zero-width only, Arabic and Persian names). Re-reviewed 2026-10-01 by /audit independent at `447ce0a`: every case in the original finding is now rejected (confirmed by running the real schema). Left `fixed`, not closed, because the repair leaves F-17 (line and paragraph separators are still accepted) and introduced F-18 (the allowed joiners are invisible literals in the rule). Closed 2026-10-01 by /audit independent at `28cd612`: `lib/auth/validation.ts` was in the reviewed set; running the name rule again rejects NUL, newline, the right-to-left override, and zero-width-only names and still accepts the Arabic and Persian samples, and the follow-ups F-17 and F-18 are repaired and closed, so the repair leaves no known defect.

### repair-review-findings-f-17-to-f-19/F-17 [P3] closed - Profile name still accepts line and paragraph separators

**File:** lib/auth/validation.ts:62
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** The F-10 repair rejects `\p{Cc}` and `\p{Cf}`, but U+2028 (line separator) and U+2029 (paragraph separator) are in the `Zl` and `Zp` categories, so they pass. Running the real schema at `447ce0a` accepts `Sara Ali` and `Sara Ali`. `.trim()` only removes them at the ends. This is the same class of input the newline case in F-10 was about: a stored name that breaks onto a second line where it is shown as plain text, for example the greeting in the text part of the sign-in and reset emails (`lib/auth/emails.ts:54`, `:78`). HTML output is escaped and collapses them, so this is not an injection.
**Suggested fix:** Add the two categories to the rejected set, for example `[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]`, and add both characters to the rejected names in `lib/auth/validation.test.ts`.
**Resolution:** Fixed 2026-10-01 on `fix/repair-review-findings-f-17-to-f-19`. The name rule now also rejects the `Zl` and `Zp` categories, so U+2028 and U+2029 get the `invalid_input` field error. Both characters are in the rejected names in `lib/auth/validation.test.ts`. Closed 2026-10-01 by /audit independent at `28cd612`: `lib/auth/validation.ts:63` now rejects `\p{Zl}` and `\p{Zp}`; running the rule confirms a name with U+2028 or U+2029 inside it is rejected while the Arabic, Persian (U+200C), and accented samples still pass, and `updateProfile` maps the failure to the `invalid_input` field error. `pnpm test` passes. No new defect found in the repair.

### repair-review-findings-f-17-to-f-19/F-18 [P3] closed - Invisible and bidi-override characters are written as literals in source

**File:** lib/auth/validation.ts:62
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The character class that allows the two joiners holds the raw U+200C and U+200D characters, so the rule reads as an empty `[]` in an editor, a diff, and a review; nobody can see what it allows, and an editor or tool that strips zero-width characters would silently turn it into an empty class and change the validation. `lib/auth/validation.test.ts:60` and `:66` do the same with a raw U+202E (right-to-left override, which reorders how the rest of that line is displayed), U+200B, U+200C, and U+200D inside string literals, while the neighbouring NUL case already uses an escape. Confirmed by inspecting the file bytes. Lint does not flag it.
**Suggested fix:** Write them as escapes: `[‌‍]` in the rule, and `"Sara‮Ali"`, `"​"`, `"‌‍"`, `"Sara​"`, and the joiner in the Persian sample in the test. No behaviour changes.
**Resolution:** Fixed 2026-10-01 on `fix/repair-review-findings-f-17-to-f-19`. The joiners in the name rule and every invisible or direction-changing character in `lib/auth/validation.test.ts` are now written as `\u` escapes. A byte scan of both files finds no raw control, format, line-separator, or paragraph-separator character other than line breaks. No behaviour change. Closed 2026-10-01 by /audit independent at `28cd612`: a byte scan of `lib/auth/validation.ts` and `lib/auth/validation.test.ts` found no control, format, line-separator, or paragraph-separator character other than line breaks; the rule and the test strings use `\u` escapes and the tests still pass, so behaviour is unchanged. The raw joiners left in the spec's Verify step are a different file and are tracked separately as F-20.

### repair-review-findings-f-17-to-f-19/F-19 [P3] closed - A failed counter cleanup reports a completed password change as an error

**File:** actions/auth.ts:289
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `clearAttempts(attemptKey)` runs after the transaction that changes the password and signs out the other sessions, inside the same `try`. If that one delete fails (a dropped connection between the two statements), the `catch` returns `unexpected`, so the user is told the change failed although the new password is already in effect and their other devices are signed out. Retrying with the old password then shows "current password is incorrect". The sign-in action clears its counter before any change is committed, so it does not have this ordering problem. Confirmed by code path; the failure needs a database error at that exact point, so it is unlikely.
**Suggested fix:** Make the cleanup unable to fail the action: add the `db.rateLimit.deleteMany({ where: { key: attemptKey } })` call to the existing `$transaction` array so it commits or rolls back with the password change, or catch and log a `clearAttempts` error on its own (the counter expires after 15 minutes anyway). Add a test where `clearAttempts` rejects and the action still returns success.
**Resolution:** Fixed 2026-10-01 on `fix/repair-review-findings-f-17-to-f-19`. `changePassword` runs `clearAttempts` through the existing `afterResponse` helper, so a failed cleanup is logged after the response and the action still returns success. Covered in `actions/auth.test.ts` by a case where `clearAttempts` rejects. Closed 2026-10-01 by /audit independent at `28cd612`: `actions/auth.ts:290` schedules the cleanup through `afterResponse`, outside the awaited path, and that helper catches and logs a failure. The new case in `actions/auth.test.ts` makes `clearAttempts` reject and still gets `{ success: true }` (it would fail against the previous awaited call), and the success case still clears `password:user:u1`. No new defect found in the repair.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 28cd612e38953f5138f224d25ce8173ab5f59797
**Base commit:** 1fded436453bb600fb2cdb7a5022f1c40d5a0ca0
**Base ref:** main
**Spec hash:** 13f7444da2bed0a1475d9211a44447790f56247c96eacd7dc7a656947b235a38
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T08:34:51Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T08:43:36Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `1fded436453bb600fb2cdb7a5022f1c40d5a0ca0..28cd612e38953f5138f224d25ce8173ab5f59797` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm build`: pass

## Evidence

- Preconditions held: `HEAD` equals the target commit, `main` still gives the recorded merge base, the spec bytes match the spec hash, and only `blueprint/context/review.md` differed from the target before the review.
- Read the full base..target delta: `actions/auth.ts`, `actions/auth.test.ts`, `lib/auth/validation.ts`, `lib/auth/validation.test.ts`, and the spec, plus `lib/rate-limit.ts` and `actions/account.ts` as nearby code.
- `pnpm test`: 9 files, 73 tests passed; no skipped or focused tests in `actions/` or `lib/`.
- Ran the name rule from `lib/auth/validation.ts:63` against sample names: U+2028, U+2029, U+202E, U+200B, U+200E, NUL, and newline inside a name are rejected; Arabic, Persian with U+200C, and accented names are accepted.
- Byte scan of the four changed source files found no control, format, line-separator, or paragraph-separator character other than line breaks.
- `changePassword` schedules `clearAttempts` through `afterResponse` (`actions/auth.ts:290`); the new test makes the cleanup reject and the action still returns success.

## Findings

- F-20 [P3] open: the spec's Verify step 3 holds raw U+200C and U+200D where the escapes should be shown (not blocking).
- Closed this pass: F-09, F-10, F-17, F-18, F-19.
- No P0 or P1 finding is open or fixed.

## Remaining risk

- No verification command was unavailable.
- Check was not required and no running server or browser was used, so the profile and password forms were not exercised end to end; the `after` callback was exercised only through the test mock, not the Next.js runtime.
- Existing ledger entries (F-10, F-17, F-18) still contain raw invisible characters in their example text; they were preserved byte for byte and are outside the code scope.
