# Feature: Authentication & sessions

**From build-plan:** feature 2
**Build attempt:** 1
**Branch:** feature/authentication-sessions
**Status:** verified

## Goal

Every Kosh CRM page and mutation requires a signed-in, active user. Users sign
in with username or email and password, sign out, change their password, and
reset a forgotten password by email. Each successful sign-in sends a login
notification email. Sessions are server-side database rows, so deactivated
users and revoked sessions lose access on their next request. The header shows
who is signed in.

## In scope

- `User` model (planned shape) with `Role`, `Language`, `Theme` enums, plus
  `Session`, `PasswordResetToken`, and `RateLimit` models and one migration.
- Password hashing with Node's built-in `crypto.scrypt` (no auth library).
- Database sessions: random token in an httpOnly cookie, only its SHA-256 hash
  stored.
- `/login`, logout, `/forgot-password`, `/reset-password`, `/account/password`.
- Route protection: optimistic `proxy.ts` cookie check plus an authoritative
  server check in every protected layout, page, and Server Action.
- Inactive-account blocking at sign-in and on every authenticated request.
- Rate limiting for sign-in and reset requests (DB-backed, works on Vercel).
- Email via Resend: password reset and login notification, in the user's
  stored language (EN/AR).
- Idempotent seed script that creates the first ADMIN from env vars.
- Header authentication state: user name, role label, sign-out, and link to
  change password.
- All new UI strings in `locales/en.json` and `locales/ar.json`; RTL and all
  three themes via existing tokens and logical utilities.

## Out of scope

- Permissions, `Permission`/`UserPermission` tables, and role-based page or
  action authorization (feature 3). This feature only requires an
  authenticated active user; `role` is stored and displayed, not enforced.
- Audit log entries for auth events (feature 4 adds them).
- Employee create/edit/activate UI (feature 6). Deactivation is tested by
  toggling `isActive` directly in the database.
- Settings > Security tab, login-notification on/off preference, and
  "sign out other sessions" UI (features 20 and 21). Notifications are always
  sent in this feature.
- Persisting language/theme per user (feature 24); the columns exist with
  defaults only.
- Remember-me, 2FA, OAuth, account lockout beyond rate limiting.

## Build loop

`workflow.stepReview` is `feature`: implement all steps in order, verifying each
step's Done when as you go, then present one review packet for the whole
feature. `workflow.checkpointCommits` is `disabled`: no commits between steps.
`/complete` creates the final feature commit.

## Build steps

- [x] **1. Data model, dependencies, and seed.**
  Add to `prisma/schema.prisma`: enums `Role` (ADMIN, SUPERVISOR, STAFF),
  `Language` (EN, AR), `Theme` (LIGHT, DARK, SYSTEM); models `User`, `Session`,
  `PasswordResetToken`, `RateLimit` (see Data / contracts). Run
  `pnpm exec prisma migrate dev --name auth`. Add dependencies `zod` and
  `resend`, and dev dependency `tsx` (the seed imports the generated TS client).
  Add `prisma/seed.ts` and register it as the seed command in
  `prisma.config.ts` (confirm the Prisma 7 `migrations.seed` key). Update
  `.env.example` with every new variable and a comment. Add a hash helper in
  `lib/auth/password.ts` now, since the seed needs it.
  **Done when:** `pnpm exec prisma migrate status` reports in sync;
  `pnpm exec prisma db seed` creates one ADMIN with a scrypt hash; a second run
  prints that an admin exists and changes nothing; missing or invalid
  `SEED_ADMIN_*` values fail with a clear message and create nothing;
  `pnpm exec tsc --noEmit` and `pnpm lint` pass.

- [x] **2. Auth core.**
  `lib/auth/password.ts` (`hashPassword`, `verifyPassword`, constant-time
  compare, dummy verify for unknown users), `lib/auth/session.ts` (create,
  validate, delete one, delete all for user except optional current; cookie
  read/write), `lib/auth/current-user.ts` (`getCurrentSession()` cached per
  request with React `cache`, `requireSession()` redirects to `/login`; both
  return `{ sessionId, user }` so change-password can keep the current session),
  `lib/rate-limit.ts` (fixed-window counter on `RateLimit`), and
  `lib/auth/validation.ts` (shared Zod schemas and identifier normalization).
  **Done when:** the password, validation, rate-limit, and session tests in
  Testing pass with `pnpm test`; tsc and lint pass; each module is used by at
  least one caller in step 3 (no dead exports left at the end of the feature).

