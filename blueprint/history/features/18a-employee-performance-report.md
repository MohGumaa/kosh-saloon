# Feature: Employee performance report

**From build-plan:** feature 18a
**Build attempt:** 1
**Branch:** feature/employee-performance-report
**Status:** verified

## Goal

Give Admins and permitted Supervisors an employee performance report at
`/reports/employees`. For a chosen period (today, this week, this month, this year, or a
custom range) it shows each employee's invoices, paid and unpaid revenue, share
percentage, estimated earnings, deductions, and estimated payout, and opens a
single-employee view with a revenue trend and service performance. Staff with
`reports.view_own_performance` see only their own single-employee view.

## In scope

- New page `/reports/employees`, server-rendered from URL search params (no client
  state). Same period and grouping contract as the revenue and expense reports, parsed by
  `parseRevenueReport` (presets `today`/`week`/`month`/`year`/`custom`, default `month`;
  custom `from <= to <= today`, at most 366 days; `day` grouping up to 62 days; an invalid
  custom range falls back to `month` with an alert and keeps the submitted dates).
- **Two scopes**, decided on the server from the session (see Data / contracts):
  - **all**: the all-employees table, or the single-employee view for `?employee=<id>`.
  - **own**: always the single-employee view of the session user. Any `employee` param
    is ignored, never trusted.
- **All-employees table:** one row per employee with PAID or UNPAID invoices or
  deductions in the range (inactive included, with the existing "inactive" badge).
  Columns: employee (avatar + label), invoices (PAID + UNPAID count), paid revenue,
  unpaid, share %, estimated earnings, deductions, estimated payout. Sorted by paid
  revenue desc, then name. The name links to the single-employee view and keeps the
  period. A totals row sums the money and count columns (no share % total). Empty state
  when no employee has activity in the range.
- **Single-employee view:** employee header (avatar, full name, role, inactive badge); in
  scope `all`, a back link to the table that keeps the period. Then:
  - Summary `StatCard`s: paid revenue (paid count hint), unpaid (unpaid count hint),
    share % (hint: own or salon default), estimated earnings, deductions (entry count
    hint), estimated payout.
  - **Trend:** `RevenueChart` (paid/unpaid, no expenses) plus a table per bucket:
    period, invoices, paid, unpaid, gross, with a totals row. Empty state when the
    employee has no invoices in range.
  - **Service performance:** service (translated name, inactive badge), invoices, paid,
    gross, reusing `breakdownRows`. Empty state when none.
- **Deductions section flag:** in scope `all`, the deductions and estimated payout
  figures (columns, cards, totals) are shown and queried only with
  `employee_expenses.view`. In scope `own`, the viewer's own deductions are always shown,
  matching the Staff dashboard.
- Earnings and payout are **estimates**, labelled as such: the same rule the Staff
  dashboard uses (feature 15). See Data / contracts.
- Period controls keep the `employee` param (links and the custom form).
- `loading.tsx` skeleton for the route.
- Enable the sidebar's Reports → Employee Performance item (`href: "/reports/employees"`)
  and align its visibility with the page rule.
- English and Arabic text, RTL-safe layout, Light/Dark themes, and responsive tables
  (horizontal scroll).

## Out of scope

- The Performance and Invoices tabs on `/employees/[id]` (feature 18b). The code comment
  in `app/(app)/employees/[id]/page.tsx` stays as is.
- Frozen settlement values, approval or paid status, and pending adjustments (feature 19
  and the settlements pages).
- An employee picker other than the table links; export, print, PDF, emails;
  comparisons with earlier periods; charts on the all-employees table.
- A `/reports` landing page; any schema or migration change.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review packet.
`checkpointCommits` is disabled. `/complete` creates the feature commit.

## Build steps

- [x] **1. Keep extra params in the period controls.**
  - `lib/reports.ts`: `reportHref(path, range, change, today, keep?)` where `keep` is a
    `Record<string, string>` appended after the period params (only non-empty values).
    Existing callers are unchanged.
  - `components/reports/ReportPeriodControls.tsx`: optional `params?: Record<string,
    string>` prop, passed to `reportHref` and rendered as hidden inputs in the custom
    form.
  _Done when:_ `lib/reports.test.ts` covers `keep` with a preset change, a group change,
  and a custom range; the revenue and expense reports are unchanged;
  `pnpm test` and `pnpm exec tsc --noEmit` pass.

