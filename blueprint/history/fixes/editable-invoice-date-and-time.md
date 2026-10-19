# Fix: Editable invoice date and time

**Type:** Fix
**Status:** verified
**Branch:** fix/editable-invoice-date-and-time

## The problem

An invoice's date is its `createdAt`, set when the invoice is created and never
editable. Admin and Supervisor users cannot correct an invoice entered late or
with the wrong time. Revenue, dashboards, reports, and monthly settlements all
group invoices by `createdAt` in salon time (`SALON_TIME_ZONE`, Asia/Dubai), so
changing the date can move revenue into another month. Moving revenue into or
out of a month whose settlement is already APPROVED or PAID would silently
disagree with that frozen settlement.

Where: `actions/invoices.ts` (`updateInvoice`), `lib/invoices.ts`,
`components/invoices/InvoiceEditForm.tsx` / `InvoiceFields.tsx`,
`app/(app)/transactions/[id]/page.tsx`, `locales/en.json`, `locales/ar.json`.

## The fix

- **Who:** unchanged. The edit form and `updateInvoice` already require
  `invoices.edit` and never allow Staff (`canManageInvoices`). Cancelled invoices
  stay read-only.
- **Field:** add a date-and-time field to the edit form only (not create). It is
  a `datetime-local` input in **salon time** (minute precision), pre-filled from
  the stored `createdAt`, with a hint naming the salon time zone. The value is
  stored in the existing `createdAt` column. No schema change, no migration.
- **Validation (server, Zod):** a real `YYYY-MM-DDTHH:mm`, converted from salon
  time to an instant with the existing zone-offset logic. Not later than now.
  Invalid or future values return a field error on `date`.
- **Unchanged date:** if the submitted value equals the stored `createdAt`
  formatted to the minute in salon time, the date is not changed, so saving
  other fields never strips the stored seconds.
- **Settlement lock:** when the date **or the employee** changes, inside the
  update transaction, look up `EmployeeSettlement` rows with status `APPROVED`
  or `PAID` for (old employee, old salon month) and (new employee, new salon
  month). If any exists, reject the whole edit with a new
  `settlement_locked` error (EN/AR message: the month's settlement is approved
  or paid; corrections go through a settlement adjustment). The employee is
  part of the key because changing it moves revenue between employees just as
  a date moves it between months.
  DRAFT and CALCULATED months are not blocked (recalculating handles them).
- **Audit:** the existing `invoice.updated` entry includes `createdAt` old and new
  values as ISO strings when the date changes.
- **Must not break:** amount, service, and employee edits without a date
  change behave exactly as today; the create flow; invoice list filters and
  every report (they already read `createdAt`).

## Build steps

1. [x] **Salon date-time helpers.** In `lib/invoices.ts`, add
   `salonDateTimeInput(date, timeZone?)` (instant to `YYYY-MM-DDTHH:mm` in salon
   time) and `parseSalonDateTime(value, timeZone?)` (back to a `Date`, or `null`
   for malformed or impossible values), reusing `zoneOffset`/`isCalendarDate`.
   Extend `invoiceSchema` with `date`. Add tests in `lib/invoices.test.ts`:
   round trip, 00:30 on the 1st in Dubai belongs to that month (not the previous
   UTC month), malformed and impossible inputs (`2026-02-30T10:00`, `25:00`).
   **Done when:** `pnpm test` passes with the new tests.

2. [x] **Server action.** In `updateInvoice`: read `date`, reject future values,
   detect a real date change, run the settlement lock check for the old and new
   (employee, salon month) pairs inside the transaction, update `createdAt`,
   and audit it. Add `settlement_locked` to `InvoiceErrorCode` and `date` to
   `InvoiceField`. Extend `actions/invoices.test.ts`: date change saved and
   audited; future date rejected; old month locked, new month locked, and
   employee change into a locked month all rejected; DRAFT/CALCULATED months
   allowed; Staff still forbidden; edits without a date change unaffected.
   **Done when:** `pnpm test` and `pnpm exec tsc --noEmit` pass.

3. [x] **Form and text.** Add the date-and-time input to the edit form,
   pre-filled with `salonDateTimeInput(invoice.createdAt)`, keeping submitted
   values after a failure like the other fields. Add the label, the salon time
   hint, and `invoices.errors.settlement_locked` to both locales.
   **Done when:** the field renders in the edit panel in EN and AR (RTL-safe,
   `dir="ltr"` on the value); `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`,
   and `pnpm build` pass.

## Implementation notes

- Step 1 adds `editInvoiceSchema` (`invoiceSchema` plus `date`) instead of
  extending `invoiceSchema` itself, because `createInvoiceSchema` extends
  `invoiceSchema` and create has no date.
- Step 3 also adds an `audit.fields.createdAt` label (EN/AR) so the audit log
  shows "Date" instead of the raw key for date changes.