- [x] **3. Login, logout, and route protection.**
  Route group `app/(auth)/` with a centered card layout containing the
  language and theme switchers; `app/(auth)/login/page.tsx` + client
  `components/auth/LoginForm.tsx` (React 19 `useActionState`);
  `actions/auth.ts` with `login` and `logout`. Root `proxy.ts`: for any path
  except `/login`, `/forgot-password`, `/reset-password`, Next internals, and
  static assets, redirect to `/login?next=<path>` when the session cookie is
  absent. `app/(app)/layout.tsx` and `app/(app)/dashboard/page.tsx` call
  `requireUser()`. `/login` redirects an already-valid session to `/dashboard`
  (checks a valid session, not cookie presence, so a stale cookie cannot
  loop). Header gets `components/layout/UserMenu.tsx`: name, translated role,
  "Change password" link, "Sign out" (form posting the `logout` action).
  **Done when:** signed out, `/dashboard` redirects to
  `/login?next=%2Fdashboard`; correct credentials by username and by email
  (any letter case) land on `next` or `/dashboard` and set `lastLoginAt`;
  wrong password and unknown user show the same message; an `isActive=false`
  user with the right password sees the inactive message and gets no session;
  flipping `isActive` to false while signed in sends the next request to
  `/login`; the sixth failed attempt within 15 minutes shows the rate-limit
  message; sign-out deletes the DB row and cookie and returns to `/login`;
  `next=//evil.com` or `next=https://…` falls back to `/dashboard`; the page
  works in EN/AR (RTL) and light/dark.

- [x] **4. Email delivery and login notifications.**
  `lib/email.ts`: one `sendEmail({ to, subject, text, html })` using Resend
  with `EMAIL_API_KEY` and `EMAIL_FROM`. When `EMAIL_API_KEY` is unset and
  `NODE_ENV !== "production"`, log the message to the server console instead;
  in production an unset key is a logged error, never a thrown request
  failure. `lib/auth/emails.ts` builds the login-notification and reset
  emails with `getTranslations({ locale, namespace: "emails" })` from the
  recipient's stored `language`. After a successful login, send the
  notification (time in UTC, IP from `x-forwarded-for` first entry, user
  agent, and a link to `/forgot-password`) without blocking or failing the
  login; send errors are caught and logged without the token or password.
  **Done when:** a dev login without an API key prints the notification in the
  user's language; forcing a send error still completes the login (unit
  test). **Deferred by the user (2026-10-01):** proof that an email arrives
  through Resend with a real `EMAIL_API_KEY` moves to feature 27 (production
  deployment); no key was configured during this feature, so real delivery is
  unproven.

- [x] **5. Password reset by email.**
  `app/(auth)/forgot-password/page.tsx` + form, and
  `app/(auth)/reset-password/page.tsx` + form (token from `?token=`).
  Actions `requestPasswordReset` and `resetPassword` in `actions/auth.ts`.
  Login page links to forgot-password.
  **Done when:** requesting a reset for an existing active user, an unknown
  identifier, and an inactive user all show the same confirmation message,
  and only the active user receives an email; the link sets a new password,
  deletes all that user's sessions and reset tokens, and redirects to
  `/login?reset=1` with a success notice; a used, expired, or malformed token
  shows the invalid-link message with a link to request a new one; a second
  request invalidates the first link; the fourth request for one identifier
  within an hour is rate-limited (same neutral message, no email).

- [x] **6. Change password.**
  `app/(app)/account/password/page.tsx` + `components/auth/ChangePasswordForm.tsx`
  (reusable by feature 20) and `changePassword` action.
  **Done when:** wrong current password shows a field error on Current
  password; mismatched confirmation shows a field error on Confirm; success
  shows a confirmation, keeps the current session, and deletes every other
  session for that user (verify with a second browser); the new password
  works on next sign-in and the old one does not.

- [x] **7. Final verification.**
  Both locale files have identical key sets; no hard-coded UI strings.
  **Done when:** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, and
  `pnpm build` pass (action tests from Testing are added with steps 3, 5, 6);
  `pnpm exec prisma migrate status` is in sync; all flows above re-checked in
  EN and AR at mobile and desktop width.

