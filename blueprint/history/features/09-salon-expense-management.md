# Feature: Salon expense management

**From build-plan:** feature 9
**Build attempt:** 1
**Branch:** feature/salon-expense-management
**Status:** verified

## Goal

Let the salon record what it spends: rent, utilities, supplies, equipment,
maintenance, marketing, and other business costs. Users with `expenses.view`
see, search, and filter every salon expense. Users with `expenses.create` add
one, `expenses.edit` changes one, and `expenses.delete` removes one. Every
change is audited. Salon expenses feed salon reports only (features 14 and 17);
they never touch employee earnings or payouts.

## In scope

- An `ExpenseCategory` enum and a `SalonExpense` model and migration, with a
  creator relation to `User`.
- `/expenses`: the salon expense list, with search, category, and date-range
  filters, and pagination.
- `/expenses/new`: the create form. The date starts as today in the salon time
  zone.
- `/expenses/[id]`: the expense detail. It also holds the edit form and the
  delete control for users who are allowed to use them.
- Server Actions for create, update, and delete. Each one checks its permission
  on the server, validates with Zod, and writes its audit entry in the same
  transaction as the change.
- The sidebar "Salon Expenses" item links to `/expenses`.
- English and Arabic text for every new string, an RTL-safe layout, and both
  themes.

## Out of scope

- Employee expenses and deductions (feature 10). They are a separate model and
  never mix with salon expenses.
- Totals, sums by category, charts, and expense reports (features 14 and 17).
  The list shows no totals.
- Receipts or file attachments, recurring expenses, custom categories, tax, and
  multi-branch. None of these are in the plan.
- Locking expenses by period. No feature asks for it.

## Build loop

`workflow.stepReview` is `feature`, so implement every step and then present
one review packet for the whole feature. `workflow.checkpointCommits` is
`disabled`, so there are no step commits. `/complete` creates the single
feature commit.

## Build steps

- [x] 1. **Schema, migration, and rules.** Add the `ExpenseCategory` enum, the
  `SalonExpense` model, and the `User` back-relation (see Data / contracts).
  Run `pnpm exec prisma migrate dev --name salon_expenses`. Export
  `isCalendarDate` from `lib/invoices.ts` (no behavior change). Add
  `lib/expenses.ts` with no database import. It holds `EXPENSE_CATEGORIES`,
  `expenseIdSchema`, `expenseSchema`, `salonToday`, `parseExpenseFilters`,
  `expenseWhere`, and `expenseListHref`. Reuse `priceSchema` from
  `lib/services.ts` for the amount and `SALON_TIME_ZONE` from
  `lib/invoices.ts`. Add `expense.created`, `expense.updated`, and
  `expense.deleted` and the `SalonExpense` entity to `lib/audit.ts`, with EN/AR
  labels under `audit.actions`, `audit.entities`, and `audit.fields` (`title`,
  `description`, `category`, `date`; reuse `amount` if it already exists). Add
  `lib/expenses.test.ts`.
  _Done when_ `pnpm exec prisma validate` passes,
  `pnpm exec prisma migrate status` reports the schema is up to date, and
  `pnpm test` passes with these cases covered:
  - Title: trimmed; empty, over 100 characters, or multi-line is rejected.
  - Description: optional; empty becomes `null`; over 500 characters is
    rejected; line breaks are kept.
  - Category: each enum value is accepted; empty and unknown are rejected.
  - Amount: the `priceSchema` cases, including Arabic-Indic digits and 0
    rejected.
  - Date: a valid `YYYY-MM-DD` up to today is accepted; an impossible date
    (`2026-02-30`), a wrong format, and a day after today are rejected, using
    an injected "today".
  - `salonToday(new Date("2026-10-04T20:30:00Z"))` gives `2026-10-05` for
    `Asia/Dubai`, and `salonToday(new Date("2026-10-04T19:30:00Z"))` gives
    `2026-10-04`.
  - Each filter: a valid value is kept and an invalid one dropped, including a
    `from` after `to`, which drops both dates.
  - `expenseWhere` builds the `date` bounds, the category, and the `q`
    `OR` clause.

  If the database cannot be reached, generate the migration with
  `prisma migrate dev --create-only` only when that works. Otherwise record
  the blocker. Never use `db push`.

