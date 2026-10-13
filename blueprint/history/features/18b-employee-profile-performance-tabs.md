# Feature: Employee profile performance tabs

**From build-plan:** feature 18b
**Build attempt:** 1
**Branch:** feature/employee-profile-performance-tabs
**Status:** verified

## Goal

Add the Invoices and Performance tabs to the employee profile at `/employees/[id]`.
Performance shows the same single-employee view as the 18a report
(`/reports/employees?employee=<id>`): period controls, summary cards, the revenue
trend, and service performance. Invoices lists that employee's invoices, with status and
date filters and pagination. The overview lists the tab order as Overview, Invoices,
Performance, Expenses, Account, Permissions.

## In scope

- **Tab order:** `overview`, `invoices`, `performance`, `expenses`, `account`,
  `permissions`. Each tab shows only when the viewer may see it (rules below). The page's
  entry rule does not change.
- **Performance tab** (`?tab=performance`):
  - Shown when `employeeReportScope(viewer, permissions)` is `"all"`, or `"own"` and the
    profile is the viewer's own. Sections come from `employeeReportSections(scope,
    permissions)`, so deductions and payout follow the 18a rule (shown for your own
    profile; for others only with `employee_expenses.view`).
  - `ReportPeriodControls` with `path="/employees/<id>"` and `params={{ tab: "performance" }}`,
    so presets, grouping, and the custom form stay on this tab. Same period contract
    (`parseRevenueReport`, default `month`, invalid custom range falls back with an alert).
  - The period heading with the UTC `formatRange`, then `EmployeePerformanceDetail` from
    `loadEmployeePerformance(target.id, range, sections)`, with no back link and without its
    employee header (the profile header already shows the employee).
  - Empty states come from the reused view (no invoices in range, no services).
- **Invoices tab** (`?tab=invoices`):
  - Shown when the viewer holds `invoices.view` and is not own scope (`isOwnScope`), or the
    profile is their own.
  - A filter form (GET, `action="/employees/<id>"`, hidden `tab=invoices`): status (all,
    PAID, UNPAID, CANCELLED) and from/to salon days, parsed with `parseInvoiceFilters`
    and narrowed to those three keys. Apply and Clear, as the Expenses tab.
  - A table of the employee's invoices, newest first (`createdAt desc, id desc`), with
    `INVOICE_PAGE_SIZE` per page: invoice number (links to `/transactions/<id>`),
    service, amount (struck through when CANCELLED), status badge, date, created by.
    Every status is listed, as on `/transactions`.
  - Pagination with previous/next and "page X of Y", keeping filters and the tab.
  - Empty states: no invoices yet, and no match for the filters (with Clear).
  - A "View in invoices" link to `/transactions?employee=<id>` for the full filters.
- Remove the code comment "Invoices and Performance join these with feature 18." in
  `app/(app)/employees/[id]/page.tsx`.
- English and Arabic text, RTL-safe layout, Light/Dark themes, tables that scroll
  horizontally.

## Out of scope

- Any change to `/reports/employees`, its loaders, or `/transactions`.
- Changing who can open `/employees/[id]` (still `employees.view`, `permissions.manage`,
  or `employee_expenses.view`). A viewer without any of these, such as default Staff,
  still gets `/forbidden`.
- Moving or changing the overview's earnings panel (feature 16).
- Search, service, employee, or amount filters on the Invoices tab; invoice create,
  edit, or status actions from the profile; export or print.
- Settlement values (feature 19); any schema or migration change.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review packet.
`checkpointCommits` is disabled. `/complete` creates the feature commit.

## Build steps

- [x] **1. Tab rules and invoice tab URL (pure, no DB).**
  - `lib/reports.ts`: `canViewEmployeePerformance(viewer, permissions, targetId)` is
    `true` when `employeeReportScope` is `"all"`, or `"own"` and `targetId === viewer.id`.
  - `lib/invoices.ts`: `canViewEmployeeInvoices(viewer, permissions, targetId)` is `true`
    when `permissions.has("invoices.view")` and (`!isOwnScope(viewer)` or
    `targetId === viewer.id`). Also `EMPLOYEE_INVOICE_FILTER_KEYS = ["status", "from", "to"]` and
    `employeeInvoiceListHref(employeeId, filters, page = 1)`, which builds
    `/employees/<id>?tab=invoices` plus only those filter keys and `page` when > 1.
  - Not `lib/employees.ts`: a client form imports it, and `lib/reports.ts` loads the
    Prisma runtime.
  _Done when:_ `lib/reports.test.ts` and `lib/invoices.test.ts` cover ADMIN on another profile (both true), a
  default SUPERVISOR (both true), a SUPERVISOR without `reports.view_all_employees` but
  with `reports.view_own_performance` (performance only on their own profile), a
  SUPERVISOR without `invoices.view` (no invoices), and STAFF granted every key
  (both only on their own profile). `lib/invoices.test.ts` also covers the href with no
  filters, with all three, ignoring other keys, and page 2. `pnpm test` passes.

- [x] **2. Reusable detail without its header.** `EmployeePerformanceDetail` gets an
  optional `showEmployee` prop (default `true`); when `false` it skips the employee header
  section (avatar, name, role, inactive badge, back link). The report page is unchanged.
  _Done when:_ `/reports/employees` renders as before; `pnpm exec tsc --noEmit` passes.

- [x] **3. Invoices tab.** `components/employees/EmployeeInvoicesTab.tsx` (server
  component, props `employeeId`, `searchParams`, `viewer`), shaped like
  `EmployeeExpensesTab`: filters, `invoiceWhere({ ...filters, employee: employeeId },
  viewer)` for count and page (`resolvePage`), the table, pagination, both empty states,
  and the "View in invoices" link. Reuse `InvoiceStatusBadge`, `LocalDateTime`,
  `PersonName` with `nameLabels` for the creator, and the `invoices` namespace for
  columns, statuses, filters, pagination, and empty text. New keys only where needed,
  under `employees.invoices` (title, description, viewAll).
  _Done when:_ `pnpm exec tsc --noEmit` and `pnpm lint` pass.

- [x] **4. Profile page wiring and translations.** In `app/(app)/employees/[id]/page.tsx`:
  `TAB_ICONS` gains `invoices` (`FileText`) and `performance` (`BarChart3`) in the
  overview's order; tabs are pushed with the step 1 rules; the active tab renders
  `EmployeeInvoicesTab` or a performance section (period controls, heading, detail with
  `showEmployee={false}`) using `salonToday()`, `parseRevenueReport(query, today)`, and
  `getLocale()`. Queries for a tab run only when that tab is active. A `null` from
  `loadEmployeePerformance` gives `notFound()`. Remove the feature 18 comment.
  `locales/en.json` and `locales/ar.json`: `employees.tabs.invoices`,
  `employees.tabs.performance`, and the step 3 keys, in both files.
  _Done when:_ as ADMIN, both tabs render for another employee in EN and AR (RTL), Light
  and Dark; period presets, grouping, and the custom range stay on the Performance tab;
  Invoices filters and pagination stay on the Invoices tab; the numbers match
  `/reports/employees?employee=<id>` for the same period. A default SUPERVISOR sees
  both tabs; one without `employee_expenses.view` sees no deductions or payout. A
  SUPERVISOR without `reports.view_all_employees` sees Performance only on their own
  profile. `?tab=performance` or `?tab=invoices` without permission falls back to the
  first allowed tab. `pnpm lint` and `pnpm exec tsc --noEmit` pass.

- [x] **5. Final verification.** Run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`,
  and `pnpm build`.
  _Done when:_ all four pass, with the results recorded in the review packet.

