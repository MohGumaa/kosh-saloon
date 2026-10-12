# Feature: Revenue reports

**From build-plan:** feature 16
**Build attempt:** 1
**Branch:** feature/revenue-reports
**Status:** verified

## Goal

Give Admins and permitted Supervisors a revenue report at `/reports/revenue`:
gross, paid, and unpaid revenue for a chosen period (today, this week, this month,
this year, or a custom range), broken down over time (by day, week, or month), by
service, and by employee.

## In scope

- New page `/reports/revenue`, server-rendered from URL search params (no client state).
- **Periods** (`period` param): `today`, `week` (Monday to today), `month` (1st to
  today, the default), `year` (1 January to today), `custom` (`from`/`to`,
  `YYYY-MM-DD`). For custom: `from <= to <= today`, at most 366 days, both ends
  included. Same rules as the dashboard. An invalid custom range falls back to
  `month` and shows an alert, keeping the submitted dates in the form.
- **Grouping** (`group` param): `day`, `week`, `month`. `day` is only offered and
  accepted when the range is at most 62 days (`DAILY_MAX_DAYS`). The default is
  `day` up to 62 days, otherwise `month`. An unknown or disallowed `group` silently
  uses the default.
- **Summary cards:** gross revenue (paid + unpaid), paid revenue, unpaid revenue,
  and invoice count (PAID + UNPAID).
- **Revenue over time:** the existing `RevenueChart` (paid/unpaid stacked, expenses
  off), plus a visible table with one row per bucket: period, invoices, paid,
  unpaid, gross, and a totals row.
- **Revenue by service:** a table of every service with at least one PAID or UNPAID
  invoice in range, including inactive services. Columns: service (name in the
  current locale), invoices, paid, unpaid, gross. Sorted by gross desc, then name.
- **Revenue by employee:** the same table per employee, including inactive
  employees. Shown and queried **only** when the viewer holds
  `reports.view_all_employees`.
- Empty states for the chart/time table and both breakdown tables when the range
  has no PAID/UNPAID invoices.
- `loading.tsx` skeleton for the route.
- Enable the sidebar's Reports → Revenue item (`href: "/reports/revenue"`).
- English and Arabic text, RTL-safe layout, Light/Dark themes, and responsive
  tables (horizontal scroll).

## Out of scope

- Expense, employee performance, employee earnings, services, and settlement
  report pages (features 17–19); a `/reports` landing page.
- Staff/own-performance views (feature 18).
- Export, print, PDF, emailed reports, comparisons with earlier periods.
- Tax: no tax is applied (V1 rule).
- Any schema or migration change.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet. `checkpointCommits` is disabled. `/complete` creates the feature commit.

## Build steps

- [x] **1. Week buckets and per-bucket counts in shared bucketing.** In
  `lib/dashboard.ts`, add `"week"` to `Granularity`. `chartBuckets` then returns
  each Monday key (`weekStart`) from `weekStart(from)` through `weekStart(to)`, and
  `bucketKey` maps a day to its Monday. Add `paidCount` / `unpaidCount` to
  `InvoiceBucket` from `bucketInvoices`. `parseDashboardPeriod` never produces
  `week`, so the dashboard's behavior does not change.
  _Done when:_ new cases in `lib/dashboard.test.ts` cover week keys across a
  month/year boundary, week bucketing, and counts. Existing dashboard tests still
  pass under `pnpm test`.

- [x] **2. Report rules (pure, no DB).** New `lib/reports.ts`:
  - `REVENUE_PERIODS`, `parseRevenueReport(params, today)` returning
    `{ period, from, to, group, allowedGroups, invalidCustom, submitted }`. Reuse
    `addDays`, `weekStart`, `daysInRange`, `presetRange`, `CUSTOM_MAX_DAYS`,
    `DAILY_MAX_DAYS`, and `isCalendarDate`, and add only the `year` preset.
  - `canViewRevenueReport(user, permissions)`: `!isOwnScope(user) &&
    permissions.has("reports.view")`. STAFF are always denied, even with a
    granted `reports.view`, matching the salon dashboard.
  - `revenueSections(permissions)` → `{ byEmployee:
    permissions.has("reports.view_all_employees") }`.
  - `breakdownRows(groupRows)`: merges Prisma `groupBy` rows keyed by id + status
    into `{ id, count, paid, unpaid, gross }` (Decimal), sorted by gross desc.
    The page breaks ties by name.
  - `revenueReportHref(range, overrides)` builds preset, group, and custom links
    that keep the other params, and omits default values.
  _Done when:_ `lib/reports.test.ts` covers each preset (including `year` and
  `week` on a Monday and a Sunday), custom valid/invalid (reversed, future,
  > 366 days, malformed), group defaults/fallbacks (`day` refused at 63 days),
  permission cases (ADMIN, default SUPERVISOR, SUPERVISOR without `reports.view`,
  STAFF granted `reports.view`), the `byEmployee` gate, and `breakdownRows` with
  CANCELLED excluded upstream. `pnpm test` passes.

