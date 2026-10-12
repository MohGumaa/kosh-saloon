# Feature: Expense reports

**From build-plan:** feature 17
**Build attempt:** 1
**Branch:** feature/expense-reports
**Status:** verified

## Goal

Give Admins and permitted Supervisors an expense report at `/reports/expenses`:
salon expenses and employee deductions for a chosen period (today, this week, this
month, this year, or a custom range), with totals, a breakdown over time (by day,
week, or month), totals by category, and employee deductions by employee.

## In scope

- New page `/reports/expenses`, server-rendered from URL search params (no client
  state). Same period and grouping contract as `/reports/revenue`, parsed by the
  existing `parseRevenueReport` (presets `today`/`week`/`month`/`year`/`custom`,
  default `month`; custom `from <= to <= today`, at most 366 days; `day` grouping
  only up to 62 days; an invalid custom range falls back to `month` with an alert
  and keeps the submitted dates).
- **Two independent sections**, each shown and queried only when allowed:
  - **Salon expenses** (`SalonExpense`), needs `expenses.view`.
  - **Employee deductions** (`EmployeeExpense`), needs `employee_expenses.view`.
- **Summary cards** (per allowed section): total salon expenses with the entry
  count as hint; total employee deductions with the entry count as hint.
- **Expenses over time:** a table with one row per bucket: period, then one amount
  column per allowed section (salon expenses, employee deductions), and a totals
  row. The two kinds are never added together (see Data / contracts).
- **Salon expenses by category:** category (translated), entries, total. Only
  categories with at least one entry in range, sorted by total desc, then label.
- **Employee deductions by category:** same shape for `EmployeeExpenseCategory`.
- **Employee deductions by employee:** employee (avatar + name, inactive included),
  entries, total; sorted by total desc, then name. Shown and queried **only** when
  the viewer also holds `reports.view_all_employees`.
- Empty states for the time table and each breakdown table when the range has no
  entries of that kind.
- `loading.tsx` skeleton for the route.
- Reuse the revenue report's period/grouping controls on this page by giving them a
  target path (see step 1).
- Enable the sidebar's Reports → Expenses item (`href: "/reports/expenses"`).
- English and Arabic text, RTL-safe layout, Light/Dark themes, and responsive
  tables (horizontal scroll).

## Out of scope

- A combined "net" or profit figure (revenue minus expenses); see Open questions.
- A chart; the over-time breakdown is a table.
- Category or employee filters, drill-down links to individual expenses, export,
  print, PDF, emailed reports, comparisons with earlier periods.
- Employee performance, employee earnings, and settlement reports (features 18–19);
  a `/reports` landing page; staff/own views.
- Any schema or migration change; any change to expense create/edit/list pages.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet. `checkpointCommits` is disabled. `/complete` creates the feature commit.

## Build steps

- [x] **1. Share the period controls between reports.**
  - `lib/reports.ts`: `revenueReportHref` becomes `reportHref(path, range, change,
    today)` (same rules, the path replaces the hard-coded `/reports/revenue`).
    Update its callers and tests.
  - Rename `components/reports/RevenueReportControls.tsx` to
    `components/reports/ReportPeriodControls.tsx` with a `path` prop used for the
    links and the form `action`. Element ids become `report-from`, `report-to`, and
    `report-range-error`.
  - Move the `periods`, `custom`, and `group` keys from the `revenueReport` locale
    namespace to a new `reportPeriod` namespace in `locales/en.json` and
    `locales/ar.json`; the component reads `reportPeriod`.
  - `app/(app)/reports/revenue/page.tsx` uses the renamed component with
    `path="/reports/revenue"`.
  _Done when:_ the revenue report behaves exactly as before (links, custom form,
  invalid alert), `lib/reports.test.ts` passes with the renamed helper and a case
  for a second path, and `pnpm exec tsc --noEmit` passes.

- [x] **2. Expense report rules (pure, no DB).** In `lib/reports.ts`:
  - `canViewExpenseReport(user, permissions)`: `!isOwnScope(user) &&
    permissions.has("reports.view") && (permissions.has("expenses.view") ||
    permissions.has("employee_expenses.view"))`.
  - `expenseSections(permissions)` → `{ salon: has("expenses.view"), employee:
    has("employee_expenses.view"), byEmployee: has("employee_expenses.view") &&
    has("reports.view_all_employees") }`.
  - `expenseBreakdown(rows, details, nameOf, locale?)`: rows of `{ id, amount:
    Decimal | null, count }` → `{ id, detail, count, total }`, dropping ids without
    details, sorted by total desc then `nameOf` with `localeCompare`.
  _Done when:_ `lib/reports.test.ts` covers ADMIN, default SUPERVISOR, SUPERVISOR
  with `reports.view` but neither expense permission (denied), SUPERVISOR with only
  one expense permission (allowed, one section), STAFF granted every key (denied);
  each `expenseSections` flag; and `expenseBreakdown` sorting, null sums, and
  missing details. `pnpm test` passes.

