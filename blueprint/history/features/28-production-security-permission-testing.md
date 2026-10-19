# Feature: Production security & permission testing

**From build-plan:** feature 28
**Build attempt:** 1
**Branch:** feature/production-security-permission-testing
**Status:** verified (automated). The manual checklist in `docs/security.md` is pending `/check`.

## Goal

Prove, with repeatable automated tests and one recorded manual pass, that the
shipped access rules hold: role boundaries, no permission escalation, inactive
accounts locked out, no unauthorized financial actions, session security, and no
sensitive data reaching the wrong user. Fill only the test gaps the existing
731-test suite leaves, fix any real defect a new test exposes, and record the
results in one short security document.

## In scope

- **Role-boundary matrix** (one new test file) that runs every pure access gate
  against five fixed actors: ADMIN, default SUPERVISOR, default STAFF, STAFF
  granted every key, and SUPERVISOR with no keys. Expected outcomes come from the
  overview's role table, not from the current code.
- **Unauthenticated guard sweep**: every exported Server Action in `actions/`
  (found by enumerating module exports, so a new action is covered automatically)
  must stop at `requireSession()` before touching the database, except an explicit
  allowlist of public actions with a reason for each.
- **Escalation gaps**: mass-assignment of `role`, `isActive`, `sharePercentage`,
  or `permissions` fields through `updateProfile`; non-admin `setEmployeeShare`
  even holding every key; any `updateUserPermissions` or `employees` escalation
  path from the inventory below that lacks a test.
- **Inactive accounts and sessions**: deactivation removes the target's sessions;
  `proxy.ts` behavior (no tests today): redirect without a cookie carrying a
  `next` path, pass-through with a cookie, and the matcher's public paths.
- **Unauthorized financial actions**: confirm each financial action in the
  inventory has a denied test for a missing permission and, where the overview
  says Staff never may, for Staff holding every key. Add only the missing ones.
- **Sensitive data review**: a source review that `passwordHash`, `tokenHash`,
  and reset tokens are never selected outside `lib/auth/` and `actions/auth.ts`,
  `actions/employees.ts`, and that no such field reaches a client component's
  props; record the result.
- `docs/security.md`: the role/permission matrix, the action inventory with its
  guard, what is covered by automated tests, and the manual check results.

## Out of scope

- Changing the permission model, role defaults, or what an Admin may grant (see
  Open questions).
- New security mechanisms (CSP headers, CSRF tokens beyond Next.js Server Action
  origin checks, extra rate limits, 2FA, session rotation).
- Browser test harness, end-to-end, accessibility, and performance work (feature 29).
- Open finding F-50 (Staff's Revenue nav link): a UI visibility issue tracked
  separately, not an access defect.
- Penetration testing against the deployed Vercel production URL.

## Build loop

`workflow.stepReview` is `feature`: implement all steps, then present one review
packet. `workflow.checkpointCommits` is `disabled`: no commits per step;
`/complete` creates the feature commit. This feature touches auth and
authorization tests, so the `when-sensitive` independent-review gate is likely
to apply at `/audit`.

If a new test exposes a real access defect, stop that step, report the failing
test and the code path, and propose the smallest fix in the review packet before
changing product code. Do not weaken a test to make it pass.

## Build steps

- [x] **1. Role-boundary matrix.** Add `lib/security-matrix.test.ts`. Build each
  actor's permission set from `ROLE_DEFAULTS` / `PERMISSION_KEYS` (ADMIN = every
  key). Assert, per actor, the result of: `ROLE_DEFAULTS` content against the
  overview table (Supervisor default never holds `settlements.approve`,
  `settlements.mark_paid`, `settings.*`, `permissions.manage`, `employees.create`
  /`edit`/`delete`/`activate`); `canManageInvoices`, `canViewEmployeeInvoices`
  (own vs other target); `canViewSalonDashboard`; `canViewRevenueReport`;
  `canViewExpenseReport`; `employeeReportScope` and `canViewEmployeePerformance`;
  `settlementReportScope`; `canManageSettlements`, `canRunSettlementAction`,
  `canAdjustSettlement`; `canManageEmployee`, `canManageEmployeeAccess`,
  `canChangeEmployeeRole` against ADMIN/SUPERVISOR/STAFF/self targets;
  `changeableKeys`; `visibleNavKeys`. Confirm each signature in its module first;
  a gate that does not exist is dropped, not invented. Express expectations as a
  table so one row reads as one role contract.
  **Done when:** `pnpm test` passes with the new file; STAFF granted every key gets
  no salon-wide report, dashboard, invoice-management, or settlement-management
  access and only own scope where scope applies.