## Files / areas

- `lib/reports.ts`, `lib/reports.test.ts`
- `lib/invoices.ts`, `lib/invoices.test.ts`
- `components/reports/EmployeePerformanceDetail.tsx` (`showEmployee` prop)
- `components/employees/EmployeeInvoicesTab.tsx` (new)
- `app/(app)/employees/[id]/page.tsx`
- `locales/en.json`, `locales/ar.json`
- Reused, unchanged: `lib/reports.ts` (`employeeReportScope`, `employeeReportSections`,
  `parseRevenueReport`), `lib/reports-data.ts` (`loadEmployeePerformance`),
  `components/reports/ReportPeriodControls.tsx`, `lib/expenses.ts` (`salonToday`,
  `dateValue`), `lib/audit.ts` (`resolvePage`), `components/invoices/InvoiceStatusBadge.tsx`

## Data / contracts

- **URLs:** `/employees/<id>?tab=performance&period=&from=&to=&group=` and
  `/employees/<id>?tab=invoices&status=&from=&to=&page=`. Read-only; no new server actions.
- **Authorization (server, in the page, before any tab query):** the step 1 rules from
  the session user and `getPermissions`. A tab the viewer may not see is never rendered
  or queried; an unknown or forbidden `tab` falls back to the first allowed tab, as now.
  Own-scope viewers only ever get their own profile's tabs; `invoiceWhere` also forces
  `employeeId = viewer.id` for Staff.
- **Performance figures:** exactly the 18a contract (PAID/UNPAID by salon day, CANCELLED
  nowhere, estimated earnings and payout via `calculateSettlement` with `adjustments: 0`).
