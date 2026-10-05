# Feature: Employee revenue & share calculation

**From build-plan:** feature 11
**Build attempt:** 1
**Branch:** feature/employee-revenue-share-calculation
**Status:** verified

## Goal

Calculate, for any employee and salon month, their paid revenue, their
**effective** share percentage, and the resulting earnings. The effective
percentage is the employee's own percentage, set by an ADMIN, when there is one,
and otherwise the global `employeeSharePercentage`. Show those numbers to viewers
who may see employee financials. The calculation is a pure, tested function that
feature 12 (settlements) will reuse.

## In scope

- **Per-employee share %:** a new nullable `User.sharePercentage`
  (`Decimal(5,2)`, 0-100). Null means the employee uses the global setting.
  Example use: an employee who takes their cut in cash at service time and
  invoices only the salon's portion is set to 0%.
- **Admin control:** a "Share percentage" panel on the employee's Account tab.
  Only an ADMIN may see or save it; the server checks this. Saving an empty
  value clears the employee's own percentage. Each change is audited with the old
  and new value and applies to new calculations only.
- **Calculation:** `employeeShare = paidRevenue * effectiveSharePercentage / 100`,
  using exact decimal math (Prisma `Decimal`), never JavaScript floats.
- `paidRevenue` = sum of the employee's **PAID** invoice `amount`s whose
  `createdAt` falls in the selected salon month (Asia/Dubai, via the existing
  `salonDayRange`). UNPAID and CANCELLED invoices are excluded.
- Salon month helpers: parse a `YYYY-MM` URL value, current salon month, previous
  and next month, and the month's `createdAt` bounds.
- **Employee profile Overview tab:** an "Earnings" panel for one salon month
  showing paid revenue, the effective share % and its source (the employee's own
  or the salon default), and earnings, with previous/next month links. Next is
  disabled at the current month. It defaults to the current month.
- **Employees list:** the planned Revenue column (current salon month paid
  revenue), replacing the stale "arrives with feature 8" comment.
- English and Arabic strings, RTL-safe layout, both themes.
- Unit tests for the calculation, effective percentage, input schema, and month
  helpers.

## Out of scope

- Employee expenses, adjustments, and `finalAmount` (feature 12).
- Storing any calculated value, settlements, rounding for storage, freezing the
  percentage (features 12-13).
- Staff seeing their own earnings (feature 15 dashboard; staff has no
  `employees.view`).
- Dashboard tiles, reports, charts, custom date ranges (features 14-19).
- Setting the per-employee % at employee creation or from the Details form.
  It is set only from its own Account-tab panel.
- Any change to how invoices are entered for 0% employees: they keep recording
  the salon's portion only.

## Build loop

`workflow.stepReview` is `feature`: build all steps, run the checks after each,
and present one review packet at the end. `checkpointCommits` is `disabled`; do not
commit between steps. `/complete` creates the feature commit.

## Build steps

- [x] **1. Calculation and month helpers.** Add `lib/earnings.ts` (no `db`
  import, like `lib/employee-expenses.ts`):
  - `effectiveSharePercentage(own, global)` returns `{ value, source: "employee" | "salon" }`.
    `own` null means the salon default; `own` 0 is a real value, not "unset".
  - `calculateEarnings({ paidRevenue, sharePercentage })` takes `Prisma.Decimal`
    (or decimal strings) and returns `{ paidRevenue, sharePercentage,
    employeeShare }` as `Prisma.Decimal`, unrounded.
  - `parseMonth(value, currentMonth)` returns a valid `YYYY-MM` (month 01-12,
    not after `currentMonth`), otherwise `currentMonth`. Invalid input is dropped,
    never an error.
  - `salonMonth(now?, timeZone?)` is built on `salonToday()` from `lib/expenses.ts`.
  - `shiftMonth(month, delta)` works across year boundaries.
  - `salonMonthRange(month, timeZone?)` returns `createdAt` bounds by calling
    `salonDayRange(first day, last day)`.
  - `paidRevenueWhere(month)` returns `{ status: "PAID", createdAt:
    salonMonthRange(month) }` as a `Prisma.InvoiceWhereInput`.

  Add `lib/earnings.test.ts`. **Done when** `pnpm test` passes with the cases
  under Testing and `pnpm exec tsc --noEmit` is clean.

