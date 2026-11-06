# Feature: Invoice date & multiple invoices on create

**From build-plan:** feature 30
**Build attempt:** 1
**Branch:** feature/invoice-date-multiple-invoices-on-create
**Status:** verified

## Goal

On `/transactions/new`, every user who can create invoices picks the invoice
date (date only, default today, never in the future) and a number of invoices
(default 1, 1 to 20). One save creates that many separate, identical invoices,
each with its own sequential number and audit entry. Example: 3 haircuts of
AED 30 for one employee are entered once with number 3.

## In scope

- A date-only field on the create form: default the salon's today
  (`Asia/Dubai`), latest pickable day today.
- A "Number of invoices" field: default `1`, whole number from 1 to 20,
  Western or Arabic digits accepted.
- Stored `createdAt`: today -> the current instant; a past day -> 12:00 salon
  time on that day; a future day -> rejected.
- Batch creation in one database transaction: N invoices with the same
  employee, service, amount, status and `createdAt`, consecutive numbers, one
  `invoice.created` audit entry each. All or nothing.
- Refuse a create whose employee and salon month already has an `APPROVED` or
  `PAID` settlement (`settlement_locked`), reusing the existing edit rule.
- Same fields for Staff, Admin and Supervisor. Staff still invoice only
  themselves; the server keeps forcing `employeeId` to the actor.
- After success: one invoice -> its detail page (as today); more than one ->
  `/transactions`. Toast reads "Invoice created." or "N invoices created."
- EN and AR text, RTL-safe layout.
- The status radio starts on Paid (user request during review); Unpaid stays
  selectable. The server still requires a submitted status.

## Out of scope

- Editing several invoices at once, or a different amount/service per copy.
- Choosing a time on create (the edit form keeps its date-and-time picker).
- Any schema or migration change.
- Changes to the edit form, status changes, permissions, or reports.

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`:
implement all steps in order, keep `pnpm test` green after each one, then stop
once for a single review packet. No checkpoint commits; `/complete` creates the
feature commit.

## Build steps

- [x] **1. Date and count rules in `lib/invoices.ts`.**
  Add `MAX_INVOICES_PER_CREATE = 20`; `invoiceCountSchema` (trim, normalize
  Arabic digits with `normalizeDigitsAndSpaces`, `^\d{1,2}$`, integer 1-20,
  output a number); `invoiceDaySchema` (a real `YYYY-MM-DD` via
  `isCalendarDate`, not after `salonToday()`); `invoiceCreatedAt(day, now)`
  returning `now` when `day === salonToday(now)`, else
  `parseSalonDateTime(`${day}T12:00`)`; `nextInvoiceNumbers(highest, count)`
  returning `count` consecutive numbers built on `nextInvoiceNumber`. Extend
  `createInvoiceSchema` with `date: invoiceDaySchema` and
  `count: invoiceCountSchema`.
  **Done when:** `lib/invoices.test.ts` covers count `1`, `20`, `٣`, `0`, `21`,
  `1.5`, `-1`, empty, text; day today, past, future, `2026-02-30`, wrong
  format; createdAt for today (exact `now`) and a past day (`08:00Z`, i.e.
  12:00 Dubai) using fake timers; numbers from `null` and from `INV-000041`
  with count 3, and the `INV-999999` overflow throw; `pnpm test` passes.

- [x] **2. Batch create in `actions/invoices.ts`.**
  Read `date` and `count` (add `"count"` to `InvoiceField`, both to
  `CREATE_FIELDS`). After the existing permission, parse and availability
  checks, compute `createdAt` once, then inside the transaction: refuse with
  `settlement_locked` when `touchesLockedSettlement(tx, [{ employeeId,
  date: createdAt }])`, read the highest number once, create the N invoices
  with `nextInvoiceNumbers`, and write one audit entry per invoice whose
  `newValue` also holds `createdAt` (ISO). Keep the unique-collision retry
  around the whole batch. Return `{ success: true, id, count }`, where `id` is
  the first invoice created.
  **Done when:** `actions/invoices.test.ts` proves: count 3 creates
  `INV-000042..44` on `tx` with three audit entries and the same `createdAt`;
  default form values still create one invoice dated now; a past day stores
  12:00 Dubai; a future day and count 21 return field errors and write
  nothing; a locked month returns `settlement_locked` and writes nothing;
  Staff still get their own `employeeId`; a collision retries the whole batch;
  existing create tests updated for the new fields; `pnpm test` passes.

- [x] **3. Create form fields and redirect.**
  `app/(app)/transactions/new/page.tsx` passes `today={salonToday()}`.
  `components/invoices/InvoiceCreateForm.tsx` adds a date field (`DatePicker`
  with `name="date"`, `max={today}`, default `today`, label, hint, error
  wired with `aria-describedby`/`aria-invalid`) and a count field
  (`FormField`, `name="count"`, `inputMode="numeric"`, `dir="ltr"`, default
  `1`, hint, error). Both keep the submitted values after a failed submit,
  like the existing fields. On success, push `/transactions/{id}` when
  `count === 1`, else `/transactions`; the toast uses a plural message. Add
  the keys to `locales/en.json` and `locales/ar.json`.
  **Done when:** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` and
  `pnpm build` pass; the form shows both fields in EN (LTR) and AR (RTL) with
  defaults today and 1, and a failed submit keeps the chosen date and count
  and focuses the first invalid field.

