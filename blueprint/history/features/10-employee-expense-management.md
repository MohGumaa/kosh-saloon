# Feature: Employee expense management

**From build-plan:** feature 10
**Build attempt:** 1
**Branch:** feature/employee-expense-management
**Status:** verified

## Goal

Record what each employee takes or owes against their earnings: cash advances,
salary advances, withdrawals, personal purchases, and other deductions. These
are the `employeeExpenses` in `finalAmount = employeeShare - employeeExpenses +
adjustments`, which features 11 and 12 will sum per period. Users with
`employee_expenses.view` see an employee's deductions on a new Expenses tab on
`/employees/[id]`. `employee_expenses.create` adds one, `.edit` changes one,
and `.delete` removes one. Every change is audited. Employee expenses are a
separate model from salon expenses and never mix with them.

## In scope

- An `EmployeeExpenseCategory` enum and an `EmployeeExpense` model and
  migration, with employee and creator relations to `User`.
- An **Expenses** tab on `/employees/[id]` (`?tab=expenses`): that employee's
  deductions, with category and date-range filters and pagination.
- `/employees/[id]/expenses/new`: the create form for that employee. The date
  starts as today in the salon time zone.
- `/employees/[id]/expenses/[expenseId]`: the deduction's detail. It also holds
  the edit form and the delete control for users allowed to use them.
- Server Actions for create, update, and delete. Each checks its permission on
  the server, validates with Zod, and writes its audit entry in the same
  transaction as the change.
- English and Arabic text for every new string, an RTL-safe layout, and both
  themes.

## Out of scope

- Revenue, share, earnings, and payout math (feature 11), and settlements
  (feature 12). This feature stores deductions only.
- Totals, sums by category, and charts. The tab shows no totals (features 11,
  15, 17, 18).
- Locking deductions in a settled or paid period (feature 13).
- A salon-wide list of every employee's deductions or a sidebar item. The
  overview's sidebar has none; cross-employee views are feature 17.
- Staff seeing their own deductions (feature 15). Staff hold no
  `employee_expenses.*` permission by default.
- Moving a deduction to another employee. To correct the employee, delete and
  record it again.
- Receipts, attachments, recurring deductions, custom categories, multi-branch.

## Build loop

`workflow.stepReview` is `feature`, so implement every step and then present
one review packet for the whole feature. `workflow.checkpointCommits` is
`disabled`, so there are no step commits. `/complete` creates the single
feature commit.

## Build steps

- [x] 1. **Schema, migration, and rules.** Add the `EmployeeExpenseCategory`
  enum, the `EmployeeExpense` model, and the two `User` back-relations (see
  Data / contracts). Run
  `pnpm exec prisma migrate dev --name employee_expenses`. In `lib/expenses.ts`
  export `descriptionSchema` (no behavior change). Add `lib/employee-expenses.ts` with no database import:
  `EMPLOYEE_EXPENSE_CATEGORIES`, `employeeExpenseIdSchema`,
  `employeeExpenseSchema(today)`, `parseEmployeeExpenseFilters`,
  `employeeExpenseWhere(employeeId, filters)`, and
  `employeeExpenseListHref(employeeId, filters, page)`. Reuse `priceSchema`,
  `salonToday`, `dateValue`, `dayOf`, and `isCalendarDate`. Add
  `employee_expense.created`, `.updated`, `.deleted` and the `EmployeeExpense`
  entity to `lib/audit.ts`, with EN/AR labels under `audit.actions`,
  `audit.entities`, and `audit.fields` (add `employeeId` if missing; reuse
  existing `amount`, `category`, `description`, `date`). Add
  `lib/employee-expenses.test.ts`.
  _Done when_ `pnpm exec prisma validate` passes,
  `pnpm exec prisma migrate status` reports the schema is up to date, and
  `pnpm test` passes with these cases covered:
  - Category: each enum value accepted; empty and unknown rejected.
  - Amount: the `priceSchema` cases, including Arabic-Indic digits and 0
    rejected.
  - Date: a valid `YYYY-MM-DD` up to an injected today is accepted; an
    impossible date, a wrong format, and a day after today are rejected.
  - Description: optional; empty becomes `null`; over 500 characters rejected;
    line breaks kept.
  - Filters: a valid category and dates are kept, invalid ones dropped; a
    `from` after `to` drops both.
  - `employeeExpenseWhere` always includes the `employeeId` and builds the
    `date` bounds and category.
  - `employeeExpenseListHref` builds `/employees/<id>?tab=expenses&...` and
    leaves out empty values and page 1.

  If the database cannot be reached, generate the migration with
  `prisma migrate dev --create-only` only when that works. Otherwise record the
  blocker. Never use `db push`.

