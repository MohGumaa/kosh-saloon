# Feature: Staff personal dashboard

**From build-plan:** feature 15
**Build attempt:** 1
**Branch:** feature/staff-personal-dashboard
**Status:** verified

## Goal

A STAFF user's `/dashboard` shows their own figures for the current salon month:
paid revenue, paid and unpaid bills, effective share percentage, earnings, own
employee expenses, an estimated current payout, and their latest settlement's
final payout and status. The page never shows salon-wide data or other
employees' data.

## In scope

- Replace the STAFF-only branch of `app/(app)/dashboard/page.tsx` (today it shows
  just the welcome and account card) with the personal dashboard. Keep the
  welcome panel and the account card.
- Current salon month only (`salonMonth()`). There is no period selector or
  month navigation.
- Figure cards, all scoped to `employeeId = user.id` (the session user):
  - **Paid revenue:** sum of the user's PAID invoices created this salon month.
  - **Paid bills:** how many PAID invoices there are.
  - **Unpaid bills:** how many UNPAID invoices there are, plus their total amount.
    UNPAID invoices are shown for information only and never count toward
    revenue or payout.
  - **Share percentage:** `effectiveSharePercentage(user.sharePercentage, settings.employeeSharePercentage)`,
    with a hint naming its source (your own rate or the salon default).
  - **Earnings:** `employeeShare` from `calculateSettlement`, rounded to 2
    decimals half up, the same way settlements store it.
  - **Expenses:** total of the user's own employee expenses dated this month
    (`expensesWhere(month)`). Show the total only, never descriptions.
  - **Estimated payout:** `calculateSettlement(...).finalAmount` with
    `adjustments = 0` (see Open questions). Label it as an estimate that is
    finalized by the month's settlement. It can be negative.
- **Latest settlement panel:** the user's most recent `EmployeeSettlement` by
  `periodStart`. Show its month, `finalAmount` (labeled "final payout"), the
  `SettlementStatusBadge`, and a link to `/settlements/[id]`. If there is none,
  show an empty state.
- Permission gating, enforced on the server, with gated queries not run when the
  check fails:
  - Figure cards need `reports.view_own_performance`.
  - The latest settlement panel needs `settlements.view`.
  - Without either permission, the page shows only the welcome and account card,
    as it does now.
- Copy in English and Arabic in `locales/en.json` and `locales/ar.json`.
  `personalBody` is updated to describe the new page.

## Out of scope

- SUPERVISOR or other non-STAFF users without `reports.view`. They keep the
  current account-only view.
- Period presets, custom ranges, charts, a latest-invoices list, or month
  history (later reports: features 16–19).
- Pending settlement adjustments in the estimate. They stay visible on the
  settlement pages.