- [x] 2. **Server Actions.** Add `actions/expenses.ts` with `createExpense`,
  `updateExpense`, and `deleteExpense`, following the `actions/invoices.ts`
  shape: `requireSession`, then the permission check, then `safeParse`, then
  the write and `recordAudit` in one interactive transaction, then
  `revalidatePath`. Read every stored "before" value inside that transaction.
  Add `actions/expenses.test.ts`, with a separate `tx` mock for the
  transaction callback and assertions that the writes run on it.
  _Done when_ the tests prove each of these cases, and `pnpm test` passes:
  - Without the matching permission, each action returns `forbidden`, with no
    write and no audit row. A form-supplied `createdById` is ignored; the
    creator is always the session user.
  - Invalid input returns field errors and the submitted values.
  - Create writes the row and an `expense.created` audit row with the full new
    value, and returns `{ success: true, id }`.
  - An update that changes nothing writes no audit row. An update logs only the
    changed fields, old and new; amounts are compared with `.equals()` and
    dates as `YYYY-MM-DD` strings.
  - Delete removes the row and writes `expense.deleted` with the full old
    value. A second delete of the same id returns `not_found` and writes
    nothing.
  - An unknown id on update or delete returns `not_found`. A thrown database
    error returns `unexpected`.

- [x] 3. **List page and navigation.** Add `app/(app)/expenses/page.tsx`,
  guarded by `requirePermission("expenses.view")`. Add the filter form as a
  plain GET form, the table, the two empty states, and pagination links that
  keep the filters. Add a "New expense" link only with `expenses.create`. Set
  `href: "/expenses"` on the `salonExpenses` nav item.
  _Done when_ `pnpm exec tsc --noEmit` and `pnpm build` pass, `/expenses` is in
  the route list, and `lib/navigation.test.ts` asserts the new href.

- [x] 4. **Create page.** Add `components/expenses/ExpenseFields.tsx` (title,
  category, amount, date, description, shared by create and edit) and
  `ExpenseCreateForm.tsx`. Add `app/(app)/expenses/new/page.tsx`, guarded by
  `expenses.create`. The date input starts at `salonToday()` from the server
  page and has `max` set to the same day. After a create succeeds, show a
  success toast and navigate to `/expenses/[id]`.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass.

- [x] 5. **Detail, edit, and delete.** Add `app/(app)/expenses/[id]/page.tsx`,
  `ExpenseEditForm.tsx`, and `ExpenseDeleteForm.tsx`. The page calls
  `notFound()` for an unknown id. The edit panel shows only with
  `expenses.edit`; the delete panel shows only with `expenses.delete`. After a
  delete succeeds, show a success toast and navigate to `/expenses`.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
  `pnpm build` pass, and `locales/en.json` and `locales/ar.json` hold the same
  key set. If a dev server and database are available, also check by hand, in
  English and Arabic: as an admin, create an expense, filter for it, edit it,
  delete it, and see each change in `/audit-log`; as a default Supervisor,
  create one and confirm no edit or delete panel shows; as Staff, confirm the
  sidebar item is hidden and `/expenses` redirects to `/forbidden`.

## Files / areas

- `prisma/schema.prisma` and a new `prisma/migrations/<timestamp>_salon_expenses/`
- `lib/expenses.ts` and `lib/expenses.test.ts` (new)
- `lib/invoices.ts`: export `isCalendarDate` only
- `lib/audit.ts`: the new actions and entity
- `actions/expenses.ts` and `actions/expenses.test.ts` (new)
- `app/(app)/expenses/page.tsx`, `new/page.tsx`, and `[id]/page.tsx` (new)
- `components/expenses/` (new)
- `lib/navigation.ts` and `lib/navigation.test.ts`
- `locales/en.json` and `locales/ar.json`: a new `expenses` namespace and the
  audit labels

Patterns to follow:

- `actions/invoices.ts`: form state, `readForm`, `fieldErrorsOf`,
  transactions, and `updateMany`/count checks.
- `app/(app)/transactions/page.tsx`: the filter form, table, empty states, and
  pagination. Reuse `resolvePage` from `lib/audit.ts`.
- `components/invoices/*`: the field set, create, and edit forms.
  `components/invoices/InvoiceStatusForm.tsx`: the two-step cancel
  confirmation, reused for delete.
- `components/layout/Panel.tsx`: the detail layout.

## Data / contracts