- [x] **2. Report rules (pure, no DB).** In `lib/reports.ts`:
  - `employeeReportScope(user, permissions): "all" | "own" | null`:
    `"all"` when `!isOwnScope(user) && has("reports.view") &&
    has("reports.view_all_employees")`; otherwise `"own"` when
    `has("reports.view_own_performance")`; otherwise `null`.
  - `employeeReportSections(scope, permissions)` → `{ expenses: scope === "own" ||
    has("employee_expenses.view") }`.
  - `employeePerformanceRows(input)`: takes invoice groups (`employeeId`, `status`,
    `_sum.amount`, count), deduction groups (`employeeId`, sum, count), user details
    (`id`, `name`, `image`, `isActive`, `sharePercentage`), and the salon share %.
    Returns one row per id present in either group and in details, with `paidCount`,
    `unpaidCount`, `paid`, `unpaid`, `share` (from `effectiveSharePercentage`), and
    `calculateSettlement({ paidRevenue, sharePercentage, expenses, adjustments: 0 })`
    for `earnings` (`employeeShare`), `expenses`, and `payout` (`finalAmount`). CANCELLED
    groups are ignored. Sorted by `paid` desc, then name with `localeCompare(locale)`.
  _Done when:_ `lib/reports.test.ts` covers scope for ADMIN, default SUPERVISOR (all),
  SUPERVISOR without `reports.view_all_employees` but with
  `reports.view_own_performance` (own), SUPERVISOR with neither (null), default STAFF
  (own), STAFF granted every key (own, never all); the `expenses` flag in both scopes;
  and rows for the worked example (paid 5,000, 50%, deductions 300 → earnings 2,500,
  payout 2,200), a per-employee 0% override, an employee with deductions only, CANCELLED
  ignored, a missing detail dropped, and the sort. `pnpm test` passes.

- [x] **3. Data loaders.** In `lib/reports-data.ts`:
  - `loadEmployeePerformanceList(range, sections)`: one `Promise.all` of
    `getSalonSettings()`, `invoice.groupBy(["employeeId", "status"])` (PAID/UNPAID,
    `createdAt: salonDayRange(from, to)`, as `loadRevenueReport`), and, when
    `sections.expenses`, `employeeExpense.groupBy(["employeeId"])` (`date` between
    `dateValue(from)` and `dateValue(to)`, as `loadExpenseReport`). Then one
    `user.findMany` for the union of ids (`id`, `name`, `image`, `isActive`,
    `sharePercentage`). Returns `currency`, the rows from `employeePerformanceRows`, and
    totals.
  - `loadEmployeePerformance(employeeId, range, sections)`: returns `null` when the user
    does not exist. Otherwise, every query filtered by that `employeeId`: invoice
    `findMany` (`createdAt`, `amount`, `status`) for `bucketInvoices`, invoice
    `groupBy(["serviceId", "status"])` plus `service.findMany` for details, and, when
    `sections.expenses`, an `employeeExpense.aggregate` (`_sum.amount`, `_count`) for the
    range. Figures use the same `calculateSettlement` rule as step 2.
  Money stays `Prisma.Decimal`.
  _Done when:_ `pnpm exec tsc --noEmit` passes. During `/check`, figures for one employee
  and month match the revenue report's by-employee row (paid, gross) and the employee's
  Expenses tab (deductions), and earnings match the profile's earnings panel for a full
  month.