- [x] **3. Data loader.** New `lib/reports-data.ts`, with
  `loadRevenueReport(range, sections, timeZone = SALON_TIME_ZONE)`. All queries use
  `status in [PAID, UNPAID]` and `createdAt: salonDayRange(from, to, timeZone)`, run
  in one `Promise.all`:
  - `invoice.findMany` (`createdAt`, `amount`, `status`) → `bucketInvoices` with
    `chartBuckets(from, to, group)`. The summary totals are the sums of the buckets.
  - `invoice.groupBy(["serviceId", "status"])` with `_sum.amount` and `_count`,
    then one `service.findMany` for names (`nameEn`, `nameAr`, `isActive`).
  - Only when `sections.byEmployee`: `invoice.groupBy(["employeeId", "status"])`,
    then one `user.findMany` for `name`.
  - `getSalonSettings()` for `currency`.
  Returns Decimals for money (number conversion happens only for the chart).
  _Done when:_ `pnpm exec tsc --noEmit` passes. Totals are checked against the
  invoice list's filtered totals during `/check`.

- [x] **4. Page, selector, loading, nav, translations.**
  - `app/(app)/reports/revenue/page.tsx`: `requireSession` → `getPermissions` →
    `canViewRevenueReport`, otherwise `redirect("/forbidden")`. This check runs
    before any query. Parse with `salonToday()`, load, and render: the period
    heading with the formatted range (UTC `formatRange`, as on the dashboard), the
    summary `StatCard`s, the chart and time table, the by-service table, and the
    by-employee table (gated). Bucket labels: a day → day/month; a week → the
    in-range span (`max(monday, from)`–`min(sunday, to)`); a month → month/year.
    Money uses `Intl.NumberFormat` currency with `dir="ltr"` and `tabular-nums`.
    Names render as text with `dir="auto"` (React escaping; no HTML).
  - `components/reports/RevenueReportControls.tsx` (server component, modelled on
    `PeriodSelector`): preset links with `aria-current`, group links (only the
    allowed groups, each keeping the period), and a custom GET form (`DatePicker`
    from/to, hidden `period=custom` and current `group`) with the `role="alert"`
    error linked through `aria-describedby`.
  - `app/(app)/reports/revenue/loading.tsx`: skeleton with `role="status"` and an
    sr-only label.
  - `lib/navigation.ts`: `revenue` item gets `href: "/reports/revenue"`. Its
    visibility rule (`reports.view`) stays. Update `lib/navigation.test.ts` if it
    asserts disabled items.
  - `locales/en.json` and `locales/ar.json`: new `revenueReport` namespace (title,
    description, periods, group labels, custom form, invalid alert, summary
    titles/hints, table headings, totals, empty states, chart labels, loading).
  _Done when:_ as ADMIN, the page renders all sections in EN and AR (RTL). A default
  SUPERVISOR sees it including by-employee. A SUPERVISOR without
  `reports.view_all_employees` sees no by-employee table. STAFF and a supervisor
  without `reports.view` are redirected to `/forbidden`, and the nav item is hidden
  for them. `pnpm lint` and `pnpm exec tsc --noEmit` pass.

- [x] **5. Final verification.** Run `pnpm test`, `pnpm lint`,
  `pnpm exec tsc --noEmit`, and `pnpm build`.
  _Done when:_ all four pass, with the results recorded in the review packet.

## Files / areas

- `lib/dashboard.ts`, `lib/dashboard.test.ts` (shared bucketing: week + counts)
- `lib/reports.ts`, `lib/reports.test.ts` (new)
- `lib/reports-data.ts` (new)
- `app/(app)/reports/revenue/page.tsx`, `app/(app)/reports/revenue/loading.tsx` (new)
- `components/reports/RevenueReportControls.tsx` (new)
- `components/dashboard/RevenueChart.tsx`, `components/dashboard/StatCard.tsx` (reused unchanged)
- `lib/navigation.ts` (+ test if affected)
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- **No schema change.** Reads `Invoice` (`amount`, `status`, `createdAt`,
  `employeeId`, `serviceId`), `Service` names, `User.name`, and
  `SalonSettings.currency`.
- **Revenue rules:** paid = sum of PAID; unpaid = sum of UNPAID; gross =
  paid + unpaid; invoice count = PAID + UNPAID. CANCELLED never counts. An
  invoice's day is the salon day (`Asia/Dubai`) of `createdAt`. No tax.