- [x] **2. Per-employee share percentage (schema, action, Admin panel).**
  - `prisma/schema.prisma`: add `sharePercentage Decimal? @db.Decimal(5, 2)` to
    `User` with a doc comment ("null = global setting; ADMIN-set; audited").
    Create the migration with `pnpm exec prisma migrate dev --name
    employee_share_percentage`. It adds one nullable column and needs no backfill.
    Then run `prisma generate` and confirm with `prisma migrate status`.
  - `lib/settings-validation.ts`: export the existing `percentageSchema`.
    Add `employeeShareSchema` in `lib/employees.ts`: an empty or whitespace
    value becomes `null`, otherwise `percentageSchema`.
  - `lib/audit.ts`: add the `user.share_updated` action, with `en`/`ar` labels
    under `audit.actions`.
  - `actions/employees.ts`: add `setEmployeeShare(_prev, formData)`, following
    `setEmployeeActive`. The actor comes from `requireSession()`. Reject with
    `forbidden` unless `actor.role === "ADMIN"`. Validate `userId` and the value,
    returning `invalid_input` with a field error. Return `not_found` for a missing
    target. Inside one interactive `db.$transaction`, read the current value,
    then, only when it differs, update it and call `recordAudit` with
    `oldValue: { sharePercentage: "<n>" | null }` and the matching `newValue`.
    Log unexpected errors and return `unexpected`. Revalidate with
    `revalidateEmployee`.
  - `components/employees/EmployeeShareForm.tsx` (client): one labelled
    decimal input (`inputMode="decimal"`, `maxLength={6}`, `dir="ltr"`) prefilled
    with the stored value or empty. Its hint names the current salon default
    ("Leave empty to use the salon default (50%)"). It reuses the existing
    form patterns (`FormField`/`FormMessage`, `useFocusOnError`,
    `useSuccessToast`). The field error is linked through `aria-describedby`,
    focus moves to the field on error, and the error clears on the next
    successful submit.
  - `app/(app)/employees/[id]/page.tsx`: `canSetShare = viewer.role ===
    "ADMIN"`. Include it in the Account tab's visibility condition and render a
    "Share percentage" `Panel` with the form. Pass the global percentage from
    `getSalonSettings()` for the hint.

  **Done when** an ADMIN can set 0, set 62.5, and clear the value, and each change
  appears in the audit log with its old and new value. Saving an unchanged value
  writes no audit entry. Invalid input (101, -1, abc, 1.234) shows an associated,
  announced error. A SUPERVISOR holding `employees.edit` does not see the panel,
  and a forged call to the action returns `forbidden`. `pnpm test`, `pnpm lint`,
  `tsc`, and `prisma validate` pass.

- [x] **3. Earnings panel on the employee Overview tab.** When the Overview tab
  is active and the viewer holds `reports.view_all_employees`, render a new
  server component, `components/employees/EmployeeEarningsPanel.tsx`, using the
  existing `Panel`/`Detail`.
  - It reads `?month=`, runs one `db.invoice.aggregate({ _sum: { amount } })`
    scoped to `employeeId: target.id` plus `paidRevenueWhere(month)`, and resolves
    the effective % from the target's `sharePercentage` and `getSalonSettings()`.
  - It shows the month heading (localized `Intl.DateTimeFormat` month and year,
    UTC), paid revenue, the share % with a source label ("Employee's own" /
    "Salon default"), and earnings. Amounts use the salon currency with
    `tabular-nums` and `dir="ltr"`.
  - Previous/next links keep the Overview tab (`/employees/<id>?month=YYYY-MM`).
    At the current month, next renders as `aria-disabled` text. Arrow icons flip
    in RTL.
  - A zero-revenue month shows zeros plus a short "No paid invoices this month."
    note.
  - Strings go under `employees.earnings` in `en`/`ar`.

  **Done when** an ADMIN sees correct numbers for a month with PAID, UNPAID, and
  CANCELLED invoices (only PAID counted). A 0% employee shows earnings of 0 with
  source "Employee's own", and a cleared employee shows the global % with source
  "Salon default". Month navigation works, and a tampered `?month=` falls back to
  the current month. A viewer with `employees.view` but without
  `reports.view_all_employees` sees no panel. `pnpm lint` and `tsc` are clean.