- [x] **8. Repair independent-review findings F-01 to F-08.**
  Harden `safeRedirectPath` (F-01); make rate limiting one atomic consume
  before the guarded work, IP key first, refunding the IP attempt on a
  successful sign-in so limits still count failures (F-02, F-04); purge expired
  `RateLimit` and `Session` rows after each sign-in (F-04); restore
  `.env.example` (F-03); create the reset token after the response (F-05);
  return `invalid_token` for a malformed token (F-06); delete other sessions
  inside the password-change transaction (F-07); add email and session-cookie
  tests (F-08).
  **Done when:** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, and
  `pnpm build` pass; a crafted `next=/%09/evil.com` lands on `/dashboard`;
  simultaneous wrong guesses beyond the limit are refused; each finding is
  marked `fixed` in `findings.md` for a later `/audit` to close.
  **Email delivery (2026-10-01):** with a real `EMAIL_API_KEY`, Resend accepted
  the login notification (EN, AR) and the reset email when sent from Resend's
  test sender `onboarding@resend.dev` to the account owner's address. The
  `EMAIL_FROM` value in `.env` was still the `example.com` placeholder, which
  Resend rejects; sending from the salon's own domain stays unproven until a
  domain is verified (feature 27).

- [x] **9. Repair the reopened F-01.**
  The step 8 repair returned the normalized path, so dot-segment inputs such as
  `/.//evil.com` came back as the protocol-relative `//evil.com`. Fall back to
  `/dashboard` when the normalized path starts with `//`.
  **Done when:** `/.//evil.com`, `/..//evil.com`, `/a/..//evil.com`,
  `/%2e//evil.com`, and `/.///evil.com` return `/dashboard`; a combination test
  shows no result resolves to another origin; `pnpm test`,
  `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/*_auth/`, `prisma/seed.ts`,
  `prisma.config.ts`, `.env.example`, `package.json`, `pnpm-lock.yaml`
- `lib/auth/password.ts`, `lib/auth/session.ts`, `lib/auth/current-user.ts`,
  `lib/auth/validation.ts`, `lib/auth/emails.ts`, `lib/email.ts`,
  `lib/rate-limit.ts`
- `actions/auth.ts`
- `proxy.ts` (Next 16 name for middleware; project root)
- `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`,
  `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`
- `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`,
  `app/(app)/account/password/page.tsx`
- `components/auth/LoginForm.tsx`, `ForgotPasswordForm.tsx`,
  `ResetPasswordForm.tsx`, `ChangePasswordForm.tsx`
- `components/layout/Header.tsx`, `components/layout/UserMenu.tsx`
- `components/ui/` - add shadcn `input`, `label`, `card`, and `dropdown-menu`
  as needed via the shadcn CLI (Base UI variant already configured)
- `locales/en.json`, `locales/ar.json`
- `AGENTS.md` Commands (seed command) and `coding-standards.md` Data Fetching
  (replace the auth-library TODO with the chosen approach)

## Data / contracts

All IDs are `String @id @default(cuid())`.

**User** (planned shape): `name` String; `username` String @unique; `email`
String @unique; `phone` String?; `passwordHash` String; `image` String?; `role`
Role @default(STAFF); `isActive` Boolean @default(true); `language` Language
@default(EN); `theme` Theme @default(DARK); `lastLoginAt` DateTime?;
`createdAt`, `updatedAt`. Username and email are stored trimmed and lowercased;
every writer (seed now, feature 6 later) must normalize the same way. Relations
to later models are added by those features.

**Session** (immutable, `createdAt` only): `tokenHash` String @unique
(hex SHA-256 of the cookie token); `userId` -> User (onDelete Cascade, indexed);
`expiresAt` DateTime; `createdAt`.

**PasswordResetToken** (immutable, `createdAt` only): `tokenHash` String
@unique; `userId` -> User (Cascade, indexed); `expiresAt` DateTime; `createdAt`.
Single use: deleted when consumed; all of a user's tokens are deleted when a
new one is issued or the password changes.

**RateLimit**: `key` String @id (for example `login:id:<identifier>`,
`login:ip:<ip>`); `count` Int; `resetAt` DateTime. Increment in one upsert;
when `resetAt` has passed, restart the window at 1.

**Password hash format:** `scrypt$16384$8$1$<salt b64>$<hash b64>`, 16-byte
random salt, 64-byte key, verified with `crypto.timingSafeEqual`. Parameters
are read from the stored string so they can be raised later.

**Session cookie:** name `kosh_session`; value 32 random bytes base64url;
`httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` when
`NODE_ENV === "production"`, `maxAge` 7 days. Session lifetime is a fixed
7 days from sign-in (no sliding renewal, since Server Components cannot
rewrite cookies). Validation: hash the cookie, find the session with its user,
reject when missing, expired (delete row), or user inactive (delete row).

**Password rules:** 8-128 characters, no other composition rules. Identifier:
trimmed, lowercased, 1-254 characters; contains `@` -> match `email`, else
match `username`.