```prisma
enum ExpenseCategory {
  RENT
  ELECTRICITY
  WATER
  INTERNET
  SUPPLIES
  EQUIPMENT
  MAINTENANCE
  MARKETING
  OTHER
}

/// A salon business cost. Feeds salon reports only; never an employee payout.
/// `date` is the salon calendar day the cost belongs to.
model SalonExpense {
  id          String          @id @default(cuid())
  title       String
  description String?
  category    ExpenseCategory
  amount      Decimal         @db.Decimal(10, 2)
  date        DateTime        @db.Date
  createdById String
  createdBy   User            @relation("SalonExpenseCreator", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([date])
}
```

On `User`, add `createdSalonExpenses SalonExpense[] @relation("SalonExpenseCreator")`.
The category list is the overview's data model; the plan's "utilities" are
`ELECTRICITY`, `WATER`, and `INTERNET`.

**Validation** (`lib/expenses.ts`, run again on the server):

- `id`: `z.string().min(1).max(100)`.
- `title`: trimmed, 1 to 100 characters, `SINGLE_LINE_TEXT`.
- `description`: optional, trimmed, at most 500 characters. Line breaks are
  allowed; other control characters are not. Empty becomes `null`.
- `category`: one of `EXPENSE_CATEGORIES`, required, no default.
- `amount`: `priceSchema` (greater than 0, fits `Decimal(10, 2)`, stays a
  string).
- `date`: `YYYY-MM-DD`, a real calendar day (`isCalendarDate`), and not after
  `salonToday()`. The schema takes "today" as a parameter (for example
  `expenseSchema(today)`) so tests can inject it. Written to Prisma as
  `new Date(`${date}T00:00:00.000Z`)`.

**`salonToday(now = new Date(), timeZone = SALON_TIME_ZONE)`** returns the
calendar day in that zone as `YYYY-MM-DD`, using `Intl.DateTimeFormat` with
`timeZone` (for example the `en-CA` format or `formatToParts`). No dependency.

**Authorization.** The trusted actor is always `requireSession().user`. There
is no own scope: salon expenses are salon-wide, and Staff have no `expenses.*`
permission by default.

| Page or action | Rule |
| --- | --- |
| `/expenses`, `/expenses/[id]` | `expenses.view` |
| `/expenses/new`, `createExpense` | `expenses.create` |
| Edit panel, `updateExpense` | `expenses.edit` |
| Delete panel, `deleteExpense` | `expenses.delete` |

- A page without its permission redirects to `/forbidden` (`requirePermission`).
- A panel is rendered only when the actor holds its permission; the server
  enforces the same rule. Supervisors get view and create by default; edit and
  delete must be granted.

**Action results:**

- `ExpenseFormState` has the same shape as `InvoiceFormState`.
- Error codes: `forbidden`, `not_found`, `invalid_input`, `unexpected`, with
  text under `expenses.errors`.
- Field error codes: `required` and `invalid_input` (from `auth.errors`, as
  `FormField` renders them). A future date uses `invalid_input` with a hint on
  the date field that it cannot be after today.
- A failed result returns the submitted `values`. `createExpense` returns
  `{ success: true, id }`.
- Update uses `updateMany({ where: { id } })` and checks `count`; delete uses
  `deleteMany({ where: { id } })` and checks `count`. A count of 0 returns
  `not_found`.

**Audit entries** (entity `SalonExpense`; amounts as strings, dates as
`YYYY-MM-DD`, `description` as a string or `null`):

| Action | Entry |
| --- | --- |
| Create | `expense.created`, `newValue` `{ title, description, category, amount, date }` |
| Update | `expense.updated`, only the changed fields, old and new |
| Delete | `expense.deleted`, `oldValue` `{ title, description, category, amount, date, createdById }` |

The delete entry keeps the full record, so the audit log is the only history
of a deleted expense.

**List URL and filters** (`parseExpenseFilters`):

`/expenses?q=&category=&from=&to=&page=`

- `q`: trimmed, 1 to 100 characters, single-line. Matches `title` or
  `description`, case-insensitive `contains`.
- `category`: one of `EXPENSE_CATEGORIES`.
- `from`, `to`: `YYYY-MM-DD`, inclusive, compared directly with the `date`
  column (`gte`/`lte` UTC midnight of that day). A `from` after `to` drops
  both. Either end can be given alone.
- An invalid value is dropped and shows as empty in the form. It never errors.

