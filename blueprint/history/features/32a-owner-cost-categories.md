# Feature: Owner cost categories

**From build-plan:** feature 32a
**Build attempt:** 1
**Branch:** feature/owner-cost-categories
**Status:** verified

## Goal

The owner pays rent, electricity, water and internet personally, not from the salon
cash the supervisor manages. Make these four salon expense categories **owner costs**:

- Only an **ADMIN** can add, edit, delete or see them.
- Non-admins never see them anywhere: the expense list, expense details, the expense
  report and the dashboard.
- The monthly closing statement's **net kept** leaves them out for everyone, so it
  stays the figure agreed with the supervisor.

Feature 32b will use these entries for the admin-only owner net profit. Nothing new is
stored, and there is no schema change.

## Rules (decided by the user, 2026-11-18)

| Rule | Detail |
| --- | --- |
| Owner cost categories | `RENT`, `ELECTRICITY`, `WATER`, `INTERNET` (existing `ExpenseCategory` values) |
| Who can see and manage them | `user.role === "ADMIN"` only. No new permission key. Holding `expenses.*` is still required as today; an ADMIN holds every key. |
| Existing data | Rows already stored in these categories, whoever created them, become owner costs. No data is moved or changed. |
| Closing statement | Salon expenses there = only the non-owner categories, for every viewer, Admin included. |
| Admin views elsewhere | Unchanged: the expense list, details, expense report and dashboard keep showing every category to an ADMIN. |

## In scope

- **Shared rule (`lib/expenses.ts`):**
  - `OWNER_COST_CATEGORIES`
  - `isOwnerCost(category)`
  - `canSeeOwnerCosts(user: { role })`, true only for ADMIN
  - `expenseCategoriesFor(user)`: every category for an ADMIN, otherwise the five
    shared ones, in the existing order
  - `SALON_CASH_EXPENSES: Prisma.SalonExpenseWhereInput = { category: { notIn: OWNER_COST_CATEGORIES } }`

  It stays free of database imports.
- **List `/expenses`:**
  - For non-admins, the query adds `SALON_CASH_EXPENSES` to the count and to the page
    query.
  - The category filter offers only `expenseCategoriesFor(user)`.
  - A non-admin URL with `?category=RENT` (etc.) drops the filter, the same as any
    invalid value: `parseExpenseFilters` takes the allowed categories.
- **Details `/expenses/[id]`:** an owner-cost expense viewed by a non-admin renders
  `notFound()`, the same as an unknown id, so its existence is not revealed.
- **Create and edit forms:** `ExpenseFields` takes the category list as a prop. The
  new and edit pages pass `expenseCategoriesFor(user)`.
- **Server actions (`actions/expenses.ts`):** the server enforces the rule. The form
  is not trusted.
  - `createExpense`: a non-admin submitting an owner category gets `forbidden`, and
    nothing is written or audited.
  - `updateExpense`: if the stored row is an owner cost and the actor is not an ADMIN,
    the result is `not_found`. If a non-admin changes the category to an owner one,
    the result is `forbidden`. Both checks run inside the existing transaction before
    `updateMany`.
  - `deleteExpense`: a stored owner cost with a non-admin actor gives `not_found`,
    nothing is deleted and no audit entry is written.
- **Expense report (`loadExpenseReport`):** for non-admins, both salon queries
  (`findMany` and `groupBy`) add `SALON_CASH_EXPENSES`. The caller passes the
  viewer's role or a `includeOwnerCosts` boolean.
- **Dashboard (`loadDashboard`):** for non-admins, the salon expense `aggregate` and
  the chart `findMany` add `SALON_CASH_EXPENSES`. That also applies to the profit
  card, which reuses the salon total. Admin figures are unchanged.
- **Closing statement (`loadClosingStatement`):** the salon expense `groupBy` adds
  `SALON_CASH_EXPENSES` for every viewer. Under the expenses table, a short muted
  note reads: "Rent, electricity, water and internet are owner costs and are not
  included." It is shown on screen and in print.
- EN/AR strings for that note. No other new UI text: forbidden and not-found reuse the
  existing `expenses.errors.*`.

## Out of scope

- The owner net profit section and the yearly Profit & Loss page (32b).
- A new permission key, a role setting, or a configurable list of owner categories.
- Any schema change, migration or data move.
- Changes to employee expenses, settlements, invoices or revenue math.
- The audit log: it is already admin-only (`/audit-log`, `adminOnly`), so owner-cost
  audit entries are not exposed.

## Build loop

`workflow.stepReview` is `feature` and checkpoint commits are disabled. Build all
steps, running each step's checks, then present one review packet at the end.
`/complete` creates the single feature commit.

## Build steps