- [x] **4. Review fixes: one date field next to the amount, Paid by default.**
  The create form passed its `date` value into `InvoiceFields`, which also
  rendered the edit form's date-and-time field, so two date fields showed.
  Pass only `employeeId`, `serviceId` and `amount` to `InvoiceFields`. Per the
  user's design request, `InvoiceFields` takes `children` rendered in its grid
  right after the amount, and the create form puts its day field there; the
  count field sits on the next row. Start the status radio on Paid.
  **Done when:** the create form shows a single date field beside Amount
  (stacked on mobile) and Paid is selected on first load; the edit form is
  unchanged; `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` and
  `pnpm build` pass.

- [x] **5. Fix the batch timeout (F-68) and pin the lock month in tests (F-66).**
  A real create failed with Prisma `P2028` (5000 ms limit, 5595 ms taken):
  one `create` plus one audit insert per invoice was too many round trips to
  the hosted database. Write all invoices with one
  `tx.invoice.createManyAndReturn` (returning `id` and `invoiceNumber`) and
  all audit entries with one `tx.auditLog.createMany`, still in the same
  transaction. Return the id of the lowest-numbered invoice, without relying
  on the returned row order. Tests assert the exact settlement month.
  **Done when:** a create makes four queries whatever the count (lock check,
  highest number, invoice insert, audit insert), pinned by tests; the result
  id is the first number even when rows return out of order; the lock tests
  assert `monthPeriod` of the invoice day; `pnpm exec tsc --noEmit`,
  `pnpm lint`, `pnpm test` and `pnpm build` pass.

## Files / areas

- `lib/invoices.ts`, `lib/invoices.test.ts`
- `actions/invoices.ts`, `actions/invoices.test.ts`
- `components/invoices/InvoiceCreateForm.tsx`
- `components/invoices/InvoiceFields.tsx` (optional `children` slot after the amount)
- `app/(app)/transactions/new/page.tsx`
- `locales/en.json`, `locales/ar.json` (`invoices.fields`, `invoices.create`)
- Reused, unchanged: `salonToday` (`lib/expenses.ts`), `parseSalonDateTime`,
  `isCalendarDate`, `touchesLockedSettlement`, `DatePicker`, `FormField`,
  `useFocusOnError`, `useSuccessToast`.

## Data / contracts

- **Form fields:** `date` = `YYYY-MM-DD` salon day; `count` = digit string.
  Both required; the form always submits defaults.
- **Stored:** `Invoice.createdAt` = the instant above; no new columns.
- **Numbers:** `highest + 1 .. highest + count`, consecutive, read once per
  transaction attempt; a `P2002` retries the whole batch (max 3 attempts, as
  today). The batch cannot pass `INV-999999` (existing throw -> `unexpected`).
- **Writes:** one `createManyAndReturn` for the invoices and one
  `auditLog.createMany` for their entries, inside one interactive transaction.
- **Audit:** per invoice, action `invoice.created`, `newValue` =
  `{ invoiceNumber, employeeId, serviceId, amount, status, createdAt }`.
- **Result:** success `{ success: true, id: <first invoice id>, count }`;
  failures unchanged in shape, with `fieldErrors.date` / `fieldErrors.count`
  as `required` or `invalid_input` and the new top-level `settlement_locked`.
- **Trusted actor:** `requireSession()`; Staff `employeeId` is overwritten
  server-side; `invoices.create` checked before any read or write.