- [x] **3. Data loader.** In `lib/reports-data.ts`, add
  `loadExpenseReport(range, sections)`. Date filter for both models:
  `date: { gte: dateValue(from), lte: dateValue(to) }` (as the dashboard does).
  One `Promise.all`, each query skipped (`null`) when its section is off:
  - `getSalonSettings()` for `currency`.
  - salon: `salonExpense.findMany` (`date`, `amount`) and
    `salonExpense.groupBy(["category"])` with `_sum.amount`, `_count`.
  - employee: `employeeExpense.findMany` (`date`, `amount`) and
    `employeeExpense.groupBy(["category"])`.
  - byEmployee: `employeeExpense.groupBy(["employeeId"])`, then one
    `user.findMany` (`id`, `name`, `image`, `isActive`) for the grouped ids.
  Buckets use `chartBuckets(from, to, group)` and the existing `bucketExpenses`.
  Section totals are the sums of the buckets; counts are the row counts. Money
  stays `Prisma.Decimal`.
  _Done when:_ `pnpm exec tsc --noEmit` passes. Totals are compared with the
  `/expenses` list and an employee's Expenses tab for the same dates during `/check`.

- [x] **4. Page, loading, nav, translations.**
  - `app/(app)/reports/expenses/page.tsx`: `requireSession` → `getPermissions` →
    `canViewExpenseReport`, otherwise `redirect("/forbidden")`, before any query.
    Parse with `salonToday()`, load, and render: the period heading with the
    formatted range (UTC `formatRange`), `ReportPeriodControls`
    (`path="/reports/expenses"`), the summary `StatCard`s, the over-time table, the
    category tables, and the by-employee table (gated). Bucket labels, panel
    classes, `EmptyState`, money (`Intl.NumberFormat` currency, `dir="ltr"`,
    `tabular-nums`), and name rendering (`dir="auto"`, React text only;
    `employeeLabels` + `UserAvatar`) follow the revenue page. Category labels come
    from the existing `expenses.categories` / employee-expense `categories` keys.
    Tables use `<caption>` or `aria-labelledby` to their heading, and `<th
    scope="col">` headers.
  - `app/(app)/reports/expenses/loading.tsx`: skeleton with `role="status"` and an
    sr-only label.
  - `lib/navigation.ts`: the `expenses` report item gets
    `href: "/reports/expenses"`; its visibility rule (`reports.view`) stays. Update
    `lib/navigation.test.ts` if it asserts that item is disabled.
  - `locales/en.json`, `locales/ar.json`: new `expenseReport` namespace (title,
    description, loading, section titles, summary titles/hints, table headings,
    totals, empty states).
  _Done when:_ as ADMIN, all sections render in EN and AR (RTL), Light and Dark. A
  default SUPERVISOR sees every section. A SUPERVISOR without
  `reports.view_all_employees` sees no by-employee table; one without
  `employee_expenses.view` sees only salon sections (and vice versa). STAFF and a
  SUPERVISOR without `reports.view` are redirected to `/forbidden` and do not see
  the nav item. `pnpm lint` and `pnpm exec tsc --noEmit` pass.

- [x] **5. Final verification.** Run `pnpm test`, `pnpm lint`,
  `pnpm exec tsc --noEmit`, and `pnpm build`.
  _Done when:_ all four pass, with the results recorded in the review packet.

## Files / areas

- `lib/reports.ts`, `lib/reports.test.ts`
- `lib/reports-data.ts`
- `components/reports/RevenueReportControls.tsx` → `components/reports/ReportPeriodControls.tsx`
- `app/(app)/reports/revenue/page.tsx` (controls rename only)
- `app/(app)/reports/expenses/page.tsx`, `app/(app)/reports/expenses/loading.tsx` (new)
- `lib/dashboard.ts` (`chartBuckets`, `bucketExpenses`, reused unchanged)
- `components/dashboard/StatCard.tsx`, `components/layout/UserAvatar.tsx`, `lib/names.ts` (reused)
- `lib/navigation.ts` (+ test if affected)
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- **No schema change.** Reads `SalonExpense` (`category`, `amount`, `date`),
  `EmployeeExpense` (`employeeId`, `category`, `amount`, `date`), `User` (`name`,
  `image`, `isActive`), and `SalonSettings.currency`.
- **Day rule:** an expense belongs to its stored calendar `date` (not `createdAt`),
  both range ends included.
- **Totals:** a section total is the plain sum of its entries' `amount`; entries
  = row count. No tax.
- **Salon expenses and employee deductions are never summed together.** Salon
  expenses are business costs; employee deductions reduce an employee's payout.
  Mixing them would invent a money rule.
- **URL contract:** `/reports/expenses?period=today|week|month|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|week|month`,
  identical rules and fallbacks to `/reports/revenue`. Nothing throws on bad params.
- **Authorization (server):** the page needs a non-STAFF role, `reports.view`, and
  at least one of `expenses.view` / `employee_expenses.view`. Each section's
  queries run only when its flag is true; by-employee also needs
  `reports.view_all_employees`. Permissions come from the session via
  `getPermissions`, never from params. Read-only; no audit entries.