- [x] **4. Page, views, loading, nav, translations.**
  - `app/(app)/reports/employees/page.tsx`: `requireSession` → `getPermissions` →
    `employeeReportScope`; `null` → `redirect("/forbidden")` before any query. Parse with
    `salonToday()`. The target id is `user.id` in scope `own`, otherwise
    `first(params.employee)` (none → the list). A missing employee → `notFound()`.
    Renders the title, `ReportPeriodControls` (`path="/reports/employees"`,
    `params={{ employee }}` only in the single view of scope `all`), the period heading
    with the UTC `formatRange`, then the list or single view.
  - `components/reports/EmployeePerformanceList.tsx` and
    `components/reports/EmployeePerformanceDetail.tsx` (server components) render the two
    views. Money, bucket labels, `EmptyState`, panel classes, avatar and `employeeLabels`
    name labels (`dir="auto"`, React text only; full name in `title` when shortened),
    and the inactive badge follow the revenue page. Share % uses `Intl.NumberFormat`
    percent with up to 2 decimals, as the earnings panel does. Estimated values carry an
    "estimated" label or hint. Tables use `<caption>` or `aria-labelledby` and
    `<th scope="col">`/`<th scope="row">`.
  - `app/(app)/reports/employees/loading.tsx`: skeleton with `role="status"` and an
    sr-only label.
  - `lib/navigation.ts`: the `employeePerformance` item gets `href: "/reports/employees"`
    and `permissions: ["reports.view_all_employees", "reports.view_own_performance"]`.
    Update `lib/navigation.test.ts` for the href.
  - `locales/en.json`, `locales/ar.json`: new `employeeReport` namespace (title,
    description, loading, back, summary titles/hints, estimated note, column headings,
    totals, inactive, section titles, captions, empty states).
  _Done when:_ as ADMIN, the table and a single view render in EN and AR (RTL), Light and
  Dark, and the period controls keep the employee. A default SUPERVISOR sees the same;
  one without `employee_expenses.view` sees no deductions or payout. A default STAFF sees
  only their own view, and `?employee=<other id>` still shows their own. A SUPERVISOR
  without `reports.view_all_employees` and `reports.view_own_performance` gets
  `/forbidden` and no nav item. An unknown `employee` id gives the not-found page.
  `pnpm lint` and `pnpm exec tsc --noEmit` pass.

- [x] **5. Final verification.** Run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`,
  and `pnpm build`.
  _Done when:_ all four pass, with the results recorded in the review packet.

## Files / areas

- `lib/reports.ts`, `lib/reports.test.ts`
- `lib/reports-data.ts`
- `components/reports/ReportPeriodControls.tsx`
- `components/reports/EmployeePerformanceList.tsx` (new)
- `components/reports/EmployeePerformanceDetail.tsx` (new)
- `components/reports/ReportEmptyState.tsx` (new; the empty state both views share)
- `app/(app)/reports/employees/page.tsx`, `app/(app)/reports/employees/loading.tsx` (new)
- `lib/navigation.ts`, `lib/navigation.test.ts`
- `locales/en.json`, `locales/ar.json`
- Reused, unchanged: `lib/earnings.ts` (`effectiveSharePercentage`),
  `lib/settlements.ts` (`calculateSettlement`), `lib/dashboard.ts` (`chartBuckets`,
  `bucketInvoices`, `first`), `lib/names.ts`, `components/dashboard/StatCard.tsx`,
  `components/dashboard/RevenueChart.tsx`, `components/layout/UserAvatar.tsx`

## Data / contracts

- **URL:** `/reports/employees?period=&from=&to=&group=&employee=<user id>`. `employee`
  is read only in scope `all`. No new server actions; read-only page.
- **Authorization (server, before any query):** scope from `employeeReportScope`. Own
  scope always uses `user.id` from the session. ADMIN holds every key, so always `all`.
- **Invoices:** PAID and UNPAID only, by `createdAt` within the salon days of the range
  (`salonDayRange`). CANCELLED counts nowhere. Paid revenue = PAID sum; unpaid shown
  separately; gross = paid + unpaid.
- **Deductions:** `EmployeeExpense` rows with `date` in `[from, to]` (calendar dates).
- **Estimated earnings and payout** (the user-approved rule, same as the Staff
  dashboard): share % = the employee's own `sharePercentage` when set (0 included),
  otherwise the salon's current `employeeSharePercentage`;
  `calculateSettlement({ paidRevenue, sharePercentage, expenses, adjustments: 0 })`;
  earnings = `employeeShare` (rounded to 2 decimals, half up); payout = `finalAmount`,
  which can be negative. Pending adjustments and stored settlements are not used.
  Without the deductions flag, earnings are still shown; deductions and payout are not.
- **List totals:** sums of the row values (count, paid, unpaid, earnings, deductions,
  payout).
- All money is `Prisma.Decimal` until formatted; formatting uses
  `Intl.NumberFormat(locale, { style: "currency", currency })` inside `dir="ltr"` with
  `tabular-nums`.

## Testing

- Unit (Vitest, `pnpm test`): `reportHref` with `keep`, `employeeReportScope`,
  `employeeReportSections`, and `employeePerformanceRows` in `lib/reports.test.ts`;
  navigation href in `lib/navigation.test.ts`.
- No browser test command exists; the page states are confirmed manually during
  `/check` (roles, EN/AR, Light/Dark, empty range, unknown id).

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/` before writing the page
  (`PageProps`, `notFound`, `searchParams` as a Promise), as the existing report pages do.
