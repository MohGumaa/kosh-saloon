# Feature: Monthly employee settlements

**From build-plan:** feature 12
**Build attempt:** 1
**Branch:** feature/monthly-employee-settlements
**Status:** verified

## Goal

Let authorized users generate one settlement per employee per completed salon
month. Each settlement stores the employee's paid revenue, effective share
percentage, earnings, employee expenses, adjustments, and final payout. It then
moves through `DRAFT -> CALCULATED -> APPROVED -> PAID`, with each move checked
and audited on the server. Staff see only their own settlements.

## In scope

- **`EmployeeSettlement` model** with the overview's shape: `employeeId`,
  `periodStart`/`periodEnd` (`@db.Date`), `totalRevenue`, `sharePercentage`,
  `employeeShare`, `totalExpenses`, `totalAdjustments`, `finalAmount`, `status`
  (`SettlementStatus`: DRAFT | CALCULATED | APPROVED | PAID), `approvedById`,
  `approvedAt`, `paidAt`, plus `createdById`, `createdAt`, `updatedAt`. There is
  one settlement per employee per month: `@@unique([employeeId, periodStart])`.
- **Calculation** (pure, tested): `totalRevenue` is the sum of the employee's PAID
  invoices whose `createdAt` falls in the salon month (`paidRevenueWhere`). The
  share uses `effectiveSharePercentage` and `calculateEarnings` from feature 11.
  `totalExpenses` is the sum of the employee's `EmployeeExpense.amount` with
  `date` in the month. `totalAdjustments` is 0 (feature 13 adds adjustments).
  `finalAmount = employeeShare - totalExpenses + totalAdjustments`, and it can be
  negative.
- **Generate** (`settlements.create`): for one completed month, creates a DRAFT
  for every user who has at least one PAID invoice or one employee expense in that
  month and does not already have a settlement for it. Existing settlements are
  left untouched. Only months before the current salon month can be generated.
- **Recalculate** (`settlements.create`): works on DRAFT or CALCULATED. It
  replaces the stored values with fresh ones, including the current effective
  percentage, and sets the status to DRAFT.
- **Mark calculated** (`settlements.create`): DRAFT -> CALCULATED. This freezes
  the values for review.
- **Approve** (`settlements.approve`): CALCULATED -> APPROVED. Sets
  `approvedById` to the acting user and `approvedAt`.
- **Mark paid** (`settlements.mark_paid`): APPROVED -> PAID. Sets `paidAt`. A PAID
  settlement has no further actions.
- **Pages:**
  - `/settlements?month=YYYY-MM` lists one month's settlements. It defaults to the
    previous salon month, has previous/next month links, and shows the totals
    columns and a status badge. A Generate button appears for viewers holding
    `settlements.create`.
  - `/settlements/[id]` shows the detail: all values, the share-% note, the
    status, approved by/at, paid at, and the actions this viewer may take now.
  - The existing Reports › Settlements sidebar item is linked to `/settlements`.
- **Scope:** STAFF (`isOwnScope`) see only their own settlements. Another
  employee's settlement returns `notFound()`, as invoices do. STAFF can never run
  a settlement action, whatever permissions they hold (like
  `canManageInvoices`).
- Audit actions `settlement.generated`, `settlement.recalculated`,
  `settlement.calculated`, `settlement.approved`, `settlement.paid` on entity
  `EmployeeSettlement`, with `en`/`ar` labels.
- English and Arabic strings, RTL-safe layout, both themes. Status badges use the
  existing `st-*` color tokens.

## Out of scope

- `SettlementAdjustment`: creating adjustments, applying them, and any nonzero
  `totalAdjustments` (feature 13).
- Extra paid-settlement protection beyond "no actions after PAID", and any
  correction workflow (feature 13).
- Settlements for the current, unfinished month. The existing Earnings panel
  already shows month-to-date numbers.
- Dashboards, reports, charts, CSV/printing (features 14-19).
- Settlement emails or notifications (future).
- Deleting settlements, moving APPROVED back, or un-paying.
- Carrying a negative final amount into the next month automatically.