- [x] **1. Rule helpers (`lib/expenses.ts`).** Add `OWNER_COST_CATEGORIES`, `isOwnerCost`,
  `canSeeOwnerCosts`, `expenseCategoriesFor` and `SALON_CASH_EXPENSES`.
  `parseExpenseFilters(params, categories = EXPENSE_CATEGORIES)` ignores a category
  outside `categories`. `expenseWhere(filters, today, { ownerCosts })` adds
  `SALON_CASH_EXPENSES` when `ownerCosts` is false. Existing callers keep working
  through the defaults until step 3.
  - **Done when:** `lib/expenses.test.ts` covers each helper for ADMIN, SUPERVISOR
    and STAFF; a dropped `?category=RENT` for a non-admin; and `expenseWhere` with
    and without owner costs (merged with category, date and search). `pnpm test`
    passes.
- [x] **2. Server actions.** Add the create, update and delete guards described above.
  - **Done when:** `actions/expenses.test.ts` covers each of these:
    - a SUPERVISOR creating RENT gets `forbidden` with no create or audit
    - an ADMIN creating RENT succeeds
    - a SUPERVISOR editing a stored INTERNET row gets `not_found` with no update
    - a SUPERVISOR changing SUPPLIES to RENT gets `forbidden`
    - a SUPERVISOR deleting a stored WATER row gets `not_found` with no delete or
      audit
    - an ADMIN can edit and delete owner rows

    `pnpm test` passes.
- [x] **3. Expense pages.** Make these changes:
  - the list (where clause and filter options)
  - the details page (`notFound` for a non-admin)
  - `ExpenseFields` with a `categories` prop
  - the new page and the edit form passing `expenseCategoriesFor(user)`

  Read the session user's role from the `requirePermission` result. Before editing
  pages, read the relevant guide in `node_modules/next/dist/docs/`.
  - **Done when:** `pnpm exec tsc --noEmit` and `pnpm lint` pass. A non-admin's
    list, filter, form and detail page show no owner category; an admin's are
    unchanged (manual check, see Testing).
- [x] **4. Reports, dashboard, closing statement.** Make these changes:
  - pass the owner-cost flag into `loadExpenseReport` and `loadDashboard`
  - apply `SALON_CASH_EXPENSES` in `loadClosingStatement` for everyone
  - add the closing-statement note in `locales/en.json` and `locales/ar.json`
  - extend `lib/security-matrix.test.ts` to pin `canSeeOwnerCosts` (ADMIN only, a
    SUPERVISOR holding every key still denied)
  - **Done when:** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint` and
    `pnpm build` pass, and the new key exists in both locales.

## Files / areas

- `lib/expenses.ts`, `lib/expenses.test.ts`
- `actions/expenses.ts`, `actions/expenses.test.ts`
- `app/(app)/expenses/page.tsx`, `app/(app)/expenses/[id]/page.tsx`,
  `app/(app)/expenses/new/page.tsx`
- `components/expenses/ExpenseFields.tsx`, and the edit and create forms that render
  it
- `lib/reports-data.ts` (`loadExpenseReport`, `loadClosingStatement`),
  `app/(app)/reports/expenses/page.tsx`
- `lib/dashboard-data.ts` (`loadDashboard`), `app/(app)/dashboard/page.tsx`
- `app/(app)/reports/closing/page.tsx` (the note)
- `lib/security-matrix.test.ts`
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- No schema change, migration or new stored state.
- The trusted actor is the session user from `requireSession` or `requirePermission`.
  The role is never read from form data or the URL.
- Action results reuse the existing `ExpenseFormState` codes (`forbidden`,
  `not_found`). An owner row is reported as `not_found` to a non-admin on edit and
  delete, and as a 404 page on details, so its existence is not leaked.
- Money stays `Prisma.Decimal`. The only change to any total is that owner-cost rows
  are filtered out by `category notIn`. The closing statement net formula is
  unchanged; only its salon expense input narrows.
- The query count of each loader is unchanged: filters are added to existing queries.

## Testing

- **Automated:** `pnpm test` (helpers, action guards, security matrix),
  `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`. There is no Verify command or
  browser test command, so none is claimed.
- **Manual** (`pnpm dev`):
  1. As Admin, add a RENT expense this month. It appears in `/expenses`, its details,
     `/reports/expenses` and the dashboard expense total.
  2. As Supervisor: it is absent from the list. `?category=RENT` shows the unfiltered
     list. Its `/expenses/<id>` is a 404, the category select lacks the four owner
     categories, and the report and dashboard totals exclude it.
  3. `/reports/closing` for a month with a RENT entry, as both Admin and Supervisor:
     salon expenses and net kept exclude it, and the note shows.

## Notes for the AI

- Decided with the user: admin-only categories rather than a "paid by owner" flag or
  a separate model, so there is no migration.
- An existing supervisor-entered RENT row simply becomes admin-only. This is expected
  and was disclosed to the user.
- This reverses feature 31's "salon expenses = all categories" for the closing
  statement only. Don't change the closing statement's math elsewhere.
- Keep `OWNER_COST_CATEGORIES` in `lib/expenses.ts` (database-free) so 32b, tests and
  client forms can import it.
- 32b will need the owner-cost totals separately. Don't build that here.

## Implementation notes

- **`expenseWhere`** adds `AND: [SALON_CASH_EXPENSES]` when owner costs are hidden, rather than replacing the category, so even a category filter that names an owner category can never match for a non-admin. `parseExpenseFilters` also drops such a filter, so the list shows unfiltered.
- **Loader flags:** `loadDashboard(permissions, range, today, ownerCosts, timeZone?)` and `loadExpenseReport(range, sections, ownerCosts)` take a required boolean. Callers pass `canSeeOwnerCosts(user)` from the session. The closing loader applies `SALON_CASH_EXPENSES` unconditionally.
- **Forms:** `ExpenseFields`, `ExpenseCreateForm` and `ExpenseEditForm` take a required `categories` prop. The new page and the details page pass `expenseCategoriesFor(user)`.
- **Next.js docs:** no new routing or data API was used (only the existing `requirePermission` and `PageProps` patterns in these pages), so no guide change applied.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10826,"specSha256":"fb228103886bf5f90655a9202ee65dc32dc83b6b7c6cc526643299b126b61672","branch":"refs/heads/feature/owner-cost-categories","head":"e8c93da3f0a0fd532f2b93643506becd25ac0423","baseRef":"refs/heads/main","baseCommit":"49d101b24b3037291323616e95679ab9cf2739d5","sourceTree":"70a676ff6c3271c68413626a9d243c08570dc421","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** e8c93da3f0a0fd532f2b93643506becd25ac0423
**Base commit:** 49d101b24b3037291323616e95679ab9cf2739d5
**Base ref:** refs/heads/main
**Spec hash:** fb228103886bf5f90655a9202ee65dc32dc83b6b7c6cc526643299b126b61672
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-11-18T17:43:02Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-11-18T17:47:24Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm test`: pass (43 files, 920 tests)
- `pnpm build`: pass

