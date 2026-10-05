# Feature: Historical settlement protection

**From build-plan:** feature 13
**Build attempt:** 1
**Branch:** feature/historical-settlement-protection
**Status:** verified

## Goal

Once a settlement is PAID, nothing can change it. A paid amount that turns out to
be wrong is corrected with a signed, audited `SettlementAdjustment` recorded against
the paid settlement. The employee's next settlement picks it up in
`totalAdjustments`. Feature 12 already stores the share % and every value it used.
This feature proves those values stay fixed when the global or per-employee share %
changes, and makes `totalAdjustments` real.

## In scope

- **Frozen values (already stored by feature 12, now proven).** Generate and
  Recalculate are the only code that writes settlement values, and Recalculate
  works only on DRAFT or CALCULATED. Add regression tests showing that:
  - after APPROVED, no action rewrites `sharePercentage` or any money value; and
  - pages show the stored `sharePercentage`, never the current setting.

  No schema change is needed for this part.
- **Paid lock.** A PAID settlement accepts no status action and no value write,
  which the existing status-conditioned `updateMany` already enforces. The only
  new thing that can point at a PAID settlement is an adjustment, and creating
  one never changes the paid settlement's row.
- **`SettlementAdjustment` model** with the overview's shape: `employeeId`,
  signed `amount`, `reason`, `sourceSettlementId` (the PAID settlement being
  corrected), `appliedSettlementId?`, `createdById`, `createdAt`, and no
  `updatedAt`. Adjustments are immutable: they cannot be edited or deleted. A
  mistake is reversed by adding an opposite adjustment.
- **Create adjustment** (`settlements.mark_paid`, see Open questions; Staff can
  never create one). The form takes a signed amount and a reason, and only works
  on a PAID source settlement. `employeeId` comes from the source settlement,
  never from the form. The new adjustment starts pending (`appliedSettlementId`
  null). It is audited as `settlement.adjustment_created` on entity
  `SettlementAdjustment`.
- **Apply on the next settlement.** Generate and Recalculate claim the
  employee's pending adjustments whose source `periodStart` is before the target
  settlement's `periodStart` by setting `appliedSettlementId`. They then set
  `totalAdjustments` to the sum of every adjustment applied to that settlement,
  and `finalAmount = employeeShare - totalExpenses + totalAdjustments`. A claimed
  adjustment stays attached to that settlement for good. Generate also creates a
  DRAFT for a user who has pending adjustments but no revenue or expenses that
  month, so a correction is never stranded.
- **Detail page:**
  - **PAID settlement:** a "Corrections" panel lists its adjustments (amount,
    reason, created by/at, and "Pending" or "Applied to <month>" linked to that
    settlement). Viewers allowed to adjust also get the add form.
  - **Any settlement:** an "Included adjustments" list shows the adjustments
    applied to it, each linking to its source month.
  - **DRAFT or CALCULATED settlement:** when the employee has pending adjustments
    from earlier months that are not yet included, a note says so. For DRAFT, it
    says to recalculate. For CALCULATED, it says to recalculate, or that they will
    move to the next month.
- English and Arabic strings, RTL-safe layout, both themes.

## Out of scope

- Blocking invoice or employee-expense edits after a month is paid. Paid
  settlements keep their stored numbers. Later source-data changes are corrected
  with adjustments, as the plan says.
- Adjustments on DRAFT, CALCULATED, or APPROVED settlements. Those are corrected
  by recalculation, or before approval.
- Editing or deleting adjustments, un-paying, and moving settlements backwards.
- Automatic carry-over of a negative final amount (feature 12 decision 2 stands;
  an adjustment can do it manually).
- Settlement reports, dashboards, CSV (features 14-19), and F-41/F-42 from
  feature 12's review.
- A new permission key, unless the review picks that option.

## Build loop