- A viewer with `reports.view` but neither expense permission still sees the nav
  item (the nav matches any listed key, as for the revenue item) and gets
  `/forbidden`; accepted, same as the existing revenue item for edge grants.

## Testing

- Unit (Vitest, `pnpm test`): additions to `lib/reports.test.ts` as listed in
  steps 1–2.
- No browser test command exists. Visual, RTL, totals, and per-role behavior are
  checked manually in `/check`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for App Router pages, `searchParams` (a
  Promise, typed via `PageProps<"/reports/expenses">`), and `loading.tsx` before
  writing them.
- Model the page on `app/(app)/reports/revenue/page.tsx`; extract nothing from it
  beyond the controls in step 1 unless a helper is clearly identical.
- Loading every in-range expense row (at most 366 days) for bucketing is fine for
  one salon. No raw SQL.
- Verify the exact locale key path for employee-expense categories in
  `locales/en.json` before using it.

## Open questions

Not blocking. The spec uses the choice below; say so at review if you want something else.

- **"Financial summaries":** the spec reads this as per-section totals and entry
  counts, over time and by category/employee. A net figure (paid revenue minus
  salon expenses, possibly minus payouts) is left out because its definition is a
  money rule the plans do not set.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11574,"specSha256":"5c452997c7937da46f63bf34017177e69f8563059f51a15a3cc5d9b97ede3513","branch":"refs/heads/feature/expense-reports","head":"cfb575182d256b8e12d92b90b95f07a830bdf286","baseRef":"refs/heads/main","baseCommit":"30c674e0784ccb7fbbcb147533215282f3efbb76","sourceTree":"7b6fd0d535e19cc9f325714114b4c04474db8e76","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** cfb575182d256b8e12d92b90b95f07a830bdf286
**Base commit:** 30c674e0784ccb7fbbcb147533215282f3efbb76
**Base ref:** main
**Spec hash:** 5c452997c7937da46f63bf34017177e69f8563059f51a15a3cc5d9b97ede3513
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T22:53:34Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T23:01:12Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed before this pass; spec is tracked, no snapshot field)
- `pnpm test`: pass (33 files, 630 tests)
- `pnpm lint`: pass (no output)
- `pnpm exec tsc --noEmit`: pass (no `next typegen` needed)
- `pnpm build`: unavailable (not run by this reviewer)

## Evidence

- Authorization: `app/(app)/reports/expenses/page.tsx:47` to `:49` runs `requireSession` -> `getPermissions` -> `canViewExpenseReport` and redirects before any query; `canViewExpenseReport` (`lib/reports.ts:176`) denies STAFF via `isOwnScope` and requires `reports.view` plus one expense view; `expenseSections` gates `byEmployee` on `employee_expenses.view` and `reports.view_all_employees`. Permissions come only from the session (`lib/auth/authorize.ts:20`).
- Query gating: `loadExpenseReport` (`lib/reports-data.ts:93` to `:150`) passes `null` instead of each salon, employee, and by-employee query when its flag is off, and runs `user.findMany` only for grouped employee ids.
- Date filter: one `where = { date: { gte: dateValue(from), lte: dateValue(to) } }` on the `@db.Date` column for all five expense queries; `bucketExpenses` buckets by `dayOf(row.date)`, and `chartBuckets` covers every in-range day, so section totals equal the sum of in-range rows.
- Money: amounts stay `Prisma.Decimal` (sums via `plus`, `_sum.amount`), salon expenses and employee deductions are separate columns/cards and never added; formatting matches the revenue page (`Intl.NumberFormat` currency, `dir="ltr"`, `tabular-nums`). `EmployeeExpense.employee` is `onDelete: Restrict`, so the by-employee table's footer (section totals) matches its rows.
- Rendering and accessibility: user names rendered as React text with `dir="auto"`; tables have `aria-labelledby` or an sr-only `<caption>`, `<th scope="col">` and row headers; loading skeleton has `role="status"` and an sr-only label; tables scroll horizontally.
- Translations: every `expenseReport`, `reportPeriod`, `expenses.categories.*` (all 9 `ExpenseCategory` values) and `employeeExpenses.categories.*` (all 5 values) key used exists in both `locales/en.json` and `locales/ar.json`; the two files have identical key sets; the revenue page and controls use only keys that still exist after the namespace move.
- URL contract: reuses `parseRevenueReport` unchanged; `reportHref` only swaps the hard-coded path and has a new second-path test.

## Findings

- F-51 [P3] open: no test pins the per-section query skipping and the `date` filter in `loadExpenseReport`
- F-52 [P3] open: `EmptyState`, table classes, and week bucket label copied from the revenue page
- F-50 [P3] re-examined, still open: the Expenses nav item now has the same Staff-with-`reports.view` dead link as Revenue
- No P0 or P1 findings

## Remaining risk

- `pnpm build` not run by this reviewer (unavailable in this pass); the spec's step 5 lists it, so the builder's build result is unverified here.
- No browser test command exists and `/check` was not required: EN/AR RTL layout, Light/Dark, per-role rendering, and totals against `/expenses` were not observed in a running app.
- Loading every in-range expense row (up to 366 days) for bucketing was accepted by the spec; not profiled.