**Rate limits (chosen defaults, constants in `lib/rate-limit.ts`):** login 5
failures per identifier and 20 per IP per 15 minutes (a successful login does
not reset the IP counter; it clears the identifier counter). Reset request 3
per identifier and 10 per IP per hour. Reset token expiry 1 hour.

**Server Action results:** `{ success: true, data? } | { success: false,
error: <code>, fieldErrors?: Record<field, code> }`. Error codes are
translation keys under `auth.errors`: `invalid_credentials`, `inactive`,
`rate_limited`, `invalid_input`, `invalid_token`, `wrong_current_password`,
`password_mismatch`, `unexpected`. Actions never return whether an account
exists except `inactive`, which is only returned after the correct password.
`login` and `resetPassword` finish with `redirect()` on success.

**Environment variables** (add to `.env.example`): `EMAIL_API_KEY` (Resend),
`EMAIL_FROM` (for example `Kosh CRM <no-reply@yourdomain>`), `APP_URL` (absolute
base for email links, for example `http://localhost:3000`), and
`SEED_ADMIN_NAME`, `SEED_ADMIN_USERNAME`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD` (seed only). `AUTH_SECRET` is not needed: tokens are
random and stored hashed.

**Seed:** if any ADMIN exists, print a message and exit 0. Otherwise validate
the four `SEED_ADMIN_*` values with the same Zod rules and create one ADMIN.
Never overwrite, never print the password.

**Safe rendering:** user names and all strings render as React text nodes; no
`dangerouslySetInnerHTML`. Email HTML escapes the user name and user agent.

**Client/server split:** all auth logic, DB access, and email run on the
server. Client forms only submit Server Actions and render returned codes.
Never pass `passwordHash`, token hashes, or sessions to client components; the
header receives only `{ name, role }`.

## Testing

Vitest is configured (`pnpm test`), so logic-bearing steps ship focused tests
in the same step, next to the source as `*.test.ts`:

- `lib/auth/password.test.ts`: hash/verify round trip, wrong password fails,
  malformed stored hash returns false (never throws), two hashes of one
  password differ.
- `lib/auth/validation.test.ts`: identifier normalization (trim, lowercase,
  email vs username), password length bounds, confirm mismatch, safe `next`
  path (`/x` allowed; `//evil.com`, `/\evil`, `https://…`, empty -> fallback).
- `lib/rate-limit.test.ts`: window start, increment, block at the limit,
  reset after expiry (Prisma via `vi.mock()`, time via `vi.useFakeTimers()`).
- `lib/auth/session.test.ts`: token hashing and expiry/inactive rejection
  (Prisma and `next/headers` mocked).
- `actions/auth.test.ts`: `login` returns the same code for unknown user and
  wrong password, `inactive` only after a correct password, `rate_limited`
  before verifying; `requestPasswordReset` returns the same result for
  existing, unknown, and inactive users; `resetPassword` rejects
  used/expired tokens and deletes sessions on success; `changePassword`
  rejects a wrong current password and keeps only the current session
  (Prisma, email, cookies, and `redirect` mocked).

UI pages and email delivery are verified manually. `pnpm test` must pass
before approval. Other verification is `pnpm exec tsc --noEmit`, `pnpm lint`,
`pnpm build`, `pnpm exec prisma migrate status`, and the manual flows in each
step's Done when, in a running dev server against the configured database. Email delivery
through Resend can only be claimed if a real `EMAIL_API_KEY` is used;
otherwise report console-fallback evidence only.

## Notes for the AI

- Next 16 uses `proxy.ts` (export `proxy`), not `middleware.ts`. The proxy is
  an optimistic cookie-presence check only; never rely on it for security.
  Client-side navigation does not re-run layouts, so every protected page and
  every Server Action calls `requireUser()` (or `getCurrentUser()`) itself.
- Cookies can only be set or deleted in Server Actions, Route Handlers, or the
  proxy, not in Server Components. Deleting an invalid session row during
  validation is fine; a stale cookie is harmless.
- Run a dummy scrypt verify when the user is not found so response time does
  not reveal account existence.