- [x] **4. Revenue column on the employees list.** In
  `app/(app)/employees/page.tsx`, when the viewer holds
  `reports.view_all_employees`, add a "Revenue (this month)" column. It is fed by
  one `db.invoice.groupBy({ by: ["employeeId"], where: paidRevenueWhere(current),
  _sum: { amount: true } })`, and employees with no row show the zero amount. Use
  the same currency formatting as step 3. Remove the stale feature 8 comment, and
  add the column string in `en`/`ar`.
  **Done when** the column shows each employee's current-month PAID revenue and
  matches the Earnings panel for the same employee. It is hidden without the
  permission, and the table still scrolls horizontally at phone width.
  `pnpm test`, `pnpm lint`, `tsc`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma`, new `prisma/migrations/<timestamp>_employee_share_percentage/`
- `lib/earnings.ts`, `lib/earnings.test.ts` (new)
- `lib/employees.ts` (+ test), `lib/settings-validation.ts` (export only), `lib/audit.ts`
- `actions/employees.ts`
- `components/employees/EmployeeShareForm.tsx`, `components/employees/EmployeeEarningsPanel.tsx` (new)
- `app/(app)/employees/[id]/page.tsx`, `app/(app)/employees/page.tsx`
- `locales/en.json`, `locales/ar.json`
- Reused: `salonDayRange` and `SALON_TIME_ZONE` (`lib/invoices.ts`), `salonToday`
  (`lib/expenses.ts`), `getSalonSettings` (`lib/settings.ts`), `recordAudit`,
  `Panel`/`Detail`, `getPermissions`, `requireSession`, and the existing
  auth/employee form helpers.

## Data / contracts

- **Schema:** `User.sharePercentage Decimal? @db.Decimal(5,2)`. It defaults to
  null and has no backfill, so every existing employee keeps using the global %.
  Accepted input runs 0 to 100 with up to two decimals, including Arabic-Indic
  digits (same rules as the global setting). An empty value stores null.
- **Effective %:** `user.sharePercentage ?? settings.employeeSharePercentage`,
  read at calculation time. A change to either value affects only calculations
  made afterwards. Freezing the value used is feature 12/13's job.
- **Paid revenue month:** the salon (Asia/Dubai) calendar month of `createdAt`,
  matching how the transactions list filters dates. It uses the invoice's status
  at read time; there is no separate paid date.
- **Rounding:** `calculateEarnings` returns unrounded `Decimal`s, and display
  rounds via `Intl.NumberFormat`. Rounding for storage is feature 12's decision.
- **`month` URL param:** `YYYY-MM`. Anything else, or a future month, means the
  current salon month.
- **Audit:** `user.share_updated`, entity `User`, `entityId` = target id,
  `oldValue`/`newValue` = `{ sharePercentage: string | null }`. The acting user
  comes from the server session.
- **Action result:** the existing `EmployeeFormState<"sharePercentage">` shape,
  with error codes `forbidden | invalid_input | not_found | unexpected`.
- **Authorization:**
  - Setting the per-employee % is ADMIN-role only, checked in the server action
    and mirrored in the UI.
  - The Earnings panel and Revenue column require `reports.view_all_employees`
    on top of the page's existing access (`employees.view`). ADMIN and the
    default SUPERVISOR permissions hold both. STAFF never reaches these pages.
- **Concurrency:** two admins saving at once is last-write-wins. Each save
  audits the value it actually replaced, because it reads inside the same
  transaction.

## Testing

`lib/earnings.test.ts` (Vitest):

- Worked example: paid 5000 at 50% gives a share of 2500.
- 60% gives 3000. Zero revenue gives zero. 0% gives 0. 100% gives the full revenue.
- `effectiveSharePercentage`: null uses the global value with source `salon`.
  0 stays 0 with source `employee`, and 62.5 stays 62.5.
- Decimal precision: 0.10 + 0.20 summed as Decimals equals exactly 0.30, and
  33.33 at 33.33% gives exactly 11.108889.
- `parseMonth`: valid input, month 00 or 13, malformed values, an array or
  undefined, and a future month are each handled as specified.
- `shiftMonth` across December and January.
- `salonMonthRange("2026-10")` gives `gte 2026-09-30T20:00:00.000Z` and
  `lt 2026-10-31T20:00:00.000Z`. February in a leap year ends on the 29th.
- `salonMonth` at an instant just after Dubai midnight on the 1st returns the
  new month.

`lib/employees.test.ts`: `employeeShareSchema` maps empty and whitespace to null.
It accepts 0, 50, 62.5, 100, and Arabic-Indic digits, and rejects 101, -1, abc,
and 1.234.

The server action and pages have no automated harness: no Browser tests
command exists. Verify steps 2-4 manually or with `/check`.

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/` before touching page
  code; `searchParams` is a Promise in this Next.js version (see the existing page).
- Import `Prisma` from `@/generated/prisma/client` for `Prisma.Decimal`. Convert
  to a number only at the final `Intl.NumberFormat` call, as the existing tabs do.
- Aggregates with no matching rows return `_sum.amount === null`; treat that as zero.
- Treat 0% as a real value everywhere. Never use a truthiness check on
  `sharePercentage`.
- The migration needs the local database (`kosh_DATABASE_URL`). If it is
  unreachable, stop and report it instead of hand-writing migration SQL.
- Keep the Overview's existing profile panel unchanged; the Earnings panel sits
  below it.
- Do not add a dependency or a month-picker component; plain previous/next links
  are enough.