- **Invoices:** all statuses for `employeeId = <id>`; `from`/`to` filter `createdAt` by
  salon day (`salonDayRange`), as `/transactions`.
- Money stays `Prisma.Decimal` until formatted with `Intl.NumberFormat` currency inside
  `dir="ltr"` and `tabular-nums`. Service and person names render as React text only
  with `dir="auto"`.

## Testing

- Unit (Vitest, `pnpm test`): tab rules in `lib/reports.test.ts` and `lib/invoices.test.ts`;
  `employeeInvoiceListHref` in `lib/invoices.test.ts`.
- No browser test command exists; tab states, roles, EN/AR, Light/Dark, and the figure
  match with the report are confirmed manually during `/check`.

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/` before changing the page
  (`PageProps`, `searchParams` as a Promise).
- The Expenses tab also uses `from`/`to`. Tab links reset the query (`?tab=<key>`), so
  each tab reads only its own params; keep it that way.
- Do not refactor `/transactions` into a shared table; the tab mirrors its markup.
- No Verify command exists, so none was run while writing this spec.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10176,"specSha256":"22b9a4b9fc62ecc0fbf01aea6215c4d5f263d64f0bbd2b804fbce918074161a8","branch":"refs/heads/feature/employee-profile-performance-tabs","head":"1cfb5347ea055bd5b5d6b409a8bd302ba9068698","baseRef":"refs/heads/main","baseCommit":"ae328d1811ff46803e813bd393c88c63c13a71d9","sourceTree":"edebbddae917b8497477e0aa50df9e80e87fdf02","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 1cfb5347ea055bd5b5d6b409a8bd302ba9068698
**Base commit:** ae328d1811ff46803e813bd393c88c63c13a71d9
**Base ref:** main
**Spec hash:** 22b9a4b9fc62ecc0fbf01aea6215c4d5f263d64f0bbd2b804fbce918074161a8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-13T00:35:46Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-13T00:38:31Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `pnpm test`: pass (33 files, 646 tests)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm build`: pass

## Evidence

- Preconditions: `HEAD` = target, `git merge-base main HEAD` = base, raw SHA-256 of tracked `blueprint/context/current-feature.md` matches Spec hash, only `blueprint/context/review.md` differed from the target before review (the tree stayed that way after the build).
- Reviewed all 10 changed files in the delta: `app/(app)/employees/[id]/page.tsx`, `components/employees/EmployeeInvoicesTab.tsx`, `components/reports/EmployeePerformanceDetail.tsx`, `lib/invoices.ts`, `lib/invoices.test.ts`, `lib/reports.ts`, `lib/reports.test.ts`, `locales/en.json`, `locales/ar.json`, and the spec; plus callers and contracts `invoiceWhere`, `parseInvoiceFilters`, `resolvePage`, `employeeReportScope`, `employeeReportSections`, `loadEmployeePerformance`, `ReportPeriodControls`/`reportHref`, `/reports/employees`, `/transactions` and `/transactions/[id]` guards.
- Authorization: the Invoices tab is pushed only when `canViewEmployeeInvoices` holds (`invoices.view` and, for STAFF, target = viewer; `page.tsx:110`, `lib/invoices.ts:69`), and `invoiceWhere` independently forces `employeeId = viewer.id` for STAFF (`lib/invoices.ts:206`). The Performance tab is pushed only when `canViewEmployeePerformance` holds (scope `all`, which requires a non-STAFF role plus `reports.view` and `reports.view_all_employees`, or scope `own` with target = viewer; `lib/reports.ts:252`). Tab components render (and query) only for the active tab, and `activeTab` is chosen only from the allowed list, so a forbidden `?tab=` falls back. No query path exposes another employee's data to an own-scope viewer.
- Deductions/payout on the profile follow `employeeReportSections`, identical to `/reports/employees` (`app/(app)/reports/employees/page.tsx:30`); invoice links lead to `/transactions/[id]`, which re-checks own scope (`:60`).
- Locale key parity between `en.json` and `ar.json` verified programmatically (no missing keys either way).
- Existing ledger entries F-45, F-54, and F-55 re-examined: still open, reach extended to the profile Performance tab; resolution notes added.

## Findings

- None new. Re-examined and still open (P2/P3, non-blocking): F-45, F-54, F-55.

## Remaining risk

- Check was not required and was not run; tab visibility per role, EN/AR RTL, Light/Dark, and the figure match with `/reports/employees` were not observed in a browser.
- No browser test command exists; the page's tab-selection wiring (forbidden `?tab=` fallback) is covered only by code reading, not by an automated test.
- No `Verify` command exists; the four individual commands above were run instead.