- Validate the `next` parameter: must start with `/`, must not start with `//`
  or `/\`; otherwise use `/dashboard`.
- Forms: each input has a visible `<Label>`; field errors link through
  `aria-describedby` with `aria-invalid`; form-level errors render in a
  `role="alert"` region; submit button is disabled and labelled pending while
  the action runs; errors clear on the next submit. Password inputs use
  `autocomplete` values `current-password` / `new-password`; identifier uses
  `username`.
- No toast component is installed; show messages inline (standards mention
  toast, but adding one is not required for this feature).
- Keep the `(auth)` pages inside the root layout so locale, direction, and
  theme work unchanged.
- Role labels in the header come from translations (`auth.roles.ADMIN` etc.).
- Never log passwords, raw tokens, reset links in production, or full cookies.



<!-- blueprint:completion {"schemaVersion":1,"specBytes":19232,"specSha256":"9ab9aa60934f39cdb8dff4eb1f8d12da82ee1cecbfb00a3a06fd8811fb75f63a","branch":"refs/heads/feature/authentication-sessions","head":"a5ffa8d0e987453ec6046a482406236a0131be9b","baseRef":"refs/heads/main","baseCommit":"bdb7393a0e7287bc311c8264481ea1ec7ac8a5a4","sourceTree":"a01816a55bc2ccb2e7f36cad74b20b352159f8b1","absentOptional":[]} -->

## Findings

> Entries F-01 to F-08 were raised by the independent reviewer for checkpoint
> `35255f40db79ad815c1e24d7461c7fd17546b244`. The reviewer runtime refused its
> write to this file, so the builder transcribed them from the reviewer's
> report without changing severity, status, or substance.

### 2/F-01 [P1] closed - Post-login redirect accepts paths that browsers resolve off-site

**File:** lib/auth/validation.ts:50
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `safeRedirectPath` only rejects values starting with `//` or `/\`. `/login?next=/%09/evil.com` decodes to `/<TAB>/evil.com`, which passes. URL parsers strip tabs and newlines, so it resolves to `https://evil.com/` (confirmed in Node). The value goes unchanged into `redirect()` at `actions/auth.ts:165` (after sign-in) and `app/(auth)/login/page.tsx:19` (immediately, for an already signed-in user). Next writes it raw to `Location` and `x-action-redirect`, and the client hard-navigates when the result is external. Confirmed by code path and URL parsing, not in a running browser.
**Suggested fix:** Reject backslashes and ASCII control characters, then parse with `new URL(value, "http://n")`, require the origin to be `http://n`, and return `pathname + search + hash`. Add tab, newline and tab-backslash cases to `lib/auth/validation.test.ts`.
**Resolution:** Fixed 2026-10-01 by /implement. `safeRedirectPath` now rejects any backslash or ASCII control character, parses the value with `new URL(value, "http://n")`, requires that origin, and returns `pathname + search + hash`. Added tab, newline, carriage return, tab-backslash, and NUL cases to `lib/auth/validation.test.ts`. Live on the production build: signing in from `/login?next=/%09/evil.com` and opening the same link while signed in both landed on `/dashboard`. Reopened 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`). The tab, newline and backslash vectors are gone, but the repair introduced a new off-site redirect, so this cannot close. `safeRedirectPath` now returns the normalized `url.pathname`, and the URL parser removes dot segments: `/.//evil.com`, `/..//evil.com`, `/a/..//evil.com` and `/%2e//evil.com` all pass the origin check (origin is still `http://n`) and return `//evil.com`; `/.///evil.com` returns `///evil.com`. Confirmed by running the project's own function with `pnpm exec tsx`. That protocol-relative value goes to `redirect()` at `actions/auth.ts:170` and `app/(auth)/login/page.tsx:19`; Next writes it raw to `Location` and `x-action-redirect` (`node_modules/next/dist/server/app-render/app-render.js:2390`, `action-handler.js:261` and `:906`), and a browser resolves `//evil.com` to `https://evil.com/`. Before the repair the same input was returned unchanged, which a browser keeps on the same origin, so this vector is new in `ba5bc50`. Not reproduced in a running browser (Check was not required). Fix: after the origin check, also fall back to `DEFAULT_REDIRECT` when the normalized `url.pathname` starts with `//`, and add `/.//evil.com`, `/..//evil.com`, `/a/..//evil.com`, `/%2e//evil.com` and `/.///evil.com` to the fallback cases in `lib/auth/validation.test.ts:57`. Fixed again 2026-10-01 by /implement. After the origin check `safeRedirectPath` now also falls back when the normalized `url.pathname` starts with `//`. `lib/auth/validation.test.ts` adds the five reported inputs plus `/%2E%2E//evil.com`, and a combination test over 2,744 three-segment paths (dot segments, encoded dots, `@host`, `:port`, encoded slashes and backslashes) asserting the result never starts with `//` and always resolves to the same origin. Not re-checked in a running browser. Closed 2026-10-01 by /audit independent (target `a5ffa8d0e987453ec6046a482406236a0131be9b`): `safeRedirectPath` (`lib/auth/validation.ts:52`) rejects backslashes and ASCII control characters, requires the parsed origin to be the placeholder base, and falls back when the normalized path starts with `//` (`lib/auth/validation.ts:61`). The reviewer ran the project's own function with `pnpm exec tsx` over 1,007,340 hostile inputs: every vector reported in this entry, a four-segment combination of dot segments, encoded dots, slashes and backslashes, `@host`, `:port`, spaces, and Unicode look-alikes, and 300,000 seeded random paths. Every result started with a single `/`, contained no backslash or control character, and resolved to the same origin; none started with `//`. Both callers (`actions/auth.ts:170`, `app/(auth)/login/page.tsx:19`) pass the value through this function. No new defect found. Not checked in a running browser (Check was not required).

