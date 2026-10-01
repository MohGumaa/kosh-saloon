# Fix: Repair open review findings F-09 to F-16

**Type:** Fix
**Branch:** fix/repair-open-review-findings-f-09-to-f-16
**Status:** verified
**Fixes:** F-09, F-10, F-11, F-12, F-13, F-14, F-15, F-16

## The problem

Eight minor (P3) findings from the two independent reviews are still open in
`blueprint/context/findings.md`. None blocks a merge, but each is a real gap:

| ID | Where | What is wrong |
|---|---|---|
| F-09 | `actions/auth.ts` `changePassword` | The current-password check has no attempt limit, so someone at an unattended signed-in workstation can guess it without limit. |
| F-10 | `lib/auth/validation.ts` `profileSchema` | The profile name accepts control and invisible characters (NUL, newline, right-to-left override, zero-width only). |
| F-11 | `lib/auth/validation.ts` `profileSchema` | The phone field rejects Arabic-Indic digits and non-breaking spaces. |
| F-12 | `components/layout/UserAvatar.tsx` | Initials use `charAt(0)`, so a name starting with an emoji shows a broken character. |
| F-13 | `app/(app)/account/page.tsx` | The Account details list is `dl > div > div > dt/dd`, which is invalid HTML and may not be read as label/value pairs. |
| F-14 | `components/auth/FormField.tsx` | A revealed password becomes plain text with spellcheck, autocapitalize, and autocorrect on. |
| F-15 | `app/(app)/dashboard/page.tsx` | The welcome banner omits the last sign-in that its spec listed. |
| F-16 | `components/layout/LocalDateTime.tsx` | Server and browser may format the same date differently, causing a hydration warning (unverified). |

## The fix

Repair each finding at its source, with no new dependency or abstraction. It
must not change sign-in, reset, session handling, or the layout of any page.

- **F-09:** before `verifyPassword` in `changePassword`, consume one attempt on
  the key `password:user:<userId>` with `LOGIN_IDENTIFIER_LIMIT` (5 per 15
  minutes). Return `rate_limited` when refused, without checking the password.
  Clear the key after a successful change. `ChangePasswordForm` already shows
  form-level errors, so no UI change is needed.
- **F-10:** the name must contain at least one letter and no control or format
  characters, except the zero-width joiner and non-joiner (U+200C, U+200D) that
  some Arabic-script names use. Invalid names get the existing `invalid_input`
  field error.
- **F-11:** before validating the phone, map Arabic-Indic (`٠-٩`) and Extended
  Arabic-Indic (`۰-۹`) digits to `0-9` and any Unicode space to a plain space.
  The stored value stays ASCII. Update the phone hint only if its wording
  becomes wrong.
- **F-12:** take the first code point of the first and last word
  (`Array.from(word)[0]`). Move the helper to `lib/initials.ts` so it can be
  tested; `UserAvatar` keeps its props.
- **F-13:** make `dt` and `dd` direct children of each row `div` (grid row, the
  decorative icon spanning both lines). The page must look the same.
- **F-14:** every password `FormField` passes `spellCheck={false}`,
  `autoCapitalize="none"`, and `autoCorrect="off"`, whether revealed or not.
- **F-15:** add the last sign-in line to the dashboard welcome banner, using
  the existing `LocalDateTime` and the `dashboard.lastSignIn` key.
- **F-16:** add `suppressHydrationWarning` to the `<time>` element and keep the
  two-pass render.

## Build steps

- [x] **1. Logic repairs (F-09, F-10, F-11, F-12).** Rate-limit the
  current-password check, tighten the profile name rule, normalise phone
  digits and spaces, and fix the initials helper, each with tests.
  **Done when:** `actions/auth.test.ts` shows `changePassword` returning
  `rate_limited` without verifying the password once the limit is reached and
  clearing the counter on success; `lib/auth/validation.test.ts` rejects NUL,
  newline, right-to-left override, and zero-width-only names, accepts an
  Arabic name, and stores `٠٥٠ ١٢٣ ٤٥٦٧` as `050 123 4567`;
  `lib/initials.test.ts` covers one word, several words, extra spaces, an
  Arabic name, and an emoji.
- [x] **2. Markup and input repairs (F-13, F-14, F-15, F-16).** Fix the
  definition-list nesting, harden password inputs, add last sign-in to the
  banner, and add `suppressHydrationWarning`.
  **Done when:** every `dt` and `dd` on `/account` is a direct child of a `div`
  inside the `dl`; a password field keeps `spellcheck="false"` before and
  after reveal; the dashboard banner shows the last sign-in; `/account` and
  `/dashboard` look unchanged otherwise in EN and AR.
