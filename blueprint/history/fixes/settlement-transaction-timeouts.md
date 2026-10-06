# Fix: Settlement transaction timeouts

**Type:** Fix
**Status:** verified
**Branch:** fix/settlement-transaction-timeouts
**Fixes:** F-41, F-43

## The problem

"Generate settlements" always fails with "An unexpected error occurred" against
the hosted database (Prisma Postgres at `db.prisma.io`). Found during the feature
13 browser check: generating August 2026 for a single employee failed every
time, and nothing was saved because the transaction rolls back.

Measured from the dev machine with a throwaway script (writes rolled back):

| Measurement | Time |
| --- | --- |
| First query (new connection) | 5.8 s |
| Query on an open connection | ~0.47 s |
| Opening a transaction | ~1.4–1.9 s |
| Transaction with 6 queries in a row | 3.8 s |
| Generate's query sequence for August, in a transaction | failed 3/3: "Unable to start a transaction in the given time" |

All three settlement transactions in `actions/settlements.ts` use Prisma's
interactive-transaction defaults: a 2 s wait to open one (`maxWait`) and a 5 s
limit for the whole thing (`timeout`). An interactive transaction runs its
queries one after another on one connection, so the cost is round trips times
latency:

- **Generate** (line 138), for N employees: 3 `groupBy`, 1 `findMany`, settings
  and users (2), then per employee 2 `aggregate`, `create`, the claim
  (`updateMany` + `findMany`), and the audit `create`. That is about 6 + 6N
  round trips, about 12 for one employee. Feature 13 added the claim to every
  employee even when the `groupBy` found nothing pending (F-43), on top of the
  per-employee aggregates (F-41).
- **Status actions** (line 227): Recalculate is about 8 round trips; the others
  are about 3.
- **Create adjustment** (line 348): about 3 round trips. It still needs a
  connection within `maxWait`.

The server log from the failing click was not visible. The cause is inferred
from the replay above, which fails the same way.

## The fix

1. **Explicit transaction limits.** Add one constant in
   `actions/settlements.ts`, `const TX_OPTIONS = { maxWait: 10_000, timeout:
   30_000 }`, with a one-line comment saying why: the hosted database can need
   seconds to connect, and Generate's work grows with the employee count. Pass it
   to all three `db.$transaction` calls. Behavior, atomicity, and the
   all-or-nothing rollback stay the same.
2. **Fewer round trips in Generate (F-41, F-43).**
   - Add `_sum: { amount: true }` to the invoice and employee-expense `groupBy`
     calls that already run. Build each new employee's values from those sums
     with `calculateSettlement`, instead of calling `freshValues` per employee.
     An employee missing from a sum map gets 0. `freshValues` stays for
     Recalculate.
   - Keep a `Set` of the `employeeId`s from the pending-adjustments `groupBy`.
     Call `applyAdjustments`, and the follow-up `update`, only for employees in
     it. Everyone else keeps `totalAdjustments = 0` from the create.
   - Result: about 6 + 2N round trips when nobody has a correction (create and
     audit per employee).

Must not break:
- Stored values are unchanged (same Decimal math, same rounding, same eligibility
  rule).
- The claim stays conditioned on `appliedSettlementId: null`. A correction
  created after the `groupBy` stays pending for the next settlement.
- Every write stays on `tx`, the audit entries stay the same, and the
  unique-violation `invalid_state` mapping and stale-recalculation rollback stay
  as they are.

Out of scope: other modules' transactions (invoices, expenses, settings).
Nothing has shown them failing, and they run few queries. Also out of scope are
`createManyAndReturn` and batched audit writes, which can come later if
employee counts grow.

## Build steps

- [x] **1. Transaction limits.** Add `TX_OPTIONS` and pass it to the three
  `db.$transaction` calls. Extend `actions/settlements.test.ts` so the
  `$transaction` mock records its options and a test asserts each action passes
  `{ maxWait: 10_000, timeout: 30_000 }`.
  **Done when** `pnpm test`, `pnpm lint`, and `tsc` pass.
- [x] **2. Batched Generate.** Use the `_sum` from the two `groupBy` calls, and
  claim adjustments only for employees in the pending set. Update the Generate
  tests:
  - The `groupBy` mocks return `_sum`.
  - The worked example (5,000 at 50% minus 300 gives 2,200.00) and the 0%
    employee (−150.00) are unchanged.
  - `invoice.aggregate` and `employeeExpense.aggregate` are not called by
    Generate.
  - `settlementAdjustment.updateMany` is not called for an employee absent from
    the pending `groupBy`, and is still called for one present.
  - The existing claim tests still pass.

  **Done when** `pnpm test`, `pnpm lint`, `tsc`, and `pnpm build` pass.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.