- Any change to the admin dashboard, earnings, or settlement rules.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`. Build
every step, run the checks, then present one review packet for the whole feature.
There are no per-step pauses and no checkpoint commits. `/complete` makes the
feature commit.

## Build steps

1. [x] **Gating helper and tests.** In `lib/dashboard.ts`, add
   `personalSections(permissions)` returning
   `{ figures: has("reports.view_own_performance"), settlement: has("settlements.view") }`.
   Add cases to `lib/dashboard.test.ts`: STAFF defaults give both, an empty set
   gives neither, and each key alone gives only its own section.
   **Done when:** `pnpm test` passes with the new cases.
2. [x] **Personal data loader.** In `lib/dashboard-data.ts`, add
   `loadPersonalDashboard(userId, sharePercentage, sections, month, timeZone = SALON_TIME_ZONE)`.
   It runs in parallel: `getSalonSettings()`; when `sections.figures` is true, an
   invoice `groupBy` on status (PAID and UNPAID, `employeeId: userId`,
   `createdAt: salonMonthRange(month)`) with `_sum.amount` and `_count`, plus an
   `employeeExpense.aggregate` (`employeeId: userId`, `...expensesWhere(month)`);
   and when `sections.settlement` is true, `employeeSettlement.findFirst`
   (`employeeId: userId`, ordered by `periodStart` descending, selecting `id`,
   `periodStart`, `finalAmount`, `status`). It computes the share with
   `effectiveSharePercentage` and the figures with `calculateSettlement`
   (`adjustments: 0`). It returns `{ currency, figures | null, latestSettlement | null | undefined }`.
   Every query filters by `userId`; none takes a client-supplied id.
   **Done when:** `pnpm exec tsc --noEmit` passes. The math is already covered by
   the existing `calculateSettlement` and `effectiveSharePercentage` tests.
3. [x] **Page and translations.** In `app/(app)/dashboard/page.tsx`, when
   `isOwnScope(user)` and the user is not a salon viewer: get the user's
   `sharePercentage` (add it to the existing `db.user.findUnique` select), call
   the loader, and render the welcome panel, a "This month" section with
   `StatCard`s for the figures (if allowed), the latest settlement panel (if
   allowed), and the account card. Use the existing `price` and `percent`
   `Intl` formatters, `dir="ltr"` numbers, and `EmptyState` for "no settlement
   yet". Set the month heading with UTC `Intl.DateTimeFormat`, as the settlements
   pages do. Non-STAFF users without `reports.view` keep exactly the current
   view. Add `dashboard.personal.*` keys (stat titles, hints, estimate note,
   settlement panel title, empty text, and link) to both locale files, and
   update `personalBody`.
   **Done when:** `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and
   `pnpm build` pass. A STAFF user with default permissions sees all cards and
   the settlement panel, in English and Arabic (RTL). A STAFF user with both keys
   removed sees only the welcome and account card. The admin dashboard is
   unchanged.

## Files / areas

- `lib/dashboard.ts`, `lib/dashboard.test.ts`: gating helper
- `lib/dashboard-data.ts`: `loadPersonalDashboard`
- `app/(app)/dashboard/page.tsx`: STAFF branch
- `locales/en.json`, `locales/ar.json`: `dashboard.personal.*`, `personalBody`
- Reused, not changed: `lib/earnings.ts` (`effectiveSharePercentage`,
  `salonMonth`, `salonMonthRange`), `lib/settlements.ts` (`calculateSettlement`,
  `expensesWhere`), `components/dashboard/StatCard.tsx`,
  `components/settlements/SettlementStatusBadge.tsx`,
  `app/(app)/dashboard/loading.tsx`, `app/(app)/error.tsx`

## Data / contracts

- No schema, migration, server action, or route changes. The page is read-only.
- Trusted actor: `requireSession()`'s `user.id` and `user.role`. The scope is
  `isOwnScope(user)` (STAFF). Every personal query filters by that id.
- Money is a Prisma `Decimal` until formatting. Earnings follow
  `calculateSettlement` (half-up, 2 decimals). The estimate is
  `employeeShare - expenses`, can be negative, and is not stored.
- Month boundaries use the salon time zone (`salonMonthRange` for invoice
  `createdAt`, `expensesWhere` for `@db.Date` expenses).
- The settlement link goes to `/settlements/[id]`, which already returns
  not-found for another employee's settlement.

## Testing

- Unit: `personalSections` cases in `lib/dashboard.test.ts` (`pnpm test`).
- The figure math reuses already-tested functions. No new money logic means no
  new math tests.
- Static: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.
- Manual or `/check`: STAFF with default permissions, STAFF with the keys
  removed, ADMIN (unchanged), Arabic RTL, a month with no invoices (zero values),
  and no settlement (empty state). No browser test is added: the Playwright
  harness (`e2e/`, `playwright.config.ts`) is still uncommitted in the working
  tree.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for any unfamiliar page API. Follow the
  existing `PageProps<"/dashboard">` pattern.