Rows sort by `date desc`, then `createdAt desc`, then `id desc`, 50 per page
(`EXPENSE_PAGE_SIZE`). The count uses the same `where`. "Clear filters" goes
to `/expenses`.

**List columns:** date, title (links to the detail page), category, amount,
created by.

**Display:**

- `date` is a calendar day, not an instant. Format it with
  `Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })` on
  the server. Do not pass it through `LocalDateTime`, which would shift it by
  the viewer's zone. `createdAt`/`updatedAt` on the detail page use
  `LocalDateTime`.
- Amounts use `Intl.NumberFormat(locale, { style: "currency", currency })`
  inside `dir="ltr"` spans, with the currency from `getSalonSettings()`.
- Category labels come from `expenses.categories.<VALUE>`.
- Title, description, and names use `dir="auto"` and render as React text
  only, never `dangerouslySetInnerHTML`. The description keeps its line breaks
  with `whitespace-pre-line` and wraps with `break-words`.

**Empty states:**

- No expenses at all: with `expenses.create`, a prompt to add one; without it,
  a short note.
- No matches: "No expenses match these filters", plus Clear filters.

## Testing

- Unit tests (Vitest) in `lib/expenses.test.ts` and
  `actions/expenses.test.ts`, as listed in steps 1 and 2.
- Regression: `lib/invoices.test.ts`, `lib/navigation.test.ts`,
  `lib/audit.test.ts`, and the existing action tests must still pass.
- There is no browser harness, so there are no browser tests. Report the
  manual check in step 5 as run or not run. Never claim a visual or database
  check that did not run.
- There is no Verify command. The final gate is `pnpm exec tsc --noEmit`,
  `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm exec prisma validate`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` before writing the pages: async
  `params`/`searchParams`, `PageProps<"/expenses/[id]">`, and how
  `revalidatePath` in a Server Action refreshes the current route.
- After a delete, the detail page no longer exists. Make sure the success
  toast still shows and the user lands on `/expenses`, not on the not-found
  page (for example, revalidate only `/expenses` and navigate from the client
  after the toast, as the create form does). Record the approach used.
- Delete needs a second, explicit confirmation step that works from the
  keyboard, with a way to back out, like the invoice cancel confirmation. Do
  not use `window.confirm`.
- Every form: each field labelled, field errors announced through `FormField`
  (or an equivalent `aria-invalid` + `aria-describedby` for the native
  `<select>` and `<textarea>`), focus to the first error or the form message
  (`useFocusOnError`), errors cleared on resubmit, submit disabled with pending
  text while pending, and a success toast.
- Use a native `<select>` for the category with the `InvoiceFields` select
  styling, and a native `<textarea>` styled to match the inputs. No new
  component library.
- The date input uses `type="date"` with `dir="ltr"`, and `max` set to
  today's salon day. The server check is the real rule.
- Never pass a `Decimal` or a `Date` to a client component; pass strings.
- Revalidate `/expenses` and `/expenses/[id]` after create and update, and
  `/expenses` after delete.
- Keep `salonToday` in `lib/expenses.ts` for now. Do not move the shared date
  helpers out of `lib/invoices.ts` in this feature.

## Implementation notes

- **Delete navigation:** `deleteExpense` revalidates only `/expenses`, so the deleted
  expense's page is not re-rendered into the not-found page. `ExpenseDeleteForm` shows
  the toast and then calls `router.replace("/expenses")`, so Back does not return to
  the deleted expense.
- **Create without view:** applying the F-37 lesson, `ExpenseCreateForm` navigates to
  the detail page only when the user holds `expenses.view`. Otherwise it stays on
  `/expenses/new` and React resets the form for another expense.
- **Manual check (step 5):** not run. No dev server was started.

## Open questions

These have reviewable defaults and do not block step 1. Say if a default is
wrong before `/implement`.

1. **Delete is a hard delete.** The permission catalog has `expenses.delete`
   and the data model has no status or deleted flag, so the default removes
   the row, gated by `expenses.delete` (Admin by default), with the full
   record kept in the `expense.deleted` audit entry. Unlike invoices, salon
   expenses never affect payouts. The alternative is no delete at all, or a
   soft delete with a new field.
2. **No future dates.** The default rejects a date after today in the salon
   time zone. The alternative is to allow future dates (for example, rent
   recorded in advance), which would then show up in future-period reports.
3. **Description length.** The default caps the optional description at 500
   characters and the title at 100.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":17820,"specSha256":"3f9d4b03ceeb901403048b43819e72679b81f07a4444266f978c7738fa952499","branch":"refs/heads/feature/salon-expense-management","head":"f295710b2b00ff482e8bb81b9b41e1c5e29b5565","baseRef":"refs/heads/main","baseCommit":"6e16f1a57e3f120b700b57d81cdb596b480d38aa","sourceTree":"10b70dacd755f48c20130a2bf0fd7b9d296ca6da","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** f295710b2b00ff482e8bb81b9b41e1c5e29b5565
**Base commit:** 6e16f1a57e3f120b700b57d81cdb596b480d38aa
**Base ref:** main
**Spec hash:** 3f9d4b03ceeb901403048b43819e72679b81f07a4444266f978c7738fa952499
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T18:23:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T18:31:16Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `6e16f1a57e3f120b700b57d81cdb596b480d38aa..f295710b2b00ff482e8bb81b9b41e1c5e29b5565` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --short`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed before the review)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (25 files, 387 tests)
- `pnpm exec prisma validate`: pass
- Node script comparing the key sets of `locales/en.json` and `locales/ar.json`: pass (no key missing on either side)