### Evidence

- Freshness: HEAD = target, `git merge-base refs/heads/main HEAD` = base, sha256 of `blueprint/context/current-feature.md` = spec hash; reviewed the full `49d101b..e8c93da` delta (22 files).
- Every `salonExpense` reader outside tests was traced: list count and page (`app/(app)/expenses/page.tsx:71,79`, shared `expenseWhere` with `AND: [SALON_CASH_EXPENSES]` for non-admins), details (`app/(app)/expenses/[id]/page.tsx:43` `notFound()`), create/update/delete actions (`actions/expenses.ts:93,128-129,183`), expense report (`lib/reports-data.ts:99-115`), dashboard aggregate and chart (`lib/dashboard-data.ts:48,83,95`, also feeds the profit card), closing statement (`lib/reports-data.ts:373`, unconditional). No other reader exists; the audit log is admin-only.
- The role comes only from the DB-backed session (`lib/auth/session.ts:44-56` via `requireSession`/`requirePermission`); no role or flag is read from form data or the URL. The category select and filter options use `expenseCategoriesFor(user)`, and a non-admin `?category=RENT` is dropped by `parseExpenseFilters`.
- Money totals still sum `Prisma.Decimal` in the existing code; only the where clauses narrowed. No new queries were added to any loader.
- `closingStatement.expenses.ownerCostsNote` exists in both `locales/en.json` and `locales/ar.json`; the note sits outside every `print:hidden` wrapper.
- Tests cover the helpers, all six spec action cases, and the security matrix row (ADMIN only, supervisor with every key denied).

### Findings

- F-72 [P3] open: non-admin edit/delete writes match the id alone after the category check on read (narrow concurrent-admin race).
- F-73 [P3] open: no loader test pins the owner-cost filter in the dashboard, expense report, and closing statement.

### Remaining risk

- Two untracked files (`blueprint/reference/Corporate-Tax-Registration-Certificate.png`, `blueprint/reference/fta-tax-report-emaratax.png`) existed outside the target when this review ran. The freshness contract allows only `review.md` and `findings.md` to differ, so this receipt counts as current only after those files are moved out of the checkout, ignored, or committed. `/complete` enforces this. They are user reference images, not code, and were not reviewed.
- Verify command: unavailable (none defined).
- Browser test command: unavailable (none defined).
- Check was not required and was not run; no runtime or browser evidence of the list, details, report, dashboard, or closing pages as Admin and Supervisor.