## Build loop

`workflow.stepReview` is `feature`: build all steps, run the checks after each,
and present one review packet at the end. `checkpointCommits` is `disabled`; do not
commit between steps. `/complete` creates the feature commit.

## Build steps

- [x] **1. Schema and migration.** In `prisma/schema.prisma`, add the
  `SettlementStatus` enum and the `EmployeeSettlement` model. Use money as
  `Decimal @db.Decimal(12, 2)` and `sharePercentage Decimal @db.Decimal(5, 2)`.
  Relations: `employee` (`"SettlementEmployee"`), `approvedBy?`
  (`"SettlementApprover"`), and `createdBy` (`"SettlementCreator"`), all
  `onDelete: Restrict`. Add the back-relations on `User`, the
  `@@unique([employeeId, periodStart])`, and `@@index([periodStart])`. Add a doc
  comment covering the flow and that DRAFT/CALCULATED values are replaced by a
  recalculation. Run `pnpm exec prisma migrate dev --name employee_settlements`,
  then `prisma generate`, then `prisma migrate status`.
  **Done when** the migration applies, `prisma validate` passes, and `tsc` is
  clean.

- [x] **2. Pure settlement logic.** Add `lib/settlements.ts` with no `db` import:
  - `SETTLEMENT_STATUSES`, `settlementIdSchema` (reuse the existing id schema).
  - `calculateSettlement({ paidRevenue, sharePercentage, expenses, adjustments })`
    returns the six stored values as `Prisma.Decimal`. It rounds `employeeShare`
    to 2 decimals half-up (see Open questions); the other values are already
    2-decimal sums, so `finalAmount` is exact.
  - `monthPeriod(month)` returns `{ periodStart, periodEnd }` as `@db.Date`
    values, via `dateValue`. `expensesWhere(month)` covers the month's `date`
    range. `isSettleableMonth(month, currentMonth)` is true only when
    `month < currentMonth`.
  - `parseSettlementMonth(value, currentMonth)` returns a valid month before
    `currentMonth`, and otherwise `shiftMonth(currentMonth, -1)`.
  - `SETTLEMENT_TRANSITIONS`: for each action, the allowed from-status, the
    to-status, and the required permission. Add
    `canRunSettlementAction(action, status, permissions, role)` for both the page
    and the server.

  Add `lib/settlements.test.ts`. **Done when** `pnpm test` passes the Testing
  cases and `tsc` is clean.

- [x] **3. Server actions.** Add `actions/settlements.ts`, following
  `actions/employee-expenses.ts`. The actor always comes from `requireSession()`.
  Errors are `forbidden | not_found | invalid_input | invalid_state | unexpected`.
  - `generateSettlements(_prev, formData)`: reject when the actor is in own scope
    or lacks `settlements.create`. Reject an invalid or not-yet-settleable month
    with `invalid_input`. In one interactive `db.$transaction`:
    1. Find the users with PAID revenue or expenses in the month (`groupBy` on
       invoices and on employee expenses) and drop those who already have a
       settlement.
    2. Read `getSalonSettings()` and each user's `sharePercentage`.
    3. Create each DRAFT and call `recordAudit(settlement.generated)` with the
       stored values as strings.

    A unique-constraint race returns `invalid_state`. Return the created count;
    0 is a success with a "nothing to generate" message.
  - `recalculateSettlement`, `markSettlementCalculated`, `approveSettlement`, and
    `markSettlementPaid` take an `id`. Each checks the permission and own scope
    first. In a transaction, it reads the settlement (`not_found`), checks the
    transition (`invalid_state`), and writes with
    `updateMany({ where: { id, status: from } })`. A count of 0 means
    `invalid_state`, so a double-click or a concurrent move cannot apply twice.
    It then records the audit entry with old and new status, and for a
    recalculation the old and new values. Approve sets `approvedById: actor.id`
    and `approvedAt`; recalculating clears neither field, because only CALCULATED
    can be approved.
  - Each action revalidates `/settlements` and `/settlements/<id>`.
  - Add the audit actions and the `EmployeeSettlement` entity to `lib/audit.ts`,
    with labels under `audit.actions`/`audit.entities`.

  Add `actions/settlements.test.ts`, mocking `db` like the existing action tests.
  **Done when** the tests cover forbidden (no permission, STAFF with the
  permission), invalid month, the current month rejected, wrong-state
  transitions, a stale `updateMany` count of 0, and the happy path for each
  action with its audit call. `pnpm test`, `pnpm lint`, and `tsc` pass.