- User-controlled text (the user's name) is already rendered as escaped React
  text. Do not add `dangerouslySetInnerHTML`.
- Implementation note: `personalBody` was kept unchanged for the account-only view (Supervisors without `reports.view`, and Staff without both keys). The personal dashboard uses a new `dashboard.personal.body` instead, so account-only users are not told about figures they cannot see.
- Keep `canViewSalonDashboard` as the first branch. The personal dashboard never
  calls `loadDashboard`.
- Zero values render as formatted zeros with a hint, not as errors. An
  unexpected failure falls through to `app/(app)/error.tsx`.

## Open questions

- **Estimated payout excludes pending adjustments.** Default chosen: the
  estimate is `earnings - expenses` with no adjustments, because a pending
  adjustment is claimed by the next settlement generated, which may be last
  month's rather than this month's. Confirm, or ask for pending adjustments to
  be included.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8910,"specSha256":"8055f2053893567a964292aec74746b071e8d0e58f91d28b3bbe3574e3d63bac","branch":"refs/heads/feature/staff-personal-dashboard","head":"b474ddf72f2f222af2d7c5fc4089b4003299c858","baseRef":"refs/heads/main","baseCommit":"dc58e2a763d3e1c3e5251111b2c11f7962d69de4","sourceTree":"713d04fc1f2f89858dcc703e90fdf2e408d97726","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** b474ddf72f2f222af2d7c5fc4089b4003299c858
**Base commit:** dc58e2a763d3e1c3e5251111b2c11f7962d69de4
**Base ref:** main
**Spec hash:** 8055f2053893567a964292aec74746b071e8d0e58f91d28b3bbe3574e3d63bac
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-07T02:05:17Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T02:10:39Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `dc58e2a763d3e1c3e5251111b2c11f7962d69de4..b474ddf72f2f222af2d7c5fc4089b4003299c858` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main b474ddf72f2f222af2d7c5fc4089b4003299c858`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash; spec is tracked and unmodified)
- `git status --porcelain`: pass (only `blueprint/context/review.md` modified)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (31 files, 585 tests)
- `pnpm build`: unavailable (not run; it writes build output and was outside this read-only review)
- Verify command: unavailable (none defined)

### Evidence

- Full delta reviewed: `app/(app)/dashboard/page.tsx`, `lib/dashboard-data.ts`, `lib/dashboard.ts`, `lib/dashboard.test.ts`, `locales/en.json`, `locales/ar.json`, plus the spec change.
- Ownership: every personal query in `loadPersonalDashboard` filters `employeeId: userId`, and the page passes only the session `user.id`; no search param reaches the loader. The settlement link targets `/settlements/[id]`, which calls `requirePermission("settlements.view")` and returns not-found for another employee's settlement when `isOwnScope` (line 79).
- Gating: `personalSections` maps `reports.view_own_performance` to figures and `settlements.view` to the settlement panel; the loader skips each gated query when its flag is false; the personal branch runs only when `!salonView && isOwnScope(user)`.
- Non-Staff behavior: `canViewSalonDashboard` stays the first branch and never calls the personal loader; non-Staff without `reports.view` get the same welcome text (`personalBody`) and the same `max-w-md` account card as before.
- Money: invoice sums use `salonMonthRange(month)` (salon time zone) with PAID and UNPAID only; expenses use `expensesWhere(month)` for `@db.Date`; earnings and estimate come from `calculateSettlement` (half-up, 2 decimals, adjustments 0), matching `actions/settlements.ts` generation. Decimals stay `Prisma.Decimal` until `Intl` formatting; empty groupBy and null sums fall back to zero.
- i18n/RTL: new `dashboard.personal.*` keys exist in both locales with matching shapes; `settlements.statuses.*` exists for all four statuses; numbers render inside `dir="ltr"` spans; month headings use UTC `Intl.DateTimeFormat`.
- Performance: four parallel queries per view, backed by `@@index([employeeId, createdAt])`, `@@index([employeeId, date])`, and `@@unique([employeeId, periodStart])`.

### Findings

- F-47 [P3] open: welcome text promises month figures to a Staff user who has only `settlements.view`
- F-48 [P3] open: no test pins that the personal loader skips gated queries and scopes by `userId`

### Remaining risk

- `pnpm build` was not run in this review; the builder's build result is unverified here.
- No Verify command is defined for the project.
- No browser or runtime evidence: Check was not required and no dev server was started, so the rendered Staff, Staff-without-permissions, ADMIN, Arabic RTL, zero-month, and no-settlement views were not observed.
- The personal loader's gating and scoping are covered by code reading only (see F-48).