- Live, with a restarted dev server against the hosted database: Generate August
  2026 creates Farja's DRAFT with deductions of 10.00 and a final amount of
  −10.00, and the audit log has `settlement.generated`. Then resume the feature
  13 Playwright run from Generate: walk August to PAID, add a −5 correction, and
  Generate September to confirm the correction is applied.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5205,"specSha256":"ca429a00f6f2c38c772df8512d45a02f6f164985fdc2985529af46ee7b2a4b94","branch":"refs/heads/fix/settlement-transaction-timeouts","head":"22cb82ec53b48bbfef75c2825002fcea63f45147","baseRef":"refs/heads/main","baseCommit":"398f8da71089c7237aa35e002bd408248861142f","sourceTree":"fed4ddb9972d049298c1e9e5017a13d8f570ce52","absentOptional":[]} -->

## Findings

### settlement-transaction-timeouts/F-41 [P2] closed - Generate runs four sequential queries per employee inside one interactive transaction with Prisma's default 5-second timeout

**File:** actions/settlements.ts:119
**Found:** 2026-10-06 by /audit independent (scope: current; lens: performance)
**Why it matters:** `generateSettlements` opens one interactive `db.$transaction` (line 99) with no `timeout` option, so Prisma's default of 5 seconds applies. Inside it, the loop at lines 119 to 135 runs, for each employee without a settlement, two `aggregate` queries in `freshValues` (lines 67 to 70), one `create`, and one audit `create`. An interactive transaction holds one connection, so the `Promise.all` in `freshValues` does not run in parallel, and the cost is about 4 database round trips per employee, one after another. The two `groupBy` queries at lines 100 to 103 already read the same invoice and expense rows; they only leave out `_sum`. Reachable path: the first Generate for a month with many active employees, on the hosted database (Vercel Prisma Postgres) with a function in another region. If the total passes 5 seconds, Prisma rolls the transaction back, the action logs it and returns `unexpected`, and nothing is generated, so retrying does not help. Nothing is half-written because of the rollback. Derived from the code; the salon's employee count and the real query latency were not measured.
**Suggested fix:** Add `_sum: { amount: true }` to the two `groupBy` calls and build each employee's values from those sums instead of calling `freshValues` per employee (keep `freshValues` for Recalculate, which is one employee). Optionally write the rows with `createManyAndReturn` and the audit entries with one `auditLog.createMany`. As a smaller change, pass `{ timeout: 15000 }` to this `$transaction`. No current requirement is lost. To confirm, time a Generate against the hosted database with a realistic number of employees.
**Resolution:** fixed on fix/settlement-transaction-timeouts (2026-10-06). Confirmed live first: against the hosted database each query takes ~0.47 s and Generate for one employee failed every time with "Unable to start a transaction in the given time". All three settlement transactions now pass `TX_OPTIONS` (`maxWait: 10_000, timeout: 30_000`), and Generate builds values from `_sum` on its existing `groupBy` calls instead of two `aggregate` queries per employee. Tests assert the options and that Generate makes no `aggregate` call; a live Generate for August 2026 then succeeded. Awaiting /audit re-review.
2026-10-06 by /audit independent (target `22cb82e`): re-reviewed and closed. In `actions/settlements.ts` the per-employee `freshValues` call is gone from Generate: the invoice and employee-expense `groupBy` calls now carry `_sum: { amount: true }` (lines 147 and 148), and each employee's values come from `calculateSettlement` over those sums with a missing map entry as 0 and `adjustments: 0` (lines 166 to 180). The stored values are the same as before: the `groupBy` uses the same `paidRevenueWhere(month)` / `expensesWhere(month)` filters the `aggregate` used plus the employee key, `employeeId` and `amount` are non-null in the schema, `Decimal(0)` equals the old `sumAdjustments([])`, and the effective share % and 2-decimal ROUND_HALF_UP rounding go through the same helpers. `freshValues` is still used by Recalculate only. All three `db.$transaction` calls pass `TX_OPTIONS` (lines 217, 306, 397); the client is the direct `@prisma/adapter-pg` one (`lib/db.ts:7`), so there is no Accelerate cap on the 30 s timeout. The worked example (2,200.00), the 0% employee (-150.00), and the no-`aggregate` and options assertions pin this (`actions/settlements.test.ts:127` to `:170`, `:343`, `:485`). No new defect found.

### settlement-transaction-timeouts/F-43 [P3] closed - Generate runs the adjustment claim for every new settlement, even when its own groupBy found nothing pending for that employee