## Verify

- As Admin, open an UNPAID or PAID invoice, change its time on the same day, and
  save: the detail shows the new date and time, and `/audit-log` shows the old
  and new `createdAt`.
- Move an invoice to the previous month where the employee has no settlement or a
  DRAFT one: it saves, and the month's revenue in `/reports/revenue` and the
  employee's earnings move with it.
- Approve or pay a settlement for that employee and month, then try to move an
  invoice into or out of that month, or change its employee to someone with a
  locked month: the edit is rejected with the locked message and nothing changes.
- A future date shows a field error.
- As Staff: no edit panel; a forged `updateInvoice` call returns `forbidden`.

## Out of scope

- Locking **amount, service, or status** edits for invoices already in an
  APPROVED or PAID month. Today those edits are allowed and can change revenue
  under a frozen settlement. This is a separate decision; raise it as its own
  `/fix` if wanted.
- Setting the date when creating an invoice.
- A salon time zone setting.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5953,"specSha256":"86aac66f7cc1b0e9d793ceff22913e0ddb6329ea7d85bfcfb8876aa3ceb06cbb","branch":"refs/heads/fix/editable-invoice-date-and-time","head":"64f0109372cfd491ca501b5745626cf2d4028515","baseRef":"refs/heads/main","baseCommit":"4f4020ebe2cec9ebc1760a41d8b00e2a4abd956d","sourceTree":"fd8256eacea348abe5b782e33a5f7d3961806b6f","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 64f0109372cfd491ca501b5745626cf2d4028515
**Base commit:** 4f4020ebe2cec9ebc1760a41d8b00e2a4abd956d
**Base ref:** main
**Spec hash:** 86aac66f7cc1b0e9d793ceff22913e0ddb6329ea7d85bfcfb8876aa3ceb06cbb
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-19T07:42:41+04:00
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-19T07:48:18+04:00
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `4f4020ebe2cec9ebc1760a41d8b00e2a4abd956d..64f0109372cfd491ca501b5745626cf2d4028515` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main 64f0109`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match; only `blueprint/context/review.md` differs)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (41 files, 817 tests)
- Locale key parity script over `locales/en.json` and `locales/ar.json`: pass (no missing keys either way)

### Evidence

- Reviewed all 10 changed files in `4f4020e..64f0109` plus `lib/earnings.ts` (`salonMonth`), `lib/expenses.ts` (`salonToday`, `dateValue`), `lib/settlements.ts` (`monthPeriod`), `actions/settlements.ts` (status transitions), `components/auth/FormField.tsx`, and `prisma/schema.prisma` (`EmployeeSettlement` unique `[employeeId, periodStart]`, `@db.Date`).
- Salon time conversion: `parseSalonDateTime` and `salonDateTimeInput` reuse `zoneOffset` through the extracted `wallClockInstant`; 00:30 on the 1st in Dubai maps to that salon month through `salonMonth`, and `monthPeriod` yields the UTC-midnight `periodStart` that the `@db.Date` column stores.
- Lock coverage: checked for (old employee, old month) and (new employee, new month) whenever the date or the employee changes, inside the update transaction, before any write; DRAFT and CALCULATED are excluded by the `status in [APPROVED, PAID]` filter, as the spec requires. Amount, service, and status edits in a locked month remain open by the spec's Out of scope.
- Authorization unchanged: `mayManage(actor, "invoices.edit")` runs before parsing; Staff and missing-permission cases still return `forbidden` (`actions/invoices.test.ts:344`, `:351`).
- Validation: Zod `editInvoiceSchema` adds `date`; empty maps to `required`, malformed, impossible, or future maps to `invalid_input` on `date`; unchanged minute keeps stored seconds and skips the lock query.
- Tests cover round trip, month boundary, DST zone, rejection table, future boundary, lock query shape for date and employee moves, rejection with nothing written, audit `createdAt` values, and unchanged-date paths.

### Findings

- F-64 [P3] open: years 0100 to 0999 pass date validation and fail the save as `unexpected`; 1000 to 1899 are accepted.
- F-65 [P3] unverified: two simultaneous edits of the same invoice can combine into an employee and month pair neither lock check saw.

### Remaining risk

- `pnpm build` was not run in this review (optional); typecheck and lint passed.
- No browser or database run: Check was not required, so the edit form, the RTL rendering, and the real Prisma and Postgres behavior of the lock query were verified only by code reading and mocked unit tests.
- A settlement approved after a CALCULATED month was edited still carries the older figures, because approval does not recompute (existing F-42 class); the spec accepts this by leaving DRAFT and CALCULATED unblocked.
- Dashboard activity state (`blueprint/.state/run.json`) was not written because this reviewer may write only the findings ledger and this receipt.