- [x] 2. **Server Actions.** Add `actions/employee-expenses.ts` with
  `createEmployeeExpense`, `updateEmployeeExpense`, and `deleteEmployeeExpense`,
  following `actions/expenses.ts`: `requireSession`, then the permission check,
  then `safeParse`, then the read, write, and `recordAudit` in one interactive
  transaction, then `revalidatePath`. Add `actions/employee-expenses.test.ts`
  with a separate `tx` mock and assertions that the writes run on it.
  _Done when_ the tests prove these cases and `pnpm test` passes:
  - Without the matching permission, each action returns `forbidden` with no
    write and no audit row. A form-supplied `createdById` is ignored; the
    creator is always the session user.
  - Create with an unknown `employeeId` returns `not_found` and writes nothing.
    Create for an inactive employee succeeds.
  - Invalid input returns field errors and the submitted values.
  - Create writes the row and `employee_expense.created` with the full new
    value including `employeeId`, and returns `{ success: true, id }`.
  - Update ignores any submitted `employeeId`. An update that changes nothing
    writes no audit row; otherwise only changed fields are logged, old and new
    (amounts by `.equals()`, dates as `YYYY-MM-DD`).
  - Delete removes the row and writes `employee_expense.deleted` with the full
    old value. A second delete returns `not_found` and writes nothing.
  - An unknown id on update or delete returns `not_found`. A thrown database
    error returns `unexpected`.

- [x] 3. **Expenses tab.** In `app/(app)/employees/[id]/page.tsx`, add an
  `expenses` tab (icon `Wallet`) shown only with `employee_expenses.view`, and
  widen the page's entry rule to admit that permission (see Authorization). The
  tab renders the filter form as a plain GET form (keeping `tab=expenses`), the
  table, the two empty states, and pagination links that keep the filters. Add
  an "Add deduction" link to `/employees/[id]/expenses/new` only with
  `employee_expenses.create`. Update the stale tab comment.
  _Done when_ `pnpm exec tsc --noEmit` and `pnpm build` pass.

- [x] 4. **Create page.** Add `components/employee-expenses/`
  `EmployeeExpenseFields.tsx` (category, amount, date, description) and
  `EmployeeExpenseCreateForm.tsx`, reusing `FormField`, `FormSelect`,
  `DatePicker`, and `Textarea` as `ExpenseFields` does. Add
  `app/(app)/employees/[id]/expenses/new/page.tsx`, guarded by
  `employee_expenses.create`, `notFound()` for an unknown employee, showing the
  employee's name and a back link to the tab. The date starts at
  `salonToday()` with `max` the same day. After success, show a toast and
  navigate to the detail page when the user holds `employee_expenses.view`;
  otherwise stay and reset the form (the F-37 rule from feature 9).
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass.

- [x] 5. **Detail, edit, and delete.** Add
  `app/(app)/employees/[id]/expenses/[expenseId]/page.tsx`,
  `EmployeeExpenseEditForm.tsx`, and `EmployeeExpenseDeleteForm.tsx`. The page
  calls `notFound()` for an unknown id **or** an expense whose `employeeId` is
  not `[id]`. The edit panel shows only with `employee_expenses.edit`; the
  delete panel only with `employee_expenses.delete`. After a delete, show a
  toast and `router.replace` to the employee's Expenses tab.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
  `pnpm build` pass, and `locales/en.json` and `locales/ar.json` hold the same
  key set. If a dev server and database are available, also check by hand in
  English and Arabic: as an admin, add a deduction to an employee, filter for
  it, edit it, delete it, and see each change in `/audit-log`; as a default
  Supervisor, add one and confirm no edit or delete panel shows; as Staff,
  confirm `/employees/<id>?tab=expenses` and the nested pages redirect to
  `/forbidden`.

## Files / areas

- `prisma/schema.prisma` and a new `prisma/migrations/<timestamp>_employee_expenses/`
- `lib/employee-expenses.ts` and `lib/employee-expenses.test.ts` (new)
- `lib/expenses.ts`: export `descriptionSchema` only
- `lib/audit.ts`: the new actions and entity
- `actions/employee-expenses.ts` and `actions/employee-expenses.test.ts` (new)
- `app/(app)/employees/[id]/page.tsx`: the Expenses tab and entry rule
- `app/(app)/employees/[id]/expenses/new/page.tsx` and
  `app/(app)/employees/[id]/expenses/[expenseId]/page.tsx` (new)