- For features 12-13: a settlement must freeze the **effective** % used.

## Open questions

Neither blocks implementation; the defaults above apply unless you choose otherwise.

1. **Who may see earnings and revenue?** Default: `reports.view_all_employees`
   in addition to page access. Alternative: anyone with `employees.view`.
2. **Employees list Revenue period.** Default: the current salon month, which
   matches settlement periods. Alternative: all-time paid revenue.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":14495,"specSha256":"78558b2109715c08c1e47f36689068d3da3cd880d54bbfbcaee578159089e3b8","branch":"refs/heads/feature/employee-revenue-share-calculation","head":"e067b8e17f5dfbd2b6cc9dd7651f1f2935a290e7","baseRef":"refs/heads/main","baseCommit":"cc77a7942493ea05d241ba404a9c7376cb30ab39","sourceTree":"bd7dcbd5ab0e78d0d414648fa5bd24673944521b","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** e067b8e17f5dfbd2b6cc9dd7651f1f2935a290e7
**Base commit:** cc77a7942493ea05d241ba404a9c7376cb30ab39
**Base ref:** main
**Spec hash:** 78558b2109715c08c1e47f36689068d3da3cd880d54bbfbcaee578159089e3b8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T20:55:49Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T20:58:51Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `cc77a7942493ea05d241ba404a9c7376cb30ab39..e067b8e17f5dfbd2b6cc9dd7651f1f2935a290e7` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `pnpm test`: pass (28 files, 486 tests)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm exec prisma validate`: pass
- `pnpm build`: unavailable (not run; `app/layout.tsx` loads `next/font/google`, which needs network access this review was not allowed to use)

### Evidence

- Freshness confirmed before writing: `HEAD` is the target, `git merge-base main HEAD` is the base, the raw SHA-256 of `blueprint/context/current-feature.md` matches the spec hash, and `git status --short` showed only `blueprint/context/review.md` (later also `findings.md`).
- Reviewed all 20 paths in the delta, including `actions/employees.ts` (`setEmployeeShare`), `lib/earnings.ts`, `components/employees/EmployeeEarningsPanel.tsx`, `components/employees/EmployeeShareForm.tsx`, both employee pages, the schema and migration, `lib/employees.ts`, `lib/settings-validation.ts`, `lib/audit.ts`, both locales, and the three test files, plus the callers and helpers they rely on (`salonDayRange`, `salonToday`, `revalidateEmployee`, `readForm`, `FormField`, `useFocusOnError`, `getSalonSettings`, the `Invoice` model and indexes).
- Security: `setEmployeeShare` takes the actor from `requireSession()` and rejects anyone who is not an ADMIN before any read or write; the page mirrors that rule. The Earnings panel and Revenue column render only with `reports.view_all_employees`, and the panel only on the Overview tab, which needs `employees.view`. `?month=` is validated by `parseMonth` before use. No raw SQL or new client-controlled ownership.
- Correctness: paid revenue uses `status: "PAID"` and the Dubai month bounds from `salonDayRange`; the math stays in `Prisma.Decimal`; `sharePercentage` is never truthiness-checked (0% is honored); `_sum.amount` null is treated as zero. The audit `oldValue` is read inside the transaction, and the write is a compare-and-set on that value.
- Performance: one aggregate per panel render and one `groupBy` per list render, both covered by the existing `Invoice` indexes on `createdAt` and `(employeeId, createdAt)`.
- Tests: `lib/earnings.test.ts` covers every case in the spec's Testing section; `lib/employees.test.ts` covers the schema; `actions/employees.test.ts` covers forbidden roles, set, change, clear, no-op, invalid input, not found, and the racing save. No skipped or focused tests in the delta.

### Findings

- F-40 [P3] open (new): a racing share save fails as "unexpected" instead of the spec's last-write-wins.
- F-28 [P3] open (re-examined): the new `setEmployeeShare` tests reuse the mock that passes `db` as `tx`.
- F-30 [P3] open (re-examined): one more pending label (`employees.share.submitting`) ends with U+2026.
- F-33 [P3] open (re-examined): the share input reaches the shared `FormField` icon and padding direction mismatch.
- No P0 or P1 finding is open or fixed.

### Remaining risk

- `pnpm build` was unavailable (needs network for `next/font/google`), so the production build of this delta was not confirmed in this review.
- Check was not required and was not run: the Earnings panel, Revenue column, Account-tab share form, RTL layout, and both themes were reviewed from code only, not in a browser.
- The migration was not applied or checked against a database (`prisma migrate status` not run by rule); only `prisma validate` ran.
- The concurrency behavior in F-40 is derived from the code; no overlapping saves were run against a real database.