- **URL contract:** `/reports/revenue?period=today|week|month|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|week|month`.
  Default values are omitted from generated links. Unknown values fall back as
  described above; nothing throws on bad params.
- **Week:** Monday-start (`weekStart`). Bucket key = the Monday; the label shows
  only the in-range days.
- **Authorization (server):** salon-wide figures need a non-STAFF role plus
  `reports.view`. The by-employee query additionally needs
  `reports.view_all_employees` and is not executed otherwise. Permissions come from
  the session via `getPermissions`, never from params.

## Testing

- Unit (Vitest, `pnpm test`): `lib/reports.test.ts` (new) and additions to
  `lib/dashboard.test.ts`, as listed in steps 1–2.
- No browser test command exists. Visual, RTL, and per-role behavior are checked
  manually in `/check`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for anything about App Router pages,
  `searchParams` (a Promise, typed through `PageProps<"/reports/revenue">`), or
  `loading.tsx` before writing them.
- Follow the dashboard's patterns (`app/(app)/dashboard/page.tsx`,
  `components/dashboard/PeriodSelector.tsx`): panel classes, `StatCard`, the
  sr-only chart table, UTC formatting of calendar days, and `dir` handling.
- Keep the report-specific controls separate from `PeriodSelector`. The dashboard
  selector stays unchanged.
- Loading every in-range PAID/UNPAID invoice row (at most 366 days) for bucketing is
  acceptable for a single salon. Do not add raw SQL.
- No audit entries: the page is read-only.

## Open questions

Not blocking. The spec uses the choice below; say so at review if you want something else.

- **"Daily, weekly, monthly, yearly" reports:** the spec treats these as the
  `today`/`week`/`month`/`year` presets, plus a day/week/month grouping of the
  breakdown (plan §30's "revenue by day/week/month"). "Previous month/year"
  presets and custom ranges longer than 366 days are not included.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10979,"specSha256":"6f0d8e2d0df8df705a8eef63a8988ade0676ce69b3f133dc43045bf46536b394","branch":"refs/heads/feature/revenue-reports","head":"8b76892e05a4032f817e4cf8099b07a77d81d46a","baseRef":"refs/heads/main","baseCommit":"61ecc3f1a0800410000907409987fce71ae92594","sourceTree":"83c50e2d2205ed8413c5f8fdd3f1cf73687423a5","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 8b76892e05a4032f817e4cf8099b07a77d81d46a
**Base commit:** 61ecc3f1a0800410000907409987fce71ae92594
**Base ref:** main
**Spec hash:** 6f0d8e2d0df8df705a8eef63a8988ade0676ce69b3f133dc43045bf46536b394
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T21:16:06Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T21:18:58Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `pnpm test`: pass (32 files, 613 tests)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm build`: not run (optional; not needed for any finding)

## Evidence

- Preconditions verified: `HEAD` = target, `git merge-base main HEAD` = base, raw SHA-256 of the tracked `blueprint/context/current-feature.md` = spec hash, only `blueprint/context/review.md` differed from the target.
- Reviewed the full base..target delta: `app/(app)/reports/revenue/page.tsx`, `app/(app)/reports/revenue/loading.tsx`, `components/reports/RevenueReportControls.tsx`, `lib/reports.ts`, `lib/reports-data.ts`, `lib/dashboard.ts`, `lib/navigation.ts`, their tests, and `locales/en.json` / `locales/ar.json` (41 `revenueReport` keys in each, identical key sets, every used key present).
- Security: `requireSession` then `getPermissions` then `canViewRevenueReport` (non-STAFF plus `reports.view`) runs before any query; the by-employee `groupBy` and `user.findMany` run only when `reports.view_all_employees` is held; search params are only parsed against fixed allow-lists and calendar-date validation; names render as escaped text with `dir="auto"`.
- Correctness: invoice `serviceId`/`employeeId` use `onDelete: Restrict`, so breakdown totals rows (from `data.totals`) always match the listed rows; week buckets start at `weekStart(from)` and labels clamp to the range; the dashboard keeps day/month only (`granularityOf` narrowed).
- Performance: one `Promise.all` for invoice rows plus two `groupBy`s, then one batched name lookup per breakdown; loading up to 366 days of rows is the spec's accepted trade-off (same shape as F-46).

## Findings

- F-49 [P3] open: no test pins the by-employee query gating and shared `where` in `loadRevenueReport`.
- F-50 [P3] open: a Staff user granted `reports.view` sees an enabled Revenue link that always lands on `/forbidden`.

## Remaining risk

- `pnpm build` was not run in this review.
- No browser or `/check` evidence in this review (Check not required): RTL layout, theme rendering, chart output, and per-role page behavior were reviewed from code only.
- `loadRevenueReport` has no unit test (F-49); its totals against the invoice list remain a manual `/check` item per the spec.