- [x] **3. Verify and mark findings.** `pnpm test`, `pnpm exec tsc --noEmit`,
  `pnpm lint`, and `pnpm build` pass; locale key sets still match.
  **Done when:** all four commands pass and F-09 to F-16 are marked `fixed` in
  `blueprint/context/findings.md` for a later review to close.

## Verify

1. On Profile > Settings, enter a wrong current password six times: the sixth
   attempt shows the "too many attempts" message.
2. On Profile > Info, save a phone typed with Arabic digits and confirm it is
   stored as ordinary digits; try a name made only of spaces or symbols and
   confirm the field error.
3. Reveal a password field and confirm the browser does not underline it as a
   spelling mistake.
4. Open the dashboard and confirm the banner shows the last sign-in.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5279,"specSha256":"dcc95e1ce987b214a629d599ae98a23ac31d8de4366f1226a200acaf0e771db2","branch":"refs/heads/fix/repair-open-review-findings-f-09-to-f-16","head":"447ce0a945962c0c5d83c951c49a8813b99ed4d8","baseRef":"refs/heads/main","baseCommit":"06f1bee7aa926a4bd4d04fd72da428265949cd2f","sourceTree":"26b02d8c9a11ae3e9314239504cd4291bd42f7ab","absentOptional":[]} -->

## Findings

### repair-open-review-findings-f-09-to-f-16/F-11 [P3] closed - Phone validation rejects Arabic-Indic digits

**File:** lib/auth/validation.ts:54
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The phone rule is `/^[0-9+() -]*$/`. Running the real schema with `٠٥٠١٢٣٤٥٦٧` returns `invalid_format`, so an Arabic-language user whose keyboard produces Arabic-Indic digits gets "Check this field" on a number that is valid to them, in an app where Arabic is first-class. The Arabic hint says only "digits". A non-breaking space (pasted from a contact card) is rejected the same way. This matches the literal wording of the spec, so changing it is a product decision.
**Suggested fix:** Decide with the user. The smallest change is to normalise before validating: map `٠-٩` and `۰-۹` to `0-9` and other Unicode spaces to a plain space in a `.transform` ahead of the regex, so the stored value stays ASCII. Add both cases to the profile schema test.
**Resolution:** Fixed 2026-10-01. The phone is normalised before validation: Arabic-Indic and Extended Arabic-Indic digits map to `0-9` and Unicode space separators to a plain space, so the stored value stays ASCII. The phone hint wording is still correct and was not changed. Covered in `lib/auth/validation.test.ts`. Closed 2026-10-01 by /audit independent at `447ce0a`: running the real schema stores Arabic-Indic and Extended Arabic-Indic digits as `0-9`, turns a non-breaking, thin, or ideographic space into a plain space, still applies the 30-character limit after normalising, and still rejects letters; no new defect found in the repair.

### repair-open-review-findings-f-09-to-f-16/F-12 [P3] closed - Avatar initials split characters outside the basic plane

**File:** components/layout/UserAvatar.tsx:6
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality, tests)
**Why it matters:** `initials` uses `charAt(0)`, which returns one UTF-16 code unit. Running the same expression on `😀 Smith` returns the lone surrogate `d83d` followed by `S`, which renders as a replacement glyph in the header, the dashboard, and the profile. Names are user-editable since this change. `UserMenu` is a client component, so the server HTML and the client string can also differ and trigger a recoverable hydration error (not exercised in a browser). The helper is pure formatting logic with no test, which the testing standard puts in scope.
**Suggested fix:** Take the first code point instead: `Array.from(words[0])[0] ?? ""` (and the same for the last word). Export the helper or move it to `lib/` and add a small test covering one word, several words, extra spaces, an Arabic name, and an emoji.
**Resolution:** Fixed 2026-10-01. The helper moved to `lib/initials.ts` and takes the first code point of the first and last word; `UserAvatar` imports it with unchanged props. Covered in `lib/initials.test.ts`. Closed 2026-10-01 by /audit independent at `447ce0a`: `lib/initials.ts` reads whole code points, so an emoji is no longer cut into a lone surrogate, `UserAvatar` is the only caller, and the tests cover the cases the spec lists; no new defect found in the repair.

### repair-open-review-findings-f-09-to-f-16/F-13 [P3] closed - Account details list nests dt and dd one level too deep