`workflow.stepReview` is `feature`: build all steps, run the checks after each,
and present one review packet at the end. `checkpointCommits` is `disabled`; do
not commit between steps. `/complete` creates the feature commit.

## Build steps

- [x] **1. Schema and migration.** In `prisma/schema.prisma`, add
  `SettlementAdjustment`:
  - `id` (cuid), `employeeId` (`"AdjustmentEmployee"`),
    `amount Decimal @db.Decimal(12, 2)`, `reason String`, `sourceSettlementId`
    (`"AdjustmentSource"`), `appliedSettlementId String?` (`"AdjustmentApplied"`),
    `createdById` (`"AdjustmentCreator"`), and `createdAt @default(now())`.
  - All relations use `onDelete: Restrict`.
  - Indexes `@@index([employeeId, appliedSettlementId])`,
    `@@index([sourceSettlementId])`, and `@@index([appliedSettlementId])`.
  - Back-relations on `User` and `EmployeeSettlement`.
  - A doc comment: immutable, signed, applied to the next settlement.

  Run `pnpm exec prisma migrate dev --name settlement_adjustments`, then
  `prisma generate`, then `prisma migrate status`.
  **Done when** the migration applies, `prisma validate` passes, and `tsc` is
  clean.

- [x] **2. Pure adjustment logic.** In `lib/settlements.ts` (still no `db`
  import), add:
  - `adjustmentAmountSchema`: a signed string. It normalizes digits like
    `priceSchema` and accepts a leading `-` or the Unicode minus `−`. The value
    must match `^-?\d{1,8}(\.\d{1,2})?$` and be nonzero.
  - `adjustmentSchema`: `{ id, amount, reason }`. The reason is required,
    trimmed, 1-500 characters, and uses the same plain-text character rule as
    `descriptionSchema`, without its empty-to-null step.
  - `canAdjustSettlement(status, permissions, user)`: true only for PAID, a
    non-Staff user, and `settlements.mark_paid`.
  - `sumAdjustments(amounts)`: an exact `Prisma.Decimal` sum.

  Extend `lib/settlements.test.ts`. **Done when** `pnpm test` passes the Testing
  cases for this step and `tsc` is clean.