- [x] **2. Unauthenticated guard sweep.** Add `actions/security.test.ts`. Mock
  `@/lib/auth/current-user` so `requireSession` throws a sentinel (as `redirect`
  does) and `getCurrentSession` returns null; mock `@/lib/db` with a Proxy that
  records any property access; mock `next/cache`, `next/headers`, and
  `next/navigation` as the existing action tests do. Import every `actions/*.ts`
  module except tests, call each exported function with `(null, new FormData())`,
  and assert it rejects with the sentinel (or returns a non-success result for an
  allowlisted one) and that the db Proxy recorded nothing before the guard.
  Allowlist with a one-line reason: `login`, `requestPasswordReset`,
  `resetPassword` (public auth flows), `logout` (handles no session itself), and
  `setLocale` / `saveThemePreference` only if reading them shows they work
  without a session by design; otherwise they join the guarded set.
  **Done when:** the sweep covers every exported action (assert the discovered
  count is at least 40 so a broken import fails loudly) and `pnpm test` passes.

- [x] **3. Escalation and inactive-account gaps.** In the existing test files add
  only missing cases: `updateProfile` with extra `role=ADMIN`, `isActive=false`,
  `sharePercentage=0`, `permissions=permissions.manage` fields writes only
  `name`/`phone` (`actions/account.test.ts`); `setEmployeeShare` by a SUPERVISOR
  holding every key returns `forbidden` with no write; `setEmployeeActive(false)`
  deletes the target's sessions in the same transaction as the update (verify the
  existing test; add if absent); `updateUserPermissions` by a non-admin holding
  `permissions.manage` cannot add a key it lacks or `permissions.manage` itself
  (verify; add if absent). Add `proxy.test.ts`: no cookie on `/settlements?m=1`
  redirects to `/login?next=%2Fsettlements%3Fm%3D1`; no cookie on `/` redirects
  to `/login` with no `next`; a cookie passes through; and the matcher regex does
  not match `/login`, `/forgot-password`, `/reset-password`, `/api/health`,
  `/_next/static/x` but matches `/dashboard` and `/api/other`.
  **Done when:** `pnpm test` passes with each listed case present once.

- [x] **4. Financial and sensitive-data review.** Walk the inventory below and
  confirm each financial action has its denied test(s); add any missing. Search
  for `passwordHash`, `tokenHash`, and `PasswordResetToken` selects across `app/`,
  `components/`, `lib/`, `actions/`; confirm none is selected in a page/loader or
  passed to a `"use client"` component. Confirm `/audit-log` stays ADMIN-only and
  `/api/health` returns no detail. Fix nothing silently: a real gap stops here
  per the Build loop.
  **Done when:** every inventory row has a named test, the search result is
  recorded, and `pnpm test`, `pnpm lint`, and `pnpm exec tsc --noEmit` pass.

- [x] **5. Security record.** Write `docs/security.md`: the role matrix (from
  step 1), the action inventory with guard and covering test file, the session
  and cookie rules (hashed tokens, httpOnly, `sameSite=lax`, `secure` in
  production, 7-day expiry, revocation on password change/reset/deactivation),
  the explicit-grant policy for non-own-scoped areas, and a manual checklist for
  `/check`: sign in as ADMIN, default SUPERVISOR, and default STAFF; for Staff,
  open `/transactions/<other employee's invoice id>` and
  `/settlements/<other employee's settlement id>` (expect not found),
  `/reports/revenue`, `/settings`, `/audit-log`, `/employees` (expect forbidden);
  deactivate a signed-in Staff user from an Admin session and confirm their next
  request lands on `/login`. Leave result fields to be filled by `/check`; do not
  record results that were not observed.
  **Done when:** the document exists, links from `docs/operations.md`, and every
  automated claim names a test file that exists.

## Files / areas

- New: `lib/security-matrix.test.ts`, `actions/security.test.ts`,
  `proxy.test.ts`, `docs/security.md`.
- Extended only where a case is missing: `actions/account.test.ts`,
  `actions/employees.test.ts`, `actions/permissions.test.ts`,
  `actions/settlements.test.ts`, `actions/invoices.test.ts`,
  `actions/settings.test.ts`, `actions/expenses.test.ts`,
  `actions/employee-expenses.test.ts`.