- `components/employee-expenses/` (new)
- `locales/en.json` and `locales/ar.json`: a new `employeeExpenses` namespace,
  `employees.tabs.expenses`, and the audit labels

Patterns to follow: `actions/expenses.ts`, `lib/expenses.ts`,
`app/(app)/expenses/*` (filter form, table, empty states, pagination with
`resolvePage` from `lib/audit.ts`), `components/expenses/*` (fields, create,
edit, two-step delete), and `components/layout/Panel.tsx`.

## Data / contracts

```prisma
enum EmployeeExpenseCategory {
  CASH_ADVANCE
  ADVANCE_SALARY
  WITHDRAWAL
  PERSONAL_PURCHASE
  OTHER
}

/// An amount deducted from an employee's earnings (`finalAmount = employeeShare -
/// employeeExpenses + adjustments`). Never a salon cost. Deleting one removes the row;
/// the `employee_expense.deleted` audit entry keeps the full record. `date` is the
/// salon calendar day the deduction belongs to, which decides its settlement month.
model EmployeeExpense {
  id          String                  @id @default(cuid())
  employeeId  String
  employee    User                    @relation("EmployeeExpenseEmployee", fields: [employeeId], references: [id], onDelete: Restrict)
  category    EmployeeExpenseCategory
  amount      Decimal                 @db.Decimal(10, 2)
  description String?
  date        DateTime                @db.Date
  createdById String
  createdBy   User                    @relation("EmployeeExpenseCreator", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  @@index([employeeId, date])
}
```

On `User`, add `employeeExpenses EmployeeExpense[] @relation("EmployeeExpenseEmployee")`
and `createdEmployeeExpenses EmployeeExpense[] @relation("EmployeeExpenseCreator")`.
Fields and categories are the overview's data model; there is no title. The
`(employeeId, date)` index serves the tab now and the per-period sums in
features 11 and 12.

**Validation** (`lib/employee-expenses.ts`, run again on the server):

- `id`, `employeeId`: `z.string().min(1).max(100)`.
- `category`: one of `EMPLOYEE_EXPENSE_CATEGORIES`, required, no default.
- `amount`: `priceSchema` (greater than 0, fits `Decimal(10, 2)`, stays a
  string). Deductions are always positive; signed corrections are settlement
  adjustments (feature 13).
- `description`: the salon expense `descriptionSchema` (optional, at most 500,
  line breaks kept, empty becomes `null`).
- `date`: `YYYY-MM-DD`, a real calendar day, not after `salonToday()`; the
  schema takes `today` as a parameter. Written as `dateValue(date)`.

**Authorization.** The trusted actor is always `requireSession().user`. The
target employee comes from the URL or a hidden field and is checked to exist on
the server; it is never trusted to be valid. There is no own scope: the
permission is salon-wide.

| Page, tab, or action | Rule |
| --- | --- |
| `/employees/[id]` entry | `employees.view`, `permissions.manage`, or `employee_expenses.view` |
| Expenses tab | `employee_expenses.view` |
| `/employees/[id]/expenses/[expenseId]` | `employee_expenses.view` |
| `/employees/[id]/expenses/new`, `createEmployeeExpense` | `employee_expenses.create` |
| Edit panel, `updateEmployeeExpense` | `employee_expenses.edit` |
| Delete panel, `deleteEmployeeExpense` | `employee_expenses.delete` |

- A page without its permission redirects to `/forbidden`
  (`requirePermission`). The existing Overview, Account, and Permissions tab
  rules do not change; the first visible tab is the default.
- Any user, of any role, active or inactive, can have deductions. The actor's
  role does not restrict the target (see Open questions).
- Supervisors get view and create by default; edit and delete must be granted.

**Action results:**

- `EmployeeExpenseFormState` has the `ExpenseFormState` shape, with fields
  `category`, `amount`, `date`, `description`.
- Error codes: `forbidden`, `not_found`, `invalid_input`, `unexpected`, with
  text under `employeeExpenses.errors`. Field error codes: `required` and
  `invalid_input` (from `auth.errors`).
- `createEmployeeExpense` reads `employeeId` from the form, checks the user
  exists inside the transaction, and returns `{ success: true, id }`.
- Update uses `updateMany({ where: { id } })` and delete
  `deleteMany({ where: { id } })`, each checking `count`; 0 returns
  `not_found`. Update never writes `employeeId`.
- Revalidate `/employees/<employeeId>` and the detail path after create and
  update; only `/employees/<employeeId>` after delete.

**Audit entries** (entity `EmployeeExpense`; amounts as strings, dates as
`YYYY-MM-DD`, `description` as a string or `null`):

| Action | Entry |
| --- | --- |
| Create | `employee_expense.created`, `newValue` `{ employeeId, category, amount, description, date }` |
| Update | `employee_expense.updated`, only the changed fields, old and new |
| Delete | `employee_expense.deleted`, `oldValue` `{ employeeId, category, amount, description, date, createdById }` |

**Tab URL and filters** (`parseEmployeeExpenseFilters`):

`/employees/<id>?tab=expenses&category=&from=&to=&page=`

- `category`: one of `EMPLOYEE_EXPENSE_CATEGORIES`.
- `from`, `to`: `YYYY-MM-DD`, inclusive, as in salon expenses. A `from` after
  `to` drops both. Invalid values are dropped and never error.

Rows sort by `date desc`, `createdAt desc`, `id desc`, 50 per page. Columns:
date (links to the detail page), category, amount, description (truncated, one
line), recorded by.

**Display:** as in feature 9. `date` formats with `timeZone: "UTC"` on the
server; `createdAt`/`updatedAt` use `LocalDateTime`. Amounts use the salon
currency inside `dir="ltr"`. Category labels from
`employeeExpenses.categories.<VALUE>`. Description and names use `dir="auto"`,
React text only, `whitespace-pre-line break-words` on the detail page.

**Empty states:** no deductions for this employee (with create permission, a
prompt to add one; without it, a short note); and "No deductions match these
filters" with Clear filters.

## Testing

- Unit tests (Vitest) in `lib/employee-expenses.test.ts` and
  `actions/employee-expenses.test.ts`, as listed in steps 1 and 2.
- Regression: `lib/expenses.test.ts`, `lib/audit.test.ts`,
  `lib/navigation.test.ts`, `lib/auth/permissions.test.ts`, and the existing
  action tests must still pass.
- No browser harness exists, so no browser tests. Report the step 5 manual
  check as run or not run; never claim a visual or database check that did not
  run.
- No Verify command exists. The final gate is `pnpm exec tsc --noEmit`,
  `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm exec prisma validate`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` before writing the pages: async
  `params`/`searchParams`, `PageProps<"/employees/[id]/expenses/[expenseId]">`,
  and `revalidatePath` in Server Actions.
- Do not duplicate `salonToday`, `dateValue`, `dayOf`, or the description rule;
  import them from `lib/expenses.ts`. Do not move them in this feature.
- The detail page must scope the lookup to both ids
  (`findFirst({ where: { id: expenseId, employeeId: id } })`) so a URL never
  shows another employee's deduction under the wrong name.
- Delete needs the same keyboard-reachable two-step confirmation with a way to
  back out as `ExpenseDeleteForm`. No `window.confirm`.
- Every form: labelled fields, errors announced through `FormField` or
  `aria-invalid` + `aria-describedby`, `useFocusOnError`, errors cleared on
  resubmit, pending text, success toast.
- Never pass a `Decimal` or `Date` to a client component; pass strings.
- The tab's filter form must submit `tab=expenses` (a hidden input) so it stays
  on the tab, and "Clear filters" goes to `/employees/<id>?tab=expenses`.

## Implementation notes

- **Tab component:** the Expenses tab is `components/employee-expenses/EmployeeExpensesTab.tsx`,
  an async server component, so `app/(app)/employees/[id]/page.tsx` only gains the tab rule,
  the widened entry rule, and one render line.
- **Prisma client:** `prisma migrate dev` applied `20261005192809_employee_expenses` but did not
  regenerate the client; `pnpm exec prisma generate` was run before `tsc` and `build` passed.
- **Delete navigation:** `deleteEmployeeExpense` revalidates only `/employees/<employeeId>`;
  `EmployeeExpenseDeleteForm` shows the toast, then `router.replace`s to the Expenses tab.
- **Manual check (step 5):** not run. No dev server was started.

## Open questions

These have reviewable defaults and do not block step 1. Say if a default is
wrong before `/implement`.

1. **Where deductions live.** Default: only on the employee's Expenses tab, as
   the overview's routes list, with nested create and detail pages. No sidebar
   item and no salon-wide list. A user holding `employee_expenses.view` but not
   `employees.view` can open `/employees/[id]` and sees only the header and the
   Expenses tab, though without `employees.view` they have no list to reach it
   from. The alternative is a `/employee-expenses` list across all employees.
2. **Hard delete.** Default: `employee_expense.deleted` removes the row,
   gated by `employee_expenses.delete` (Admin only by default), with the full
   record kept in the audit entry, as for salon expenses. Feature 13 will block
   changes inside paid periods. The alternative is no delete, or a soft delete.
3. **No future dates.** Default: a date after today in the salon time zone is
   rejected, so a deduction cannot land in a future settlement month.
4. **Any target.** Default: any user can carry deductions, including inactive
   employees (a final-month advance), Admins, and the actor themself; the audit
   log records who did it. The alternative is to restrict targets, for example
   to active Staff, or to stop Supervisors recording against Admins.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":18939,"specSha256":"a0af34214425792b7df221b93a2d3663aef8841abb5c2b150e0c6e39b00b34df","branch":"refs/heads/feature/employee-expense-management","head":"aa57e45dbb31cc2f07f56d7d64d9199283e74da1","baseRef":"refs/heads/main","baseCommit":"795b87a1d50dbb8f7f19db833cd86d9f5996a21a","sourceTree":"977997a76801df57705bbdca4e3f2606f1c07772","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** aa57e45dbb31cc2f07f56d7d64d9199283e74da1
**Base commit:** 795b87a1d50dbb8f7f19db833cd86d9f5996a21a
**Base ref:** main
**Spec hash:** a0af34214425792b7df221b93a2d3663aef8841abb5c2b150e0c6e39b00b34df
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-05T19:52:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-05T19:58:42Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `795b87a1d50dbb8f7f19db833cd86d9f5996a21a..aa57e45dbb31cc2f07f56d7d64d9199283e74da1` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash)
- `git status --short`: pass (only `blueprint/context/review.md` modified)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (27 files, 424 tests)
- `pnpm exec prisma validate`: pass
- Locale key-set comparison of `locales/en.json` and `locales/ar.json`: pass (679 keys each, no differences)
- `pnpm build`: unavailable (not run by reviewer instruction; rewrites generated output)
- `pnpm exec prisma migrate status`: unavailable (not run by reviewer instruction; needs the database)

