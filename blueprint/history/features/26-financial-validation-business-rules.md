# Feature: Financial validation & business rules

**From build-plan:** feature 26
**Build attempt:** 1
**Branch:** feature/financial-validation-business-rules
**Status:** verified

## Goal

Prove every V1 money rule from the project overview with automated tests, so
revenue, share percentage, employee expenses, adjustments, final payout, invoice
status, and settlement calculations cannot silently drift. Fix only the defects
those tests expose. While planning, the employee Earnings panel was suspected of
showing one fils less than the settlement, because it formats the unrounded share
through a float. Implementation disproved that: `Intl.NumberFormat` formats the
shortest decimal form, so 2.675 still shows as 2.68. The panel now uses the
settlement's rounded share anyway, so the two match by construction.

## In scope

- One rule-by-rule test suite that runs the overview's business rules end to end
  through the existing pure functions (`lib/earnings.ts`, `lib/settlements.ts`):
  effective share, paid revenue, employee share, expenses, adjustments, final
  amount, rounding, and frozen historical values.
- Filling the edge cases the current tests miss (listed under Testing).
- Server-action tests that pin the stored values and the queries behind them:
  only PAID invoices, only the month's employee expenses, never salon expenses, the
  share percentage used is stored, and adjustments are claimed exactly once.
- Making the Earnings panel show the same rounded `employeeShare` a settlement
  would store.
- Small, local fixes in production code for any rule a new test proves broken,
  each covered by the failing test that found it.

## Out of scope

- New money rules, tax math, refunds (REFUNDED is future), or new settlement
  statuses.
- Blocking invoice edits or status changes in months that already have a
  settlement (see Open questions).
- Browser tests, a `Verify` command, or CI (`/ci` and `/tests browser` are separate).
- Production security and permission testing beyond what each money rule needs
  (feature 28), and deployment or database operations (feature 27).
- Rewriting existing passing tests or moving them between files.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet. `workflow.checkpointCommits` is `disabled`: no commits between steps.
`/complete` makes the feature commit. Run `pnpm test`, `pnpm lint`, and
`pnpm exec tsc --noEmit` after each step.

## Build steps

- [x] **1. Business rules suite (pure).** Add `lib/financial-rules.test.ts`.
  Each `describe` names one overview rule and asserts it through
  `effectiveSharePercentage`, `calculateEarnings`, `calculateSettlement`,
  `sumAdjustments`, and `paidRevenueWhere`. Cover the edge cases under Testing.
  Done when: `pnpm test` passes with the new file, and every overview business
  rule listed under Data / contracts has at least one named test. If a test fails
  because production logic is wrong, stop the step, fix the logic minimally, and
  note the defect in the review packet.
- [x] **2. Stored-value tests in actions.** Extend `actions/settlements.test.ts`,
  reusing its mocks, to assert that Generate and Recalculate: read revenue with a
  `status: "PAID"` filter only; read only employee expenses dated in the month;
  never query salon expenses; store the employee's own percentage over the salon
  default, including 0; write `finalAmount` equal to `calculateSettlement` for the
  aggregated inputs; and for a 0% employee with expenses, store a negative
  `finalAmount`. Add a test that marking a settlement CALCULATED, APPROVED, or PAID
  never writes value fields, and that a settings share change affects only a
  recalculated DRAFT, not a CALCULATED, APPROVED, or PAID settlement. Done when:
  `pnpm test` passes and each of those assertions exists by name.
- [x] **3. Invoice status and amount rules.** Extend `lib/invoices.test.ts` and
  `actions/invoices.test.ts` only where gaps remain. Confirm that a cancelled
  invoice can never become PAID again; that Staff create only PAID or UNPAID
  invoices, for themselves only; and that the amount keeps two decimals as a
  string from input to Prisma (Arabic-Indic digits included). Add range tests for
  the employee's own share percentage (`lib/employees.test.ts`: rejects `-1`,
  `100.01`, `50.555`; accepts `0`, `100`, `33.33`). Done when: `pnpm test` passes
  with the added cases.
- [x] **4. Earnings panel rounding.** In
  `components/employees/EmployeeEarningsPanel.tsx`, show the share the way a
  settlement stores it: build the figures with `calculateSettlement` (expenses 0,
  adjustments 0), as `lib/reports.ts` and `lib/dashboard-data.ts` already do, and
  format the rounded `employeeShare`. Add a test in `lib/financial-rules.test.ts`
  that `5.35` at 50% gives `2.68` (not the float result `2.67`) as the value every
  surface shows. Done when: the panel no longer formats the unrounded
  `calculateEarnings` share, and `pnpm test`, `pnpm lint`, and
  `pnpm exec tsc --noEmit` pass. Check by code review; no browser run is claimed.