## Testing

`pnpm test` gate is on. Steps 1 and 2 add unit tests next to the source
(Vitest, Prisma mocked, `vi.useFakeTimers()` for today/now). Step 3 is UI and
rides on typecheck, lint, build, and a manual EN/AR look; no browser test
command exists.

## Notes for the AI

- Read `node_modules/next/dist/docs/` only if a Next.js API beyond what the
  current form already uses is needed.
- The settlement-lock check now also applies to invoices dated today. That is
  intentional: a new invoice must not add revenue to a month whose settlement
  is already approved or paid. The existing `settlement_locked` message fits.
- Keep all N creates and audit writes on `tx`, never `db`.
- Number-like text in the form: `dir="ltr"`; translated text from
  `next-intl`, no hard-coded strings. Arabic needs ICU plural forms for the
  toast (`one`, `two`, `few`, `many`, `other`).
- Same-`createdAt` invoices sort by `id desc` in the list (existing
  tie-breaker); no change needed.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9803,"specSha256":"d8ea67646ff5d287f726d8ed9bb5e086c6e0fc7b5180f3b5023d1db94f036ef2","branch":"refs/heads/feature/invoice-date-multiple-invoices-on-create","head":"cf8f8eb4f373fb9099aba94ec03ca457b9fb4c7a","baseRef":"refs/heads/main","baseCommit":"1041b348991631d916353834f51a42b92471dafa","sourceTree":"64c9a557c322e9dafa34a663ac0b545c2cac0d17","absentOptional":[]} -->

## Findings

### 30/F-66 [P2] closed - The create tests never check which salon month the settlement lock looks up

**File:** actions/invoices.test.ts:249
**Found:** 2026-11-06 by /audit independent (scope: current; lens: tests)
**Why it matters:** The spec's lock rule for a past day depends on `touchesLockedSettlement` receiving the computed `createdAt` (12:00 salon time on that day), not the current instant. Both create assertions on the settlement query (lines 125 and 249) match `periodStart: expect.any(Date)`. In the past-day test (`2026-08-31` with "now" on 15 September), a regression that passed `new Date()` or the wrong day would look up September instead of August and the test would still pass. The "locked month" test also mocks `findFirst` to return a row for any query, so nothing pins the month either. The code is correct today (`actions/invoices.ts:156`); the test does not protect it.
**Suggested fix:** In the past-day test, assert `periodStart` equals `monthPeriod("2026-08").periodStart` (or the equivalent fixed Date), and in the default test assert the September period. No current requirement is lost.
**Resolution:** 2026-11-06 by /implement (spec step 5): fixed. The default create test now asserts `periodStart` equals `monthPeriod("2026-09").periodStart` and the past-day test `monthPeriod("2026-08").periodStart` (`actions/invoices.test.ts`). Awaiting `/audit` to close.
2026-11-06 by /audit independent (scope: current; reviewed cf8f8eb): closed. The default create test asserts the full `employeeSettlement.findFirst` call with `periodStart: monthPeriod("2026-09").periodStart`, and the past-day test (`2026-08-31`, now 15 September) asserts `OR` equals `[{ employeeId: "emp1", periodStart: monthPeriod("2026-08").periodStart }]`, so passing `new Date()` instead of `createdAt` would now fail. No new defect introduced; `pnpm test` passes.

### 30/F-68 [P3] closed - A 20-invoice create runs about 42 sequential queries inside an interactive transaction with Prisma's default 5-second timeout