- [x] **4. List page and navigation.** Add `app/(app)/settlements/page.tsx`
  (`requirePermission("settlements.view")`):
  - It reads `?month=` through `parseSettlementMonth` and shows the month heading
    (localized month and year, UTC) with previous/next links. Next is
    `aria-disabled` at the latest settleable month. Arrows flip in RTL.
  - Table columns: employee, revenue, share %, earnings, expenses, adjustments,
    final, status. Rows are ordered by employee name, and STAFF get only their own
    rows. Amounts use the salon currency with `tabular-nums` and `dir="ltr"`, and
    a negative final amount is shown in the destructive color. The employee name
    links to the detail page, and the table scrolls horizontally like the invoice
    list.
  - `components/settlements/SettlementStatusBadge.tsx` uses the `st-*` tokens.
  - `components/settlements/GenerateSettlementsForm.tsx` (client) is rendered
    only for a non-STAFF viewer holding `settlements.create`. It has a hidden
    month field and a pending state. It shows errors through `FormMessage` +
    `useFocusOnError` and success through `useSuccessToast`, with the created
    count or "Nothing to generate".
  - Empty state: "No settlements for this month", followed by a generate hint
    for creators or a plain note for viewers.
  - In `lib/navigation.ts`, set `href: "/settlements"` on the `settlements`
    item (no icon: Reports items render as icon-less sub-items). Add a test in `lib/navigation.test.ts`.
  - Strings go under `settlements` in `en`/`ar`.

  **Done when** an ADMIN can generate last month's settlements. Only users with
  PAID invoices or employee expenses that month get one, and the numbers match the
  worked example (5,000 at 50% with 300 of expenses gives 2,500 and 2,200).
  Generating again creates nothing. A tampered `?month=` (the current month,
  future, `abc`) falls back to the previous month. A default STAFF user sees only
  their own row and no Generate button. `pnpm lint`, `tsc`, and `pnpm test` pass.

- [x] **5. Detail page and status actions.** Add
  `app/(app)/settlements/[id]/page.tsx` (`requirePermission("settlements.view")`):
  - A missing settlement, or another employee's settlement for STAFF, returns
    `notFound()`. The metadata title is generic, as for invoices.
  - A `Panel`/`Detail` layout shows the employee, the period, every stored value,
    the share % (stored, labelled "used for this settlement"), the status badge,
    approved by/at, and paid at (`LocalDateTime`). It has a back link to
    `/settlements?month=<period>`.
  - `components/settlements/SettlementActionsForm.tsx` (client) shows only the
    actions `canRunSettlementAction` allows for this viewer and status.
    Recalculate, Mark calculated, Approve, and Mark paid each post their own
    hidden-`id` form. Mark paid has a confirm step, following the invoice cancel
    confirm pattern, with focus returned on "Keep". A PAID settlement shows a
    "Paid settlements are locked." note. Errors and toasts follow
    `InvoiceStatusForm`.

  **Done when** an ADMIN walks one settlement through DRAFT -> CALCULATED ->
  APPROVED -> PAID. Each step appears in the audit log, and approved by/at and
  paid at display correctly. Recalculating a CALCULATED settlement after
  marking another invoice PAID returns it to DRAFT with updated numbers.
  A default SUPERVISOR can generate, recalculate, and mark calculated, but sees
  no Approve or Mark paid. Forged action posts return `forbidden`. A stale
  second submit shows the `invalid_state` error. STAFF opening another user's
  settlement get the not-found page. `pnpm test`, `pnpm lint`, `tsc`, and
  `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_employee_settlements/`