- `docs/operations.md`: one link line.
- Read-only references: `lib/auth/*`, `lib/invoices.ts`, `lib/reports.ts`,
  `lib/settlements.ts`, `lib/dashboard.ts`, `lib/employees.ts`,
  `lib/navigation.ts`, `proxy.ts`, `app/(app)/**/page.tsx`.
- Product code changes only for a defect confirmed per the Build loop.

## Data / contracts

No schema, migration, route, or action-contract change. Action inventory (guard
observed in the repository; Staff-never = rejected for STAFF even holding the key):

| Action | Guard |
| --- | --- |
| `createInvoice` | `invoices.create`; Staff forced to own `employeeId` |
| `updateInvoice`, `setInvoiceStatus` | `invoices.edit` / `invoices.change_status`; Staff-never |
| `generateSettlements` | `settlements.create`; Staff-never |
| `recalculateSettlement`, `markSettlementCalculated` | `settlements.create`; Staff-never |
| `approveSettlement` | `settlements.approve`; Staff-never |
| `markSettlementPaid`, `createSettlementAdjustment` | `settlements.mark_paid`; Staff-never |
| `createExpense`, `updateExpense`, `deleteExpense` | `expenses.create` / `edit` / `delete` |
| `create/update/deleteEmployeeExpense` | `employee_expenses.create` / `edit` / `delete` |
| `updateFinancialSettings`, `updateSalonInformation`, `updateNotificationSettings`, `updateSalonLogo`, `removeSalonLogo` | `settings.edit` |
| `setEmployeeShare` | ADMIN only |
| `createEmployee` | `employees.create`; non-admin forced `STAFF` |
| `updateEmployee`, `updateEmployeeImage`, `removeEmployeeImage` | `employees.edit` + `canManageEmployee`; role change ADMIN-only, never self |
| `setEmployeeActive` | `employees.activate` + `canManageEmployeeAccess` |
| `setEmployeePassword` | `employees.edit` + `canManageEmployeeAccess` |
| `updateUserPermissions` | `changeableKeys`; never an ADMIN or self |
| `create/update/setServiceActive` | `services.create` / `edit` |
| `updateProfile`, `changePassword`, `signOutOtherSessions` | session; own account only |

Confirm `recalculateSettlement` / `markSettlementCalculated` permissions in
`actions/settlements.ts:318-330` during step 4 and correct this table in
`docs/security.md` if the code differs.

## Testing

- Command: `pnpm test` (Vitest, `*.test.ts`, node environment). Also `pnpm lint`
  and `pnpm exec tsc --noEmit`. No Verify command or browser harness exists.
- Baseline observed during spec: 38 files, 731 tests pass.
- All new tests are unit tests with mocked `db` and session, matching
  `actions/invoices.test.ts`. No test hits a real database.
- Live checks are the manual checklist in `docs/security.md`, run in `/check`.

## Notes for the AI

- Expected values come from the overview's role table and the prior feature
  specs, not from reading the implementation and copying its output.
- Existing denied-path coverage is extensive (settlements, invoices, employees,
  permissions, sessions, login rate limiting, `safeRedirectPath`). Do not
  duplicate a case that already exists; cite it in `docs/security.md` instead.
- Staff granted `expenses.*`, `employee_expenses.*`, `employees.view`,
  `services.*`, or `settings.*` by an Admin currently get that access salon-wide
  (decided in features 06, 09, 10: those areas have no own scope). The matrix
  pins this as current behavior and the doc states it as policy.
- `react` `cache` makes permission lookups per request, so a revoked permission
  applies on the next request; state this, no test for cross-request caching.
- Never print secrets, tokens, or `.env` values in tests or docs.

## Open questions

- **Explicit grants to Staff for salon-wide areas (non-blocking).** The overview
  says Staff see "no salon-wide financials or other employees' data", yet an
  Admin may grant a Staff user `expenses.view` or `employee_expenses.view` and
  they then see every record. Current behavior (prior features 09/10) honors the
  Admin's explicit grant. Keep that (default for this spec), or should Staff be
  denied those areas regardless of grants, as invoices, settlements, and reports
  already are? Changing it would be a separate `/fix`, not this feature.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13214,"specSha256":"cf0b281bedc1712cf25d65d13ddd787f16922f7dc5af66e90a2d54c049d4a3dc","branch":"refs/heads/feature/production-security-permission-testing","head":"893225c7663ae29c7db21602aa59d9810e92fd8f","baseRef":"refs/heads/main","baseCommit":"5137e9c6a119ca66204ec407fd6219112eb9dba9","sourceTree":"28f0bdf36e85f5ccc562c2af99df26007b5fec67","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 893225c7663ae29c7db21602aa59d9810e92fd8f