### Evidence

- Reviewed all 20 files in the delta: `actions/expenses.ts` and its test, `lib/expenses.ts` and its test, the three `app/(app)/expenses` pages, the four `components/expenses` forms, `lib/audit.ts`, `lib/invoices.ts`, `lib/navigation.ts` and its test, both locale files, `prisma/schema.prisma`, the `20261004202826_salon_expenses` migration, and the spec.
- Authorization: every page calls `requirePermission` first (`expenses.view` on the list and detail, `expenses.create` on the new page); each Server Action calls `requireSession`, then `hasPermission` for its own key before parsing or writing. The creator is always the session user; `readForm` reads only the five fields, so a form-supplied `createdById` is ignored.
- Validation and writes: Zod runs on the server for every action (`expenseSchema(salonToday())`, `expenseIdSchema`). Create, update, and delete each read the stored row, write, and call `recordAudit(..., tx)` inside one interactive transaction; update and delete use `updateMany`/`deleteMany` with a count check. The hard delete keeps the full record, including `createdById`, in `expense.deleted`.
- Dates and money: `salonToday` uses `Intl.DateTimeFormat` with the salon zone; `@db.Date` values are written as UTC midnight and displayed with `timeZone: "UTC"`; the future-date rule compares `YYYY-MM-DD` strings server-side. Only strings reach the client forms (amount via `toString()`, date via `dayOf`, timestamps via `toISOString()`).
- Migration matches the spec's model: enum, table, `DECIMAL(10,2)`, `DATE`, date index, and a `RESTRICT` creator foreign key; no user hard-delete path exists in `actions/` or `lib/`.
- Delete navigation: `deleteExpense` revalidates only `/expenses`; the installed Next.js 16.3.8 docs (`revalidatePath.md:19`) say a Server Function refreshes the UI only when viewing the affected path, consistent with the recorded approach.
- Forms: labelled fields, `aria-invalid`/`aria-describedby` on the native select and textarea, `useFocusOnError`, pending labels, success toasts, a keyboard-reachable two-step delete with a Keep button and focus return, `dir="auto"`/`dir="ltr"` as specified, and no `dangerouslySetInnerHTML`.
- Tests: the action tests use a separate `tx` mock and assert writes on it; the schema, filter, `salonToday`, and `expenseWhere` cases listed in the spec are covered.

### Findings

- F-38 [P3] open (new): raw joiner characters in the multi-line description rule, `lib/expenses.ts:35`
- Re-examined with notes, status unchanged: F-22, F-28, F-29, F-30, F-33 (open), F-36 (unverified)
- No P0 or P1 finding is open or fixed.

### Remaining risk

- `pnpm build` was not run (it rewrites generated files and was not required for this review), so route generation and the production bundle were not re-verified here.
- `pnpm exec prisma migrate status` was not run; the migration was not applied to or compared against a real database in this review.
- No browser harness exists and no dev server was started, so the manual step 5 flows (EN/AR, RTL, both themes, delete toast and redirect, Supervisor and Staff visibility) were not observed.
- Concurrent edits of one expense can log stale "before" values (recorded under F-36, unverified).