- `lib/settlements.ts`, `lib/settlements.test.ts` (new)
- `actions/settlements.ts`, `actions/settlements.test.ts` (new)
- `lib/audit.ts`, `lib/audit.test.ts` (if it enumerates actions or entities)
- `lib/navigation.ts`, `lib/navigation.test.ts`
- `app/(app)/settlements/page.tsx`, `app/(app)/settlements/[id]/page.tsx` (new)
- `components/settlements/SettlementStatusBadge.tsx`,
  `GenerateSettlementsForm.tsx`, `SettlementActionsForm.tsx` (new)
- `locales/en.json`, `locales/ar.json`
- Reused: `lib/earnings.ts`, `lib/expenses.ts` (`dateValue`, `dayOf`,
  `salonToday`), `lib/invoices.ts` (`isOwnScope`), `lib/settings.ts`,
  `lib/auth/authorize.ts`, `components/layout/Panel.tsx`, `LocalDateTime`,
  the shared form hooks

## Data / contracts

- **Period:** a salon month `YYYY-MM`. `periodStart` is the first day and
  `periodEnd` the last day (`@db.Date`, UTC midnight via `dateValue`). Revenue
  uses invoice `createdAt` in the Asia/Dubai month (`salonMonthRange`). Expenses
  use `EmployeeExpense.date` between `periodStart` and `periodEnd` inclusive.
- **Uniqueness:** `(employeeId, periodStart)`. Generating is idempotent.
- **Stored values:** Decimal(12,2) money and Decimal(5,2) `sharePercentage`. They
  are written only by Generate and Recalculate, and Recalculate works only from
  DRAFT or CALCULATED.
- **Transitions:**

  | Action | From | To | Permission |
  | --- | --- | --- | --- |
  | Recalculate | DRAFT, CALCULATED | DRAFT | `settlements.create` |
  | Mark calculated | DRAFT | CALCULATED | `settlements.create` |
  | Approve | CALCULATED | APPROVED | `settlements.approve` |
  | Mark paid | APPROVED | PAID | `settlements.mark_paid` |

  Own-scope (STAFF) users can never act. Every write is conditioned on the
  expected from-status.
- **Action result:** `{ success: true; created?: number } | { success: false;
  error: "forbidden" | "not_found" | "invalid_input" | "invalid_state" |
  "unexpected" } | null`. Error text lives under `settlements.errors`.
- **Audit values:** decimals are stored as strings, as in existing entries, and
  include `employeeId` and `month`.

## Testing

`lib/settlements.test.ts`:
- Worked example: 5000 at 50% with 300 of expenses gives a share of 2500.00 and
  a final amount of 2200.00.
- 0% gives a final amount of minus the expenses (negative). Expenses larger than
  the share give a negative result.
- Rounding: 333.33 at 62.5% gives 208.33 (208.33125); 0.01 at 50% gives 0.01
  (half-up from 0.005).
- No float drift: 0.1 + 0.2 style revenue sums stay exact.
- `monthPeriod` for February in leap and non-leap years and for December.
  `isSettleableMonth` is false for the current and future months.
  `parseSettlementMonth` falls back on a tampered value.
- The transition table: every allowed and denied (action, status) pair. A
  permission is missing. STAFF with every permission is denied.

`actions/settlements.test.ts`: as listed in step 3.

Not claimed: live, browser, or visual evidence. `/check` covers that.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for any App Router API you use
  (`PageProps`, `notFound`, `revalidatePath`) before writing pages.
- Decimal math only (`Prisma.Decimal`); never `toNumber()` except for display
  formatting.
- The stored `sharePercentage` is what the detail page shows. Never recompute it
  from current settings on display.
- `/reports/settlements` stays for feature 19. This feature owns `/settlements`;
  feature 19 may add report views and decide the sidebar link then.
- Eligibility rule (chosen, reversible): a user gets a settlement only when they
  have PAID revenue or employee expenses in the month. Inactive users are
  included, because they may still be owed money.