**File:** app/(app)/account/page.tsx:63
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `Detail` renders `div > span + div > (dt, dd)` inside the `<dl>` at line 160. HTML allows a `<dl>` to group terms in a `div`, but `dt` and `dd` must be direct children of that `div`. Here they sit inside a second `div`, so the markup is invalid and assistive technology may not expose the username, email, role, and date rows as term and description pairs (the axe `dlitem` and `definition-list` rules flag this shape). The dashboard account card at `app/(app)/dashboard/page.tsx:114` uses the valid shape. Confirmed by reading the markup; no accessibility scanner is configured.
**Suggested fix:** Keep one wrapper `div` per row and lay it out with grid so the icon no longer needs a sibling wrapper: put the icon inside the `dt` (still `aria-hidden`), or make the row `grid grid-cols-[auto_1fr]` with the icon `span` spanning both rows and `dt`/`dd` as direct children.
**Resolution:** Fixed 2026-10-01. Each `Detail` row is one `div` whose only children are `dt` and `dd`; the decorative icon moved inside the `dt` and is positioned in the row's start padding, since a `span` sibling is not allowed in a `dl` group either. Confirmed by markup and build; not yet compared in a browser. Closed 2026-10-01 by /audit independent at `447ce0a`: in `app/(app)/account/page.tsx:63-76` each row `div` has only a `dt` and a `dd` as children, the icon is `aria-hidden` inside the `dt`, and the build output contains the `inset-s-0`, `min-h-18`, and `ps-14` rules the row relies on, with the same 72px row height and 56px text offset as before; no new defect found. The visual comparison in a browser is still outstanding and is listed as remaining risk on the receipt.

### repair-open-review-findings-f-09-to-f-16/F-14 [P3] closed - Revealed password is an ordinary text input with spellcheck on

**File:** components/auth/FormField.tsx:45
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** The show button switches the input to `type="text"` and passes no `spellCheck`, `autoCapitalize`, or `autoCorrect`. A text input is spell-checked by default in Chromium browsers, and with enhanced or cloud spell checking enabled (Chrome enhanced spell check, Microsoft Editor in Edge) the field contents are sent to the vendor while the password is revealed. On mobile the keyboard may also capitalise or autocorrect what the user types into the revealed field. This applies to sign-in, reset, and change password. Confirmed by code path; not exercised in a browser.
**Suggested fix:** When `isPassword`, always pass `spellCheck={false}`, `autoCapitalize="none"`, and `autoCorrect="off"` to `Input`.
**Resolution:** Fixed 2026-10-01. `FormField` sets `spellCheck={false}`, `autoCapitalize="none"`, and `autoCorrect="off"` on every password field, revealed or not, after the caller's props so they cannot be overridden. Confirmed by code path; not exercised in a browser. Closed 2026-10-01 by /audit independent at `447ce0a`: `components/auth/FormField.tsx:51` spreads the three attributes after `inputProps` whenever `type` is `password`, independent of the reveal state, and non-password fields are unchanged; typecheck, lint, and build pass; no new defect found.

### repair-open-review-findings-f-09-to-f-16/F-15 [P3] closed - Welcome banner omits the last sign-in the spec lists

**File:** app/(app)/dashboard/page.tsx:55
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says "Welcome banner: user's name, role, today's date, last sign-in". The banner shows the name, role, and date; last sign-in appears only in the account card further down (line 127). The information is on the page, so this is drift between the verified spec and the code rather than a missing feature.
**Suggested fix:** Either add the `lastSignIn` line to the banner (the `LocalDateTime` and the `dashboard.lastSignIn` key already exist) or record in the fix's history that the account card carries it by decision.
**Resolution:** Fixed 2026-10-01. The welcome banner shows a last sign-in line under the welcome text, using `LocalDateTime` and `dashboard.lastSignIn`; it is omitted when the user has never signed in before. Closed 2026-10-01 by /audit independent at `447ce0a`: `app/(app)/dashboard/page.tsx:65-69` renders the line from the `account` row the page already loads (no extra query) with the existing `dashboard.lastSignIn` key, present in both locales; no new defect found.

### repair-open-review-findings-f-09-to-f-16/F-16 [P3] closed - Date text may differ between server and browser during hydration