**File:** actions/settlements.ts:170
**Found:** 2026-10-06 by /audit independent (scope: current; lens: performance)
**Why it matters:** `generateSettlements` already reads, in one `groupBy` (lines 143 to 146), which employees have pending adjustments from earlier months. The loop still calls `applyAdjustments` (line 170) for every employee it creates a settlement for, which adds one `updateMany` and one `findMany` per employee, run one after another on the single interactive-transaction connection. For a month where nobody has a correction, that is two extra round trips per employee (about six per employee in total instead of four), on the same path F-41 already flags against Prisma's default 5-second interactive-transaction timeout. The spec's note asked to batch the pending lookup into one query per generate and to keep the per-employee claim to one `updateMany` and one `aggregate`; the batch query exists but its result is not used to skip the claim. Correctness is not affected: the claim is still conditioned on `appliedSettlementId: null`, and a correction created after the `groupBy` simply stays pending. Derived from the code; latency was not measured.
**Suggested fix:** Keep a `Set` of the `employeeId`s from `pendingAdjustments` and call `applyAdjustments` (and the follow-up `update`) only for employees in it; others keep `totalAdjustments = 0` from the initial create. No current requirement is lost. Add one assertion that `settlementAdjustment.updateMany` is not called for an employee absent from the `groupBy` result.
**Resolution:** fixed on fix/settlement-transaction-timeouts (2026-10-06). Generate keeps the pending-adjustments `groupBy` result as a `Set` and claims only for employees in it; others keep `totalAdjustments = 0`. Tests assert `settlementAdjustment.updateMany` is not called when nothing is pending and is called once for the one employee who has a correction. Awaiting /audit re-review.
2026-10-06 by /audit independent (target `22cb82e`): re-reviewed and closed. `withAdjustments` is a `Set` built from the pending-adjustments `groupBy` that runs in the same transaction (`actions/settlements.ts:168`), and `applyAdjustments` plus the follow-up `update` run only for employees in it (lines 187 to 198). A correction cannot be lost: one for an employee outside the set that is created after the `groupBy` stays `appliedSettlementId: null`, and the next Generate for a later month (whose `groupBy` makes that employee active) or a Recalculate of this DRAFT claims it. It cannot be applied twice: the claim is still the unchanged `updateMany` conditioned on `appliedSettlementId: null`, and every write is on `tx`. The tests assert no `updateMany`/`findMany` when nothing is pending (`actions/settlements.test.ts:167`, `:168`) and exactly one claim for the one employee in the set (`:190`). No new defect found.

## Independent review

**Status:** passed
**Target commit:** 22cb82ec53b48bbfef75c2825002fcea63f45147
**Base commit:** 398f8da71089c7237aa35e002bd408248861142f
**Base ref:** main
**Spec hash:** ca429a00f6f2c38c772df8512d45a02f6f164985fdc2985529af46ee7b2a4b94
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-06T00:20:21Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-06T00:25:58Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD` / `git merge-base main HEAD` / `git status --porcelain`: pass (HEAD and merge base match the request; only `blueprint/context/review.md` modified)
- `sha256sum blueprint/context/current-feature.md`: pass (matches Spec hash; spec is tracked, no snapshot)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (30 files, 549 tests)
- `pnpm exec prisma validate`: pass
- `pnpm build`: pass

### Evidence

- Delta reviewed in full: `actions/settlements.ts`, `actions/settlements.test.ts`, `blueprint/context/current-feature.md`, `blueprint/context/findings.md`, plus `applyAdjustments`, `freshValues`, `transition`, `createSettlementAdjustment`, `lib/settlements.ts` (`calculateSettlement`, `sumAdjustments`, `expensesWhere`), `lib/earnings.ts` (`effectiveSharePercentage`, `paidRevenueWhere`), `lib/db.ts`, and the `Invoice`/`EmployeeExpense`/`SettlementAdjustment` schema fields.
- Generate's stored values are unchanged: the `groupBy` sums use the same filters as the old per-employee `aggregate`, `employeeId` and `amount` are non-null, a missing map entry is 0, `adjustments: 0` equals `sumAdjustments([])`, and share % and rounding use the same helpers (`actions/settlements.ts:166` to `:180`).
- Skipping the claim for employees outside the pending set cannot lose or double-apply a correction: the claim `updateMany` is unchanged and still conditioned on `appliedSettlementId: null`; a correction created after the `groupBy` stays pending for the next Generate or a Recalculate (`actions/settlements.ts:187` to `:198`).
- Every write stays on `tx`; `TX_OPTIONS` (`maxWait: 10_000, timeout: 30_000`) is passed to all three settlement transactions (`actions/settlements.ts:217`, `:306`, `:397`); the client is direct `@prisma/adapter-pg`, so no Accelerate transaction cap applies.
- Tests pin the behavior with a separate `tx` mock: `_sum` on both `groupBy` calls, no `aggregate` from Generate, unchanged 2,200.00 and -150.00 values, no claim when nothing is pending, exactly one claim for the employee in the set, and the options on Generate, a status action, and the adjustment action (`actions/settlements.test.ts:127` to `:222`, `:343`, `:485`). No skipped or focused tests in the delta.
- Security lens: no change to authorization (`mayManage`), input parsing, or data exposure in the delta.

### Findings

- F-41 closed (re-reviewed against `22cb82e`)
- F-43 closed (re-reviewed against `22cb82e`)
- No new findings

### Remaining risk

- The live hosted-database behavior (Generate within the new limits, the August-to-September adjustment walk) was not re-run by this reviewer; Check was not required and the evidence is the builder's recorded live run.
- Generate still does about 2 round trips per employee (create and audit) serially inside one transaction; the 30 s limit has headroom for a single salon's staff but was not timed at a realistic employee count.
- No deployment `maxDuration` is configured; the platform's function limit was not checked against the 10 s wait plus 30 s transaction limit.