- [x] **3. Server actions.** In `actions/settlements.ts`:
  - **`createSettlementAdjustment(_prev, formData)`.**
    1. The actor comes from `requireSession()`. Reject own scope or a missing
       `settlements.mark_paid` with `forbidden`. Reject an invalid parse with
       `invalid_input` (with field errors for amount and reason).
    2. In one transaction, read the source (`not_found`). If it is not PAID,
       return `invalid_state`.
    3. Create the adjustment with `employeeId` taken from the source and
       `createdById: actor.id`.
    4. Call `recordAudit` with `newValue` `{ employeeId, sourceSettlementId,
       month, amount, reason }`.
    5. Revalidate the source's detail page and `/settlements`.
  - **`applyAdjustments(tx, settlement)` helper,** used by Generate (after each
    create) and by Recalculate:
    1. `updateMany` the pending rows (`employeeId`, `appliedSettlementId: null`,
       source `periodStart` before the target's) to this settlement.
    2. Sum all rows applied to it.
    3. Recompute the values with that sum.

    Generate creates the row first, then applies the adjustments and updates the
    values, all in the same transaction. The audit `newValue` records the final
    values plus `appliedAdjustmentIds`. Recalculate's audit includes the old and
    new `totalAdjustments`.
  - **Generate eligibility:** add the employees with pending adjustments from
    earlier periods to `active`.
  - Remove the hard-coded `adjustments: 0`. `freshValues` takes the adjustments
    sum.
  - In `lib/audit.ts`, add the action `settlement.adjustment_created` and the
    entity `SettlementAdjustment`, with `en`/`ar` labels.

  Extend `actions/settlements.test.ts`. **Done when** the tests cover:
  - forbidden: no permission, and Staff holding every permission;
  - invalid amount or reason;
  - an adjustment on a non-PAID source (`invalid_state`) and a missing source;
  - a forged `employeeId` field being ignored;
  - the happy path with its audit call;
  - Generate claiming pending adjustments, including for an employee with no
    activity;
  - Generate not claiming an adjustment whose source is in the same or a later
    month;
  - Recalculate claiming a newly pending adjustment and keeping the ones it
    already has;
  - every write going through `tx`.

  `pnpm test`, `pnpm lint`, and `tsc` pass.

- [x] **4. Detail page UI.** In `app/(app)/settlements/[id]/page.tsx`, load:
  - adjustments where `sourceSettlementId = id`, with each target's
    `id`/`periodStart`;
  - adjustments where `appliedSettlementId = id`, with each source's
    `id`/`periodStart`;
  - for DRAFT and CALCULATED, a count of the employee's pending adjustments from
    earlier periods.

  Staff scope already applies, because these belong to the same employee.
  - Add `components/settlements/SettlementAdjustmentForm.tsx` (client). It has a
    signed amount input (`inputMode="decimal"`, `dir="ltr"`), a reason
    `textarea`, and a hidden `id`. It uses labelled fields with
    `aria-describedby` errors, `FormMessage` + `useFocusOnError`, and
    `useSuccessToast`. The form resets on success and has a pending state. It is
    rendered only when `canAdjustSettlement` allows it.
  - Add `components/settlements/AdjustmentList.tsx` (server). It shows signed
    amounts in the currency with `tabular-nums`/`dir="ltr"`: negatives in the
    destructive color, positives with a `+`. The reason is plain text with
    `dir="auto"` and `whitespace-pre-line`, never HTML. It also shows created
    by/at (`LocalDateTime`) and the pending/applied badge or link. The empty
    state reads "No corrections yet".
  - Replace the PAID note with "Paid settlements are locked. Corrections are
    applied to the next settlement." Show the pending-adjustments note on
    DRAFT/CALCULATED.
  - Strings go under `settlements.adjustments` in `en`/`ar`.

  **Done when** an ADMIN adds `-150` with a reason to a PAID September
  settlement:
  - the September values stay the same, and its Corrections list shows the row
    as Pending;
  - generating October gives `totalAdjustments = -150.00`, and the final amount
    is 150 less;
  - September's row then shows "Applied to October" as a link.

  After the global share % changes from 50 to 60, September still shows 50% and
  the same numbers. A default SUPERVISOR sees the list but no form, and a forged
  post returns `forbidden`. STAFF see the corrections on their own settlements
  only. `pnpm test`, `pnpm lint`, `tsc`, and `pnpm build` pass.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_settlement_adjustments/`
- `lib/settlements.ts`, `lib/settlements.test.ts`
- `actions/settlements.ts`, `actions/settlements.test.ts`
- `lib/audit.ts` (+ `lib/audit.test.ts` if it enumerates actions/entities)
- `app/(app)/settlements/[id]/page.tsx`
- `components/settlements/SettlementAdjustmentForm.tsx`, `AdjustmentList.tsx` (new)
- `locales/en.json`, `locales/ar.json`
- Reused: `priceSchema` digit normalization (`lib/services.ts`), the
  `descriptionSchema` text rule (`lib/expenses.ts`), `Panel`/`Detail`,
  `LocalDateTime`, `FormMessage`, `useFocusOnError`, `useSuccessToast`

## Data / contracts

- **SettlementAdjustment:** `amount` is Decimal(12,2), signed (`+` adds to the
  payout, `-` deducts), nonzero, and at most 99,999,999.99 in absolute value.
  `reason` is 1-500 characters of plain text. Rows are immutable, with no
  update or delete path.
- **Source:** must be PAID when the adjustment is created. `employeeId` always
  equals `source.employeeId`.
- **Application:** an adjustment is pending while `appliedSettlementId` is null.
  It is applied to a settlement S of the same employee when Generate or
  Recalculate runs on S and `source.periodStart < S.periodStart`. The claim is
  `updateMany ... where appliedSettlementId: null`, so it can never land on two
  settlements. Once claimed, it is never released.
  `S.totalAdjustments = Σ amount where appliedSettlementId = S.id`.
- **Action result:** the existing `SettlementFormState`, extended with
  `fieldErrors?: { amount?, reason? }` on `invalid_input`. As built, the codes
  are `"required" | "invalid_input"`, shown through the existing `auth.errors`
  keys that `FormField` already uses, rather than a new
  `settlements.adjustments.errors` group. The amount format is explained by the
  field hint.
- **Stale recalculation (as built):** a status-conditioned write with a count of
  0 throws inside the transaction, so it rolls back any adjustments the
  recalculation claimed. The result is still `invalid_state`.
- **Audit:** `settlement.adjustment_created` on `SettlementAdjustment` stores
  decimals as 2-decimal strings. Generate and recalculate audits include
  `totalAdjustments` (already part of `auditValues`) and the applied adjustment
  ids.

## Testing

`lib/settlements.test.ts`:
- `adjustmentAmountSchema` accepts `150`, `-150`, `−75.5`, Arabic-Indic digits,
  and `0.01`. It rejects `0`, `-0`, `0.00`, `1.234`, `+5`, `abc`, an empty
  value, and 9 integer digits.
- The reason is required, is trimmed, has a 500 limit, and rejects control
  characters.
- `canAdjustSettlement` is true only for PAID with `mark_paid` and a non-Staff
  user.
- `calculateSettlement` with adjustments `-150` gives a final amount of
  2,050.00 from the worked example (2,500 − 300 − 150). Positive adjustments add
  to the payout.

`actions/settlements.test.ts`: as listed in step 3. Existing cases keep passing.
Their mocks gain the adjustment table.

Not claimed: live database, browser, or visual evidence. `/check` covers that.
No Verify command exists. The baseline `pnpm test` gives 30 files and 523 tests
passing.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for any App Router API you touch.
- Decimal math only. Never `toNumber()` except for display.
- Keep every write on the transaction client, as feature 12 does. Generate gets
  slightly heavier per employee (F-41). Batch the pending-adjustment lookup into
  one query per generate, and keep the per-employee claim to one `updateMany`
  and one `aggregate`.
- Join the source's `periodStart` through the relation in the `updateMany`
  filter (`sourceSettlement: { periodStart: { lt } }`).
- Never recompute `sharePercentage` from settings on any settlement page.

## Decisions

Approved at spec review (2026-10-06), as proposed:

1. **Who can add an adjustment:** `settlements.mark_paid` (admins by default;
   supervisors only when granted explicitly), because it changes what gets paid.
   The alternatives are `settlements.approve` or a new `settlements.adjust` key.
   A new key adds permission-catalog work.
2. **Which settlement it lands on:** the next settlement for that employee that
   is generated or recalculated, with a later period than the source. This means
   an adjustment made while October is already APPROVED or PAID goes to November.
   The alternative is to pin it strictly to source month + 1, which fails once
   that month is paid.
3. **Immutable adjustments:** no edit or delete; a mistake is reversed with an
   opposite adjustment. This matches the overview's no-`updatedAt` shape.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":15270,"specSha256":"86ac86b0e5f99be054c97a7154dbf6b9644dd76d5e6e0a743c68930fd0356cfe","branch":"refs/heads/feature/historical-settlement-protection","head":"bbffcae014744da27ad515234fb2d4d84425f693","baseRef":"refs/heads/main","baseCommit":"81c3da5d3b1a4867287a013516ee34df335909ef","sourceTree":"75d3c5327d48f721a18afacb9efee1581632b34d","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** bbffcae014744da27ad515234fb2d4d84425f693
**Base commit:** 81c3da5d3b1a4867287a013516ee34df335909ef
**Base ref:** main
**Spec hash:** 86ac86b0e5f99be054c97a7154dbf6b9644dd76d5e6e0a743c68930fd0356cfe
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T23:46:05Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T23:50:30Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `git status --porcelain`, `sha256sum blueprint/context/current-feature.md`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed before review; the tree stayed clean after the build)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (30 files, 549 tests)
- `pnpm exec prisma validate`: pass
- `pnpm exec prisma migrate status`: pass (11 migrations, database schema up to date)
- `pnpm build`: pass

### Evidence

- Reviewed all 14 files in the delta: `actions/settlements.ts` and its test, `lib/settlements.ts` and its test, `lib/audit.ts`, `lib/expenses.ts`, `app/(app)/settlements/[id]/page.tsx`, `components/settlements/SettlementAdjustmentForm.tsx`, `components/settlements/AdjustmentList.tsx`, both locales, `prisma/schema.prisma`, the `20261005233042_settlement_adjustments` migration, and the spec; plus callers and helpers `mayManage`, `transition`, `canManageSettlements`, `isOwnScope`, `normalizeDigitsAndSpaces`, `MULTI_LINE_TEXT`, `useFocusOnError`, and the audit-log renderer (`auditChanges`/`displayValue`).
- Authorization: `createSettlementAdjustment` calls `requireSession`, rejects Staff and a missing `settlements.mark_paid` before parsing or any read, takes `employeeId` from the PAID source row, and writes only through `tx`. The detail page applies the Staff own-scope check before loading adjustments, which all belong to the same employee; the form renders only when `canAdjustSettlement` allows it.
- Paid lock: no new code path writes an `EmployeeSettlement` in APPROVED or PAID; adjustments are created against PAID sources only and claimed only by Generate (new DRAFT) or Recalculate (DRAFT/CALCULATED, status-conditioned).
- Claiming: the `updateMany` condition includes `appliedSettlementId: null` directly on the row, so under PostgreSQL row locking a pending adjustment cannot be claimed by two settlements; `periodStart < target` uses `lt`; a stale Recalculate throws `StaleSettlementError` inside the transaction, rolling back its claims, and still returns `invalid_state`.
- Decimal exactness: amounts stay strings or `Prisma.Decimal` end to end (`sumAdjustments`, `calculateSettlement`); `toNumber()` is used only for display.
- Input: the amount schema normalizes Arabic-Indic digits, the Arabic decimal separator, and the Unicode minus, then enforces `^-?\d{1,8}(\.\d{1,2})?$` and nonzero; the reason is trimmed, 1 to 500 characters, and rejects control and bidi format characters. The reason is rendered as React text with `dir="auto"`, never as HTML.
- Client boundary: the form imports only the server action, UI components, and `lib/expenses` (type-only Prisma import); the build compiled it without pulling the Prisma runtime into the client.
- Migration SQL matches the schema model, its three indexes, and four RESTRICT foreign keys; `prisma migrate status` reports the hosted database up to date.
- Accessibility: labelled amount and reason fields, `aria-invalid` and `aria-describedby` on the reason error and hint, focus moves to the first invalid field or the form message, and a pending state on submit.

### Findings

- F-43 [P3] open - Generate runs the adjustment claim for every new settlement, even when nothing is pending for that employee
- F-44 [P3] open - No regression test pins that the settlement pages show the stored share %

### Remaining risk

- Check was not required and was not run; no live database, browser, RTL, or theme evidence was gathered for the new panels and form.
- The double-claim guarantee relies on PostgreSQL re-checking `appliedSettlementId IS NULL` under row locks for the SQL Prisma emits; it was reasoned from the code, not exercised with concurrent transactions.
- F-41 (Generate inside one interactive transaction with the default 5-second timeout) remains `unverified`, and this feature adds per-employee queries to that path (F-43).
- Dashboard activity state was not written by the reviewer, which was limited to the two review files.