**Base commit:** 5137e9c6a119ca66204ec407fd6219112eb9dba9
**Base ref:** main
**Spec hash:** cf0b281bedc1712cf25d65d13ddd787f16922f7dc5af66e90a2d54c049d4a3dc
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-19T01:08:01Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-19T01:12:41Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `5137e9c6a119ca66204ec407fd6219112eb9dba9..893225c7663ae29c7db21602aa59d9810e92fd8f` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash; spec is tracked, no snapshot)
- `git status --porcelain --untracked-files=all`: pass (only `blueprint/context/review.md` differs)
- `pnpm test`: pass (41 files, 793 tests)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `node <scratchpad>/m.cjs` (compiles `proxy.ts` matcher with Next's own `getMiddlewareMatchers` and compares to the test's regex): pass (same result for all 11 tested paths)

## Evidence

- Delta is test and docs only: `lib/security-matrix.test.ts`, `actions/security.test.ts`, `proxy.test.ts`, one case in `actions/account.test.ts`, `docs/security.md`, a link in `docs/operations.md`, and the spec. No product code, schema, route, or action contract changed.
- Signed-out sweep: `rejects.toBe(NO_SESSION)` is only satisfiable through the mocked `requireSession` (directly or via `requirePermission`); a db read before the guard records a key in the Proxy or throws a `TypeError` on the `undefined` member, so an action that skipped the guard would fail. Discovery is from `readdirSync(actions/)` with a count floor of 40; allowlist entries are checked against discovered names.
- Role matrix expectations checked against the overview "Users" table: Staff defaults match exactly; Supervisor defaults in code match the overview list (`lib/auth/permissions.ts:31`), but the test pins them only by exclusion (F-61). Staff-granted-every-key rows deny salon dashboard, revenue/expense reports, invoice management, and settlement management, and give own scope only.
- `proxy.test.ts` matcher: Next wraps the source with an optional `/_next/data/<id>` prefix and `.json`/`.rsc` suffix; for every tested path the real compiled regex and the test's `^...$` regex agree. Redirect `next` encoding and root case match `proxy.ts`.
- `docs/security.md` claims checked against code: scrypt hashing (`lib/auth/password.ts`), SHA-256 token hashes and cookie flags/7-day expiry (`lib/auth/session.ts`), expired/inactive session deletion, deactivation deleting sessions and reset tokens, change-password vs reset session revocation and inactive-after-correct-password login (`actions/auth.ts`), `/audit-log` ADMIN-only by role, `/api/health` returning only `ok`/`unavailable`, `notFound()` for out-of-scope invoice and settlement pages, `passwordHash`/`tokenHash` only in `lib/auth/session.ts`, `actions/auth.ts`, `actions/employees.ts` (plus the seed's write), and no `include:` or whole-relation loads anywhere. One incomplete row recorded as F-63.
- Settlement inventory confirmed: `recalculate` and `calculate` use `settlements.create` (`lib/settlements.ts:92`), matching the doc table; each financial action has a Staff-even-holding-every-key denied test (`actions/invoices.test.ts:254`, `:359`; `actions/settlements.test.ts:286`, `:504`, `:617`).

## Findings

- F-61 [P3] open: Supervisor defaults pinned only by exclusion in the role matrix
- F-62 [P3] open: two sweep assertions can pass on call history from earlier cases
- F-63 [P3] open: security record omits the non-admin target rule for status and password rows

## Remaining risk

- Manual checklist in `docs/security.md` has no recorded results; Check was not required for this receipt and no running app was exercised.
- No `Verify` command, browser harness, or dependency/security scanner is configured, so none ran.
- The `proxy.ts` matcher's negative lookahead has no segment boundary (`/login-history`, `/api/healthz` also bypass the optimistic redirect). Pre-existing and outside this delta; pages and actions still validate the session.
- Public auth actions (`login`, `requestPasswordReset`, `resetPassword`) are excluded from the sweep by design and rely on their own tests in `actions/auth.test.ts`.