- Mirror `app/(app)/reports/revenue/page.tsx` for structure and styling. Do not
  refactor the revenue or expense pages beyond step 1.
- Never trust `employee` for Staff; never query another user's data in scope `own`.
- User names are rendered as React text only.
- No Verify command exists, so none was run while writing this spec.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13835,"specSha256":"2c33082c0dbeb7ec2ed72d002cf705e817baffbe3326f2faf5cdb87c1f9815cc","branch":"refs/heads/feature/employee-performance-report","head":"70c7b240e5fd27eddb56d77948a43aa2a7967277","baseRef":"refs/heads/main","baseCommit":"43348b6bf78767e4a0b9349e24797adaee57ea5a","sourceTree":"96f27bc3b328b8bd54b705de22d336888c5fa248","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 70c7b240e5fd27eddb56d77948a43aa2a7967277
**Base commit:** 43348b6bf78767e4a0b9349e24797adaee57ea5a
**Base ref:** main
**Spec hash:** 2c33082c0dbeb7ec2ed72d002cf705e817baffbe3326f2faf5cdb87c1f9815cc
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T23:48:04Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T23:53:07Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `pnpm test`: pass (33 files, 642 tests)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm build`: pass (`/reports/employees` compiled as a dynamic route)

## Evidence

- Preconditions: `HEAD` is `70c7b24`, `git merge-base main HEAD` is `43348b6`, the spec's raw SHA-256 matches, and the only working-tree change is `blueprint/context/review.md`.
- Reviewed the full `43348b6..70c7b24` delta (15 files): `app/(app)/reports/employees/page.tsx` and `loading.tsx`, `components/reports/EmployeePerformanceList.tsx`, `EmployeePerformanceDetail.tsx`, `ReportEmptyState.tsx`, `ReportPeriodControls.tsx`, `lib/reports.ts`, `lib/reports-data.ts`, `lib/navigation.ts`, both test files, both locales, the spec, and `blueprint/build-plan.md`.
- Security: the page resolves scope from the session before any query and redirects `null` to `/forbidden`; scope `own` always uses `user.id` and ignores `employee`; deduction queries run only when `employeeReportSections` allows; ids are `cuid` strings, so an arbitrary `employee` param reaches `findUnique` safely and an unknown id gives `notFound()`; names render as React text only.
- Correctness: figures reuse `effectiveSharePercentage` and `calculateSettlement` with `adjustments: 0`; CANCELLED is excluded in queries and in `employeePerformanceRows`; money stays `Prisma.Decimal` until formatting; the worked example (5,000 at 50% less 300 gives 2,200), 0% override, rounding, deductions-only, and sort are unit-tested.
- `employeeReport` has the same 41 keys in `locales/en.json` and `locales/ar.json`; no em dash, en dash, or ellipsis characters were added in code or locales.
- Performance: the list runs one parallel batch plus one `user.findMany`; the single view loads one employee's invoice rows for the range (bounded to 366 days), the same shape as F-46.

## Findings

- New: F-53 [P3] open, F-54 [P3] open, F-55 [P3] open
- Re-examined, still open: F-45 [P2] (the chart now also renders on the single-employee view), F-52 [P3] (a third `bucketLabel` copy was added)
- No P0 or P1 finding is open or fixed

## Remaining risk

- No Verify command is declared, so none was run.
- No browser test command is declared; no browser automation ran.
- No live or authenticated page check ran (no dev server): EN/AR RTL layout, Light/Dark themes, the role and permission page states, the unknown-id not-found page, and period controls keeping `employee` are unobserved.
- `/check` was not required and did not run, so the spec's cross-report figure match (revenue by-employee row, Expenses tab, earnings panel) is not confirmed against real data.
- The loader wiring (employee filter, deduction gating) is verified by reading only; no test pins it (F-55).