### 2/F-02 [P1] closed - Rate limits are check-then-count, so parallel requests bypass them

**File:** actions/auth.ts:117
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** `login` reads the counters, awaits scrypt, and only then records the attempt (also `actions/auth.ts:134-135`, `:184-189`; `lib/rate-limit.ts:16`). N concurrent requests all pass the check, giving N password guesses per burst against one account, past both the 5-per-identifier and 20-per-IP limits. The rate limiter is the only brute-force control (length-only password rule, no lockout), so the spec's limit does not hold. `requestPasswordReset` has the same gap, allowing more than 3 reset emails per hour. Confirmed by code path, not reproduced against a running server.
**Suggested fix:** One atomic "consume" operation that increments first and decides from the returned count (upsert returning the row, or `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`). Consume both keys before verifying, keep `clearAttempts` on success, and add an interleaved test.
**Resolution:** Fixed 2026-10-01 by /implement. `isRateLimited` and `recordAttempt` are replaced by `consumeAttempt`, one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count` statement that counts first and decides from the returned count. `login` and `requestPasswordReset` consume the IP key, then the identifier key, before any lookup or password check. A successful sign-in clears the identifier counter and refunds its IP attempt, so the limits still count failures as the spec says. Tests: parallel cases in `lib/rate-limit.test.ts` and `actions/auth.test.ts`. Live: 25 parallel `consumeAttempt` calls against the real database allowed exactly 5; 12 simultaneous wrong-password sign-ins in the browser gave 5 `invalid_credentials` and 7 `rate_limited`, and the correct password was then refused. Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): `consumeAttempt` (`lib/rate-limit.ts:20`) is a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement, and `login` (`actions/auth.ts:120`) and `requestPasswordReset` (`actions/auth.ts:190`) consume both keys before any lookup or password check. The success-path `clearAttempts` plus `refundAttempt` only returns the caller's own attempt, so it opens no bypass. No new defect found. The SQL itself is exercised only by the builder's live run; the unit test uses an in-memory stand-in.

### 2/F-03 [P2] closed - .env.example database URL line was truncated

**File:** .env.example:5
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The delta changed `...?sslmode=require"` to `...?sslmode=requi` with no closing quote, and removed the blank line after it and the trailing newline. `dotenv.parse` returns a value starting with a literal `"`, so copying the file to `.env` gives an invalid connection string.
**Suggested fix:** Restore the original line, the blank line after it, and the trailing newline.
**Resolution:** Fixed 2026-10-01 by /implement. Restored the closing `require"`, the blank line after it, and the trailing newline; `dotenv.parse` now returns the full URL without a leading quote. Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): line 5 ends with `require"`, the blank line follows, and the file ends with a newline.

### 2/F-04 [P2] closed - Reset requests create RateLimit rows without bound and nothing purges expired rows

**File:** actions/auth.ts:187
**Found:** 2026-10-01 by /audit independent (scope: current; lens: performance)
**Why it matters:** `requestPasswordReset` records the identifier key even when the caller is already IP-limited, so an anonymous client can insert one new row per request using random identifiers of up to 254 characters. Nothing deletes expired `RateLimit` rows, and expired `Session` rows are only deleted if their cookie is presented again, which stops when the cookie expires.
**Suggested fix:** Skip the identifier record when the IP key is limited, and delete expired rate-limit and session rows opportunistically, for example on sign-in.
**Resolution:** Fixed 2026-10-01 by /implement. The IP key is consumed first, so an IP-limited client creates no identifier counter (login and reset). Each successful sign-in runs `deleteExpiredRateLimits` and `deleteExpiredSessions` after the response. Tests cover both. Live: aged counters and an expired session row were gone after the next sign-in. Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): the IP key is consumed first in both actions, so an IP-limited client creates no identifier row, and `deleteExpiredRateLimits` and `deleteExpiredSessions` run after each successful sign-in (`actions/auth.ts:161`). No new defect found.

### 2/F-05 [P3] closed - Reset request does extra database work only for active accounts

**File:** actions/auth.ts:195
**Found:** 2026-10-01 by /audit independent (scope: current; lens: security)
**Why it matters:** An active account triggers a two-statement transaction before the response; unknown or inactive identifiers return right after the lookup. The body is identical but the timing may reveal active accounts. The difference was not measured.
**Suggested fix:** Move the token write into the after-response callback with the email.
**Resolution:** Fixed 2026-10-01 by /implement. The reset token is now created inside the after-response callback together with the email, so active, unknown, and inactive identifiers do the same work before the response. The timing difference was never measured, before or after. Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): the token transaction and the email both run inside the after-response callback (`actions/auth.ts:204`); active, unknown and inactive identifiers do one lookup before the response. Timing was not measured. No new defect found.

### 2/F-06 [P3] closed - Over-long reset token fails silently

**File:** actions/auth.ts:226
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** A token over 200 characters returns `invalid_input` with `fieldErrors.token`. `ResetPasswordForm` hides the form-level message when `fieldErrors` exists and has no visible token field, so nothing is shown. The spec requires the invalid-link message for a malformed token.
**Suggested fix:** Return `invalid_token` when the schema failure is on `token`, and add a test.
**Resolution:** Fixed 2026-10-01 by /implement. `resetPassword` returns `invalid_token` when the schema failure is on `token`; test added. Live: a 201-character token shows the invalid-link message with the request-a-new-link link. Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): a schema failure on `token` returns `invalid_token` without `fieldErrors` (`actions/auth.ts:234`), which `ResetPasswordForm` renders as the invalid-link message; covered by a test. No new defect found.

### 2/F-07 [P3] closed - Password change removes other sessions outside the transaction

**File:** actions/auth.ts:274
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** If `deleteUserSessions` fails after the password transaction commits, the user sees a generic error although the password changed, and the other sessions stay valid for up to 7 days.
**Suggested fix:** Add the `session.deleteMany` (excluding the current session) to the same `$transaction`.
**Resolution:** Fixed 2026-10-01 by /implement. `session.deleteMany` (excluding the current session) is part of the password `$transaction`; the now-unused `deleteUserSessions` was removed. Live: after a password change the first browser stayed signed in and a second browser was sent to `/login`. Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): `session.deleteMany` excluding the current session is the third operation of the password `$transaction` (`actions/auth.ts:280`), and `deleteUserSessions` has no remaining reference. No new defect found.

### 2/F-08 [P3] closed - No tests for email escaping or session cookie attributes

**File:** lib/auth/emails.ts:9
**Found:** 2026-10-01 by /audit independent (scope: current; lens: tests)
**Why it matters:** There is no `emails.test.ts`, so HTML escaping of name and user agent and the language/direction choice are unasserted. `session.test.ts` never calls `createSession` or `deleteCurrentSession` (`lib/auth/session.ts:60-66`), so the cookie flags can regress silently.
**Suggested fix:** Add `lib/auth/emails.test.ts` (escaping of `<`, `"`, `&`; `AR` gives `dir="rtl"`) and assert the options passed to `cookies().set` plus `deleteCurrentSession` behaviour.
**Resolution:** Fixed 2026-10-01 by /implement. Added `lib/auth/emails.test.ts` (escaping of `<`, `>`, `"`, `'`, `&` in name, user agent and link; `AR` gives `lang="ar" dir="rtl"`) and cookie tests in `lib/auth/session.test.ts` (options passed to `cookies().set`, `secure` in production, `deleteCurrentSession` with and without a cookie). Closed 2026-10-01 by /audit independent (target `ba5bc50953cc36d4ded7a60274e91f89c02eaafb`): `lib/auth/emails.test.ts` asserts escaping and language/direction, and `lib/auth/session.test.ts` asserts the cookie options, the production `secure` flag and `deleteCurrentSession`; all pass under `pnpm test`. No new defect found.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** a5ffa8d0e987453ec6046a482406236a0131be9b
**Base commit:** bdb7393a0e7287bc311c8264481ea1ec7ac8a5a4
**Base ref:** main
**Spec hash:** 9ab9aa60934f39cdb8dff4eb1f8d12da82ee1cecbfb00a3a06fd8811fb75f63a
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T02:02:27Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T02:11:29Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `bdb7393a0e7287bc311c8264481ea1ec7ac8a5a4..a5ffa8d0e987453ec6046a482406236a0131be9b` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base, and spec hash match the request; only `blueprint/context/review.md` differed before this receipt)
- `pnpm test`: pass (7 files, 54 tests)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm build`: pass (7 dynamic routes plus the proxy)
- `pnpm exec prisma validate`: pass
- `pnpm exec prisma migrate status`: pass (1 migration, database schema up to date)
- `pnpm exec tsx <scratch script>` running the project's `safeRedirectPath`: pass (1,007,340 hostile inputs, 0 off-site or protocol-relative results)
- `pnpm exec tsx --env-file=.env <scratch script>` read-only database probe: pass (raw-query date parameters and ORM date filters agree; session time zone UTC)

## Evidence

- Reviewed the complete `bdb7393a0e7287bc311c8264481ea1ec7ac8a5a4..a5ffa8d0e987453ec6046a482406236a0131be9b` delta fresh against the active spec: `actions/auth.ts`, `lib/auth/*`, `lib/rate-limit.ts`, `lib/email.ts`, `proxy.ts`, `prisma/schema.prisma`, the `auth` migration, `prisma/seed.ts`, `prisma.config.ts`, the `(auth)` and `(app)` routes, `components/auth/*`, `components/layout/Header.tsx` and `UserMenu.tsx`, both locale files, `.env.example`, `package.json`, `vitest.config.mts`, the `AGENTS.md` and `coding-standards.md` edits, and all seven test files.
- Excluded as generated: `pnpm-lock.yaml`, `generated/`, `.next/`. The shadcn-generated `components/ui/card.tsx`, `dropdown-menu.tsx`, `input.tsx`, and `label.tsx` were covered by lint, typecheck, and build only.
- Redirect validation: the project's `safeRedirectPath` was executed over every vector recorded in F-01, a four-segment combination set (dot segments, encoded dots, encoded slashes and backslashes, `@host`, `:port`, spaces, Unicode look-alikes, NUL), and 300,000 seeded random paths. Every result began with a single `/`, held no backslash or control character, and resolved to the same origin. Both callers route through it.
- Rate limiting: `consumeAttempt` is one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement; `login` and `requestPasswordReset` consume the IP key, then the identifier key, before any lookup or password check. The success-path clear and refund return only the caller's own attempt. A read-only probe against the configured database showed a raw-query `Date` parameter compares with the `resetAt` column exactly as the ORM filter in `deleteExpiredRateLimits` does (same expired-row count, zero parameter skew).
- Sessions and reset tokens: only SHA-256 hashes are stored; tokens are 32 random bytes; expired sessions and sessions of inactive users are deleted and rejected; password reset deletes every session and token in one transaction; password change keeps only the current session in the same transaction; reset links are built from `APP_URL`, not the request host.
- Account-existence neutrality: unknown and wrong-password sign-ins share one code and both run scrypt; `inactive` is returned only after a correct password; reset requests return the same result and do one lookup before the response for active, unknown, inactive, and rate-limited callers.
- Locale files have identical key sets (93 keys each) and contain every error code the actions return. No `dangerouslySetInnerHTML`. No skipped, focused, or placeholder tests.
- Ledger: F-01 re-examined and closed. F-02 to F-08 were already closed and the fresh review found none of them back. One new P3 finding recorded (F-09).

## Findings

- F-09 [P3] open - Change password checks the current password with no attempt limit (`actions/auth.ts:271`). Not blocking.
- F-01 [P1] closed this pass. No P0 or P1 finding is `open` or `fixed`.

## Remaining risk

- Check was not required, so no flow was exercised in a running browser by the reviewer: redirect handling, cookie attributes, RTL and theme rendering, and the after-response email and cleanup tasks rest on the builder's manual evidence and unit tests.
- The `consumeAttempt` SQL has no automated test; `lib/rate-limit.test.ts` replaces it with an in-memory stand-in. Its concurrency behaviour rests on the builder's live run, and the reviewer's probe covered date semantics only (it did not write rows).
- Rate limits are keyed by the submitted identifier, so one account has separate budgets for its username and its email (up to 10 sign-in guesses per 15 minutes and 6 reset emails per hour), and anyone can use up a known identifier's budget to delay that person's sign-in or reset. This follows the spec's per-identifier rule and its out-of-scope lockout decision.
- The client IP is the first `x-forwarded-for` entry, falling back to one shared `unknown` key. That is sound on Vercel, which overwrites the header; on a host that forwards a client-supplied header the per-IP limit can be evaded, and without the header all clients share one bucket.
- Real email delivery from the salon's own domain remains unproven (deferred by the user to feature 27).
- The dashboard activity record (`blueprint/.state/run.json`) was not written by the reviewer because this run's write boundary allowed only the findings and review files.
- No dependency vulnerability scan was run; no such command is declared and network-backed tools were not approved.
