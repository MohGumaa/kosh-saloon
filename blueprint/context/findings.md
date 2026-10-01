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

### F-10 [P3] open - Profile name accepts control and invisible characters

**File:** lib/auth/validation.ts:49
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `profileSchema.name` is `z.string().trim().min(1).max(100)` with no character rule, and `updateProfile` now lets every signed-in user write it. Running the real schema showed it accepts a NUL character (`a\u0000b`), a newline plus a right-to-left override (`Sara\nAli‮`), and a name that is only a zero-width space. PostgreSQL text columns reject NUL, so that input falls through to the `catch` in `actions/account.ts:43` and the user gets the generic `unexpected` message and a server error log instead of a field error. The invisible and bidi cases are stored and then shown in the header, the dashboard, and the notification emails, and later in admin lists and reports, where an empty-looking or direction-flipped name is confusing. Output is escaped everywhere it is used today (React, `escapeHtml` in `lib/auth/emails.ts`), so this is not an injection.
**Suggested fix:** Reject control and bidi-control characters in the name, for example `.regex(/^[^\p{Cc}\p{Cf}]+$/u)` before the length checks (note that `\p{Cf}` also covers the zero-width joiner; allow `‌` and `‍` explicitly if Arabic or Persian names need them), and add the cases to `lib/auth/validation.test.ts`.
**Resolution:**

### F-11 [P3] open - Phone validation rejects Arabic-Indic digits

**File:** lib/auth/validation.ts:54
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The phone rule is `/^[0-9+() -]*$/`. Running the real schema with `٠٥٠١٢٣٤٥٦٧` returns `invalid_format`, so an Arabic-language user whose keyboard produces Arabic-Indic digits gets "Check this field" on a number that is valid to them, in an app where Arabic is first-class. The Arabic hint says only "digits". A non-breaking space (pasted from a contact card) is rejected the same way. This matches the literal wording of the spec, so changing it is a product decision.
**Suggested fix:** Decide with the user. The smallest change is to normalise before validating: map `٠-٩` and `۰-۹` to `0-9` and other Unicode spaces to a plain space in a `.transform` ahead of the regex, so the stored value stays ASCII. Add both cases to the profile schema test.
**Resolution:**

### F-12 [P3] open - Avatar initials split characters outside the basic plane

**File:** components/layout/UserAvatar.tsx:6
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality, tests)
**Why it matters:** `initials` uses `charAt(0)`, which returns one UTF-16 code unit. Running the same expression on `😀 Smith` returns the lone surrogate `d83d` followed by `S`, which renders as a replacement glyph in the header, the dashboard, and the profile. Names are user-editable since this change. `UserMenu` is a client component, so the server HTML and the client string can also differ and trigger a recoverable hydration error (not exercised in a browser). The helper is pure formatting logic with no test, which the testing standard puts in scope.
**Suggested fix:** Take the first code point instead: `Array.from(words[0])[0] ?? ""` (and the same for the last word). Export the helper or move it to `lib/` and add a small test covering one word, several words, extra spaces, an Arabic name, and an emoji.
**Resolution:**

### F-13 [P3] open - Account details list nests dt and dd one level too deep

**File:** app/(app)/account/page.tsx:63
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** `Detail` renders `div > span + div > (dt, dd)` inside the `<dl>` at line 160. HTML allows a `<dl>` to group terms in a `div`, but `dt` and `dd` must be direct children of that `div`. Here they sit inside a second `div`, so the markup is invalid and assistive technology may not expose the username, email, role, and date rows as term and description pairs (the axe `dlitem` and `definition-list` rules flag this shape). The dashboard account card at `app/(app)/dashboard/page.tsx:114` uses the valid shape. Confirmed by reading the markup; no accessibility scanner is configured.
**Suggested fix:** Keep one wrapper `div` per row and lay it out with grid so the icon no longer needs a sibling wrapper: put the icon inside the `dt` (still `aria-hidden`), or make the row `grid grid-cols-[auto_1fr]` with the icon `span` spanning both rows and `dt`/`dd` as direct children.
**Resolution:**

### F-14 [P3] open - Revealed password is an ordinary text input with spellcheck on

**File:** components/auth/FormField.tsx:45
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** The show button switches the input to `type="text"` and passes no `spellCheck`, `autoCapitalize`, or `autoCorrect`. A text input is spell-checked by default in Chromium browsers, and with enhanced or cloud spell checking enabled (Chrome enhanced spell check, Microsoft Editor in Edge) the field contents are sent to the vendor while the password is revealed. On mobile the keyboard may also capitalise or autocorrect what the user types into the revealed field. This applies to sign-in, reset, and change password. Confirmed by code path; not exercised in a browser.
**Suggested fix:** When `isPassword`, always pass `spellCheck={false}`, `autoCapitalize="none"`, and `autoCorrect="off"` to `Input`.
**Resolution:**

### F-15 [P3] open - Welcome banner omits the last sign-in the spec lists

**File:** app/(app)/dashboard/page.tsx:55
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says "Welcome banner: user's name, role, today's date, last sign-in". The banner shows the name, role, and date; last sign-in appears only in the account card further down (line 127). The information is on the page, so this is drift between the verified spec and the code rather than a missing feature.
**Suggested fix:** Either add the `lastSignIn` line to the banner (the `LocalDateTime` and the `dashboard.lastSignIn` key already exist) or record in the fix's history that the account card carries it by decision.
**Resolution:**

### F-16 [P3] unverified - Date text may differ between server and browser during hydration

**File:** components/layout/LocalDateTime.tsx:38
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** During hydration the component renders the same UTC `Intl.DateTimeFormat` call on the server and in the browser and relies on both producing identical text. Node 22 here ships ICU 77; browsers ship their own ICU or CLDR data, and known differences (a narrow no-break space before AM/PM, the `UTC` zone label, Arabic month or digit forms) would make React report a recoverable hydration mismatch on the dashboard and profile. The mismatch would not break the page, and the browser value replaces the text right after. Missing validation: load `/dashboard` and `/account` in Chrome, Firefox, and Safari in both languages against a production build and check the console.
**Suggested fix:** Add `suppressHydrationWarning` to the `<time>` element, which is the intended escape hatch for timestamps, and keep the two-pass render.
**Resolution:**