## Files / areas

- `lib/financial-rules.test.ts` (new)
- `actions/settlements.test.ts`
- `lib/invoices.test.ts`, `actions/invoices.test.ts`, `lib/employees.test.ts`
- `components/employees/EmployeeEarningsPanel.tsx`
- Read-only references: `lib/earnings.ts`, `lib/settlements.ts`,
  `actions/settlements.ts`, `lib/reports.ts`, `lib/dashboard-data.ts`,
  `prisma/schema.prisma`
- Production files in `lib/` or `actions/` only when a new test proves a rule
  broken.

## Data / contracts

No schema, migration, route, or API change. The rules under test, quoted from the
project overview:

- Effective share: the employee's own value when set (0 included), otherwise the
  salon `employeeSharePercentage` (default 50). Range 0 to 100, 2 decimals.
- `paidRevenue` = sum of the employee's PAID invoices in the salon month (Dubai
  days). UNPAID and CANCELLED never count toward revenue or payout.
- `employeeShare` = `paidRevenue * sharePercentage / 100`, stored rounded to 2
  decimals, half up.
- `finalAmount` = `employeeShare - employeeExpenses + adjustments`. It may be
  negative. Adjustments are signed and nonzero.
- Salon expenses never reduce an employee payout.
- No tax math: `taxRate` never affects any amount.
- A settlement stores the `sharePercentage` it used. Only a DRAFT or CALCULATED
  settlement is recalculated (back to DRAFT). APPROVED and PAID values never
  change, and PAID is corrected only by an adjustment applied to a later
  settlement, once.
- Worked example: AED 5,000 paid at 50% gives 2,500, minus 300 expenses gives a
  final 2,200.
- All money stays `Prisma.Decimal` or a decimal string. A float is used only for
  `Intl` display of a value already rounded to 2 decimals.

## Testing

`pnpm test` (Vitest). Edge cases step 1 adds where missing:

- 0 revenue; 0% and 100% share; fractional percentages (`12.5`, `33.33`).
- Half-up boundary at exactly `.005` and just below it, at the largest invoice
  amount (`99999999.99`), and the sum of many 2-decimal invoices with no float
  drift.
- An employee's own `"0.00"` share is used over the salon default, not treated as
  unset.
- Expenses larger than the share; negative adjustments larger than the share;
  positive and negative adjustments that cancel to 0.
- A frozen settlement keeps its stored percentage: recalculating with a new salon
  default changes only fresh values, never the stored inputs passed in.
- `taxRate` is not an input to any calculation (checked through function
  signatures and the action tests).

No browser, visual, or live-database evidence is claimed. Action tests use the
existing Prisma mocks.

## Notes for the AI

- Coverage is already strong: 688 tests pass across 35 files (baseline run
  2026-10-19). Add tests for what is missing; do not duplicate existing cases.
  Read the existing `describe` blocks before adding one.
- Keep tests next to their source, except `lib/financial-rules.test.ts`, which
  spans the rule chain on purpose.
- Construct money with `new Prisma.Decimal(...)` and compare with `.toString()`
  or `.equals()`. Never compare floats.
- If a test exposes a rule violation, fix it in the smallest place and say so in
  the review packet. A fix in `actions/settlements.ts` touches the payout
  boundary; mention it so independent review (`when-sensitive`) can be chosen.
- No new dependency, helper module, or configuration.

## Open questions

- **Invoice changes after settlement (non-blocking).** An invoice in a month that
  already has a CALCULATED, APPROVED, or PAID settlement can still be edited or
  have its status changed. The frozen settlement values stay as they are, and the
  overview says corrections go through adjustments, but nothing warns or blocks
  the change. This spec leaves that behavior as it is and keeps it out of scope.
  Should a later `/fix` warn, block, or leave it?


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8919,"specSha256":"8c015ae8a49e3745dad9fa9997f46ae03a111837f90ed1d457636805b4cb59e1","branch":"refs/heads/feature/financial-validation-business-rules","head":"eb7b78c84bc9ce3de78aa73bd7b7d5d299594682","baseRef":"refs/heads/main","baseCommit":"eb7b78c84bc9ce3de78aa73bd7b7d5d299594682","sourceTree":"1367f5ca8146b348a52617fab25114859e250fcb","absentOptional":[]} -->