**File:** actions/invoices.ts:155
**Found:** 2026-11-06 by /audit independent (scope: current; lens: performance)
**Why it matters:** The batch issues the lock check, the highest-number read, then one `invoice.create` and one `auditLog.create` per invoice, each a round trip, on `db.$transaction` with no options. `actions/settlements.ts:64` already raises `timeout` to 30 s for heavier transactions. Against a remote hosted Postgres, 42 round trips at roughly 50-100 ms each could approach or exceed 5 s, which would roll back the whole batch and show "unexpected". Not measured; no latency evidence is available.
**Suggested fix:** Measure a 20-invoice create against the hosted database. If it is close to the limit, pass explicit transaction options like settlements do, or write the invoices with `createManyAndReturn` and the audit rows with `createMany`. No current requirement is lost.
**Resolution:** 2026-11-06 by /implement (spec step 5): fixed. Confirmed in use: a create failed with Prisma `P2028` (timeout 5000 ms, time taken 5595 ms). The batch now writes all invoices with one `createManyAndReturn` and all audit entries with one `auditLog.createMany`, so a create makes four queries whatever the count; a test pins one call each. Awaiting `/audit` to close.
2026-11-06 by /audit independent (scope: current; reviewed cf8f8eb): closed. `actions/invoices.ts:155-180` now runs the lock check, one highest-number read, one `tx.invoice.createManyAndReturn` and one `tx.auditLog.createMany`, all on `tx` inside the same interactive transaction. The generated Prisma 7 client (`generated/prisma/models/Invoice.ts`, PostgreSQL provider with `@prisma/adapter-pg`) exposes `createManyAndReturn`. The result id is chosen by matching `numbers[0]`, not by row order, and a test returns rows out of order to pin it. The count-3 test pins one call each and no per-row `create`. No new defect introduced; live latency against the hosted database was not re-measured in this review.

## Independent review

**Status:** passed
**Target commit:** cf8f8eb4f373fb9099aba94ec03ca457b9fb4c7a
**Base commit:** 1041b348991631d916353834f51a42b92471dafa
**Base ref:** main
**Spec hash:** d8ea67646ff5d287f726d8ed9bb5e086c6e0fc7b5180f3b5023d1db94f036ef2
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-11-06T13:41:38Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-11-06T14:02:35Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `1041b348991631d916353834f51a42b92471dafa..cf8f8eb4f373fb9099aba94ec03ca457b9fb4c7a` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash; spec is tracked, no snapshot)
- `git status --porcelain`: pass (only `blueprint/context/findings.md` and `blueprint/context/review.md` modified)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (42 files, 846 tests)

## Evidence

- Full delta reviewed: 13 files, including `actions/invoices.ts`, `lib/invoices.ts`, `components/invoices/InvoiceCreateForm.tsx`, `components/invoices/InvoiceFields.tsx`, `app/(app)/transactions/new/page.tsx`, `locales/en.json`, `locales/ar.json`, and both test files.
- Authorization: `requireSession()` and `invoices.create` checked before any read or write; Staff `employeeId` overwritten with the actor id before parsing (`actions/invoices.ts:131-139`), pinned by test.
- Dates: `invoiceDaySchema` compares against the Asia/Dubai day (salon day vs UTC day pinned by test); `invoiceCreatedAt` returns `now` for today and 12:00 salon time (08:00Z) for a past day; future day returns `invalid_input` on `date`.
- Count: ASCII `^\d{1,2}$` after Arabic-digit normalization, integer 1-20; 0, 21, 1.5, -1, empty, text, 100 rejected in tests.
- Atomicity: lock check, highest-number read, one `tx.invoice.createManyAndReturn`, and one `tx.auditLog.createMany` all run on `tx` in one interactive transaction; the generated Prisma 7 client (PostgreSQL, `@prisma/adapter-pg`) exposes `createManyAndReturn`. P2002 retries the whole batch, up to 3 attempts.
- Settlement lock: `touchesLockedSettlement` receives the computed `createdAt`; tests pin the September and August periods.
- Form: one day field in the `InvoiceFields` grid after Amount, count on the next row, Paid default, `aria-invalid`/`aria-describedby` on the date trigger button so `useFocusOnError` reaches it; submitted date and count are kept through keyed remounts.
- i18n: EN `one/other` plural and AR `one/two/few/many/other` plural for the toast; new labels and hints in both locales.

## Findings

- F-66 [P2] closed (lock-month assertions now pinned)
- F-68 [P3] closed (batch now uses two bulk inserts, four queries per create)
- F-67 [P3] open, unchanged (create day before year 1000 fails as `unexpected`); non-blocking
- No new findings

## Remaining risk

- Browser tests: unavailable (no browser test command exists); EN/RTL AR layout, date picker focus, and value retention after a failed submit were reviewed in code only.
- Check: not run (not required by the request); no running-app evidence.
- `pnpm build` was not run in this review.
- Real-database behavior (createManyAndReturn row return, P2002 mapping through the pg adapter, latency of a 20-invoice batch under the 5 s transaction timeout) is covered only by mocked unit tests.
- A create page left open past salon midnight keeps the earlier `today` as default and max, so a submit would date the invoices at 12:00 on the earlier day; low likelihood, not recorded as a finding.