**File:** components/layout/LocalDateTime.tsx:38
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** During hydration the component renders the same UTC `Intl.DateTimeFormat` call on the server and in the browser and relies on both producing identical text. Node 22 here ships ICU 77; browsers ship their own ICU or CLDR data, and known differences (a narrow no-break space before AM/PM, the `UTC` zone label, Arabic month or digit forms) would make React report a recoverable hydration mismatch on the dashboard and profile. The mismatch would not break the page, and the browser value replaces the text right after. Missing validation: load `/dashboard` and `/account` in Chrome, Firefox, and Safari in both languages against a production build and check the console.
**Suggested fix:** Add `suppressHydrationWarning` to the `<time>` element, which is the intended escape hatch for timestamps, and keep the two-pass render.
**Resolution:** Fixed 2026-10-01. The `<time>` element has `suppressHydrationWarning`; the two-pass render is unchanged. The original mismatch was never reproduced in a browser. Closed 2026-10-01 by /audit independent at `447ce0a`: `components/layout/LocalDateTime.tsx:40` sets `suppressHydrationWarning` on the `<time>` element whose direct child is the formatted text, which is the level the attribute covers, and the `useSyncExternalStore` two-pass render is intact; no new defect found.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 447ce0a945962c0c5d83c951c49a8813b99ed4d8
**Base commit:** 06f1bee7aa926a4bd4d04fd72da428265949cd2f
**Base ref:** main
**Spec hash:** dcc95e1ce987b214a629d599ae98a23ac31d8de4366f1226a200acaf0e771db2
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T03:24:39Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T03:30:05Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `06f1bee7aa926a4bd4d04fd72da428265949cd2f..447ce0a945962c0c5d83c951c49a8813b99ed4d8` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm test`: pass (9 files, 72 tests)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm build`: pass (8 routes, all dynamic)

## Evidence

- Preconditions held before review: `HEAD` equals the target commit, `git merge-base main <target>` equals the base commit, the SHA-256 of `blueprint/context/current-feature.md` equals the spec hash, and `git status --short` showed only `blueprint/context/review.md`.
- Reviewed the complete base..target code delta: `actions/auth.ts`, `actions/auth.test.ts`, `lib/auth/validation.ts`, `lib/auth/validation.test.ts`, `lib/initials.ts`, `lib/initials.test.ts`, `components/layout/UserAvatar.tsx`, `components/auth/FormField.tsx`, `components/layout/LocalDateTime.tsx`, `app/(app)/account/page.tsx`, `app/(app)/dashboard/page.tsx`, plus the callers and contracts they touch (`lib/rate-limit.ts`, `actions/account.ts`, `components/auth/ChangePasswordForm.tsx`, `components/account/ProfileForm.tsx`, `components/ui/input.tsx`, `lib/auth/emails.ts`, both locale files).
- Security: `changePassword` counts one attempt on `password:user:<id>` before loading or verifying the hash and returns the form-level `rate_limited` message, which `ChangePasswordForm` displays; the key comes from the session user, never from the client.
- Ran the real `profileSchema` and `initials` against extra inputs in a throwaway test outside the repository: every name case from F-10 is rejected, Arabic and Persian names pass, Arabic-Indic digits and Unicode spaces in a phone are stored as ASCII with the 30-character limit applied after normalising, and an emoji initial stays whole. The same run showed U+2028 and U+2029 still pass in a name (F-17).
- Byte inspection of `lib/auth/validation.ts:62` and `lib/auth/validation.test.ts:60` found raw zero-width and right-to-left-override characters (F-18).
- Build CSS contains `.inset-s-0`, `.min-h-18`, and `.ps-14`, so the reworked account details row has the rules it relies on; each row `div` holds only `dt` and `dd`.
- Performance: the delta adds one counter upsert per password change and no query to the dashboard (the banner reuses the row already loaded).
- Tests: no skipped, focused, or placeholder tests; the new logic (attempt limit, name rule, phone normalising, initials) ships with tests, and the UI-only repairs are exempt under the testing standard.

## Findings

- Closed this pass: F-11, F-12, F-13, F-14, F-15, F-16.
- Left `fixed` (original defect gone, but the repair has a follow-up finding): F-09 (see F-19), F-10 (see F-17 and F-18).
- New, all P3 and `open`: F-17 (profile name accepts line and paragraph separators), F-18 (invisible and bidi-override characters as literals in source), F-19 (a failed counter cleanup reports a completed password change as an error).
- No P0 or P1 finding is `open` or `fixed`.

## Remaining risk

- No browser evidence: Check was not required and no dev server was started, so `/account` and `/dashboard` were not compared visually in EN and AR, the password reveal was not exercised in a browser, and the hydration behaviour behind F-16 was never reproduced. The spec's "looks unchanged" done-when rests on markup, class, and build evidence only.
- No Browser tests command and no accessibility scanner are declared, so the definition-list repair (F-13) was confirmed by reading the markup, not by a tool.
- The attempt limit was verified through mocked `consumeAttempt` calls and code reading; it was not run against a real database.
- Behaviour that matches the spec but may surprise users, left for a product decision: a phone pasted with invisible direction marks (common when copying from a contacts app) or full-width digits is rejected with the generic field error; initials use the first code point, so a flag or joined emoji shows only its first part and `ß` becomes `SS`; a name may begin with an allowed zero-width joiner, which gives an invisible initial.
- No security scanner or dependency audit was run (none is declared, and network use was not approved).