### Evidence

- All 19 files in the delta reviewed: schema and migration, `lib/employee-expenses.ts`, `lib/expenses.ts`, `lib/audit.ts`, `actions/employee-expenses.ts`, both test files, the employee page, both new pages, the five `components/employee-expenses/` files, and both locales.
- Every action calls `requireSession`, then `hasPermission` for its own key, then Zod; the creator is always the session user, the target employee is checked inside the transaction, update never writes `employeeId`, and each write and its audit entry share the interactive `tx`.
- The detail page scopes the lookup to both ids (`findFirst({ where: { id: expenseId, employeeId: id } })`); pages use `requirePermission`; the employee page entry rule admits `employee_expenses.view` as the spec's Authorization table requires.
- The migration matches the spec's Prisma contract (enum, `Decimal(10,2)`, `DATE`, `Restrict` foreign keys, `(employeeId, date)` index); the tab query uses that index with a count plus a 50-row page.
- Action tests use a separate `tx` mock and assert writes on it, and cover forbidden, not_found, invalid input, no-change update, double delete, and unexpected errors; lib tests cover every spec case in step 1.

### Findings

- F-39 [P3] open (new): hardcoded en dash for an empty description cell.
- F-28, F-29, F-30, F-33, F-38 [P3] open and F-36 [P3] unverified: re-examined; the new code reaches the same existing patterns, recorded in their Resolution notes.
- No P0 or P1 finding is open or fixed.

### Remaining risk

- `pnpm build` was not run, so the production build of the new routes is unproven in this review (the spec reports it passed for the builder).
- `pnpm exec prisma migrate status` was not run, so migration sync with the database is unverified here.
- The step 5 manual browser and database check (admin, Supervisor, and Staff flows in English and Arabic, audit log entries) was not run; no browser harness exists and no dev server was started.
- Concurrent edits of one deduction can log a stale "before" value (F-36 pattern); not exercised against a real database.