- Self-approval is not restricted. Nothing in the plans asks for it.

## Decisions

Approved at spec review (2026-10-06), as proposed:

1. **Rounding:** the share is rounded to 2 decimals half-up when stored. The
   alternative is to store more decimals and round only on display.
2. **Negative final amount:** stored and shown as negative, meaning the employee
   owes the salon. It is not carried into the next month automatically. Feature
   13 adjustments can correct it.
3. **Completed months only:** settlements cannot be generated for the current
   salon month, so invoices created later in the month are never left out of a
   settlement.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16662,"specSha256":"211d707ced5b4408bc7304756329f58c2b0b74ba6c11b604fd42a31353a9ce86","branch":"refs/heads/feature/monthly-employee-settlements","head":"02ccca92ca7608ba210f57dbabb384619f237c59","baseRef":"refs/heads/main","baseCommit":"5fcbfe44db386680548d4c8b931afe85ee99c2af","sourceTree":"97f5b4f4c410a45a65be652faee01b28e5498786","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 02ccca92ca7608ba210f57dbabb384619f237c59
**Base commit:** 5fcbfe44db386680548d4c8b931afe85ee99c2af
**Base ref:** main
**Spec hash:** 211d707ced5b4408bc7304756329f58c2b0b74ba6c11b604fd42a31353a9ce86
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T21:34:55Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T22:47:30Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (30 files, 523 tests)
- `pnpm exec prisma validate`: pass
- `pnpm build`: unavailable (not run by this reviewer)
- `pnpm exec prisma migrate status`: unavailable (needs the hosted database; not run)

### Evidence

- Freshness confirmed before review: `HEAD` is `02ccca9`, `git merge-base main HEAD` is `5fcbfe4`, the raw SHA-256 of the tracked `blueprint/context/current-feature.md` matches the spec hash, and the only dirty path was `blueprint/context/review.md`.
- Reviewed the whole `5fcbfe4..02ccca9` delta (17 files): schema and migration, `lib/settlements.ts`, `actions/settlements.ts`, both settlement pages, the three settlement components, `lib/audit.ts`, `lib/navigation.ts`, both locale files, and the two new test files, plus the callers and helpers they rely on (`lib/earnings.ts`, `lib/settings.ts`, `lib/db.ts`, `lib/employee-expenses.ts`, the `Invoice` and `EmployeeExpense` models).
- Security: every action takes the actor from `requireSession()`, checks the permission and rejects own scope before any read, validates `id` and `month` on the server, and writes only through status-conditioned `updateMany` inside a transaction. The list page scopes STAFF to `employeeId: user.id`, and the detail page returns `notFound()` for another employee's settlement with a generic title.
- Correctness: calculation uses `Prisma.Decimal` with half-up rounding of the share only; `isSettleableMonth` rejects the current and later months; locale key sets in `en` and `ar` are identical; the migration matches the schema (unique `(employeeId, periodStart)`, index on `periodStart`, three `RESTRICT` foreign keys).
- Tests: the spec's listed cases are present in `lib/settlements.test.ts` and `actions/settlements.test.ts`, with a separate transaction mock so writes on `db` instead of `tx` fail. No skipped or focused tests in the delta.

### Findings

- F-41 [P2] unverified - Generate runs about 4 sequential queries per employee inside one interactive transaction with the default 5-second timeout (`actions/settlements.ts:119`)
- F-42 [P3] open - Approve and Mark calculated check only the status, so an approver can approve values that changed after the page loaded (`actions/settlements.ts:205`)
- No P0 or P1 finding.

### Remaining risk

- `pnpm build` was not run by this reviewer, so the production build of the new routes is not proven here.
- `pnpm exec prisma migrate status` was not run (needs the hosted database), so migration sync with the real database is not proven here.
- No browser, live database, or concurrency evidence: RTL layout, themes, toasts, the pay confirm focus flow, and the generate race were reviewed from code only. Check was not required.
- F-41 depends on the real employee count and database latency, which were not measured.
