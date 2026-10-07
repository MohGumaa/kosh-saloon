# Feature: Admin dashboard

**From build-plan:** feature 14
**Build attempt:** 1
**Branch:** feature/admin-dashboard
**Status:** verified

## Goal

Replace the placeholder widgets on `/dashboard` with real salon figures for
ADMINs and permitted Supervisors: paid revenue, bills, pending (unpaid) amounts,
salon expenses, staff count, employee payouts, latest invoices, and a revenue
chart, scoped by a period selector. Staff keep a personal shell until feature 15.

## In scope

- **Who sees salon figures (server-decided):** `canViewSalonDashboard(user,
  permissions)` is true when `!isOwnScope(user)` (not STAFF) and the user holds
  `reports.view`. ADMIN always passes. A STAFF user never sees salon-wide
  figures, even if granted `reports.view`.
- **Per-widget gates, on top of that:**
  - Salon expenses card and the chart's expense series need `expenses.view`.
  - Employee payouts card needs `settlements.view`.
  - Latest invoices panel needs `invoices.view`.
  - A gated widget is not rendered at all, and its query does not run. Hiding
    is not the only protection: the query is skipped on the server.
- **Period selector** (GET URL, Server Component, no client state):
  `/dashboard?period=<key>` with keys `today`, `last7`, `week`, `month`
  (default), `previousMonth`, `last12`, `custom`. `custom` adds
  `from=YYYY-MM-DD&to=YYYY-MM-DD`. All days are salon days (`SALON_TIME_ZONE`).
  - `today`: today. `last7`: today and the 6 days before. `week`: Monday of the
    current week through today. `month`: day 1 of the current month through
    today. `previousMonth`: the whole previous month. `last12`: day 1 of the
    month 11 months ago through today.
  - `custom`: both dates must be valid calendar dates (`isCalendarDate`),
    `from <= to <= today`, and the span is at most 366 days. Invalid or missing
    custom dates fall back to `month` and show an inline message beside the
    custom-range form (see Data / contracts). An unknown `period` silently
    falls back to `month`.
  - Presets render as links with `aria-current="page"` on the active one. The
    custom range is a small GET form with two labelled `DatePicker`s
    (`max` = today) and an Apply button.
- **Period cards** (follow the selected period):
  - Paid revenue: sum of PAID invoice amounts.
  - Total bills: count of PAID + UNPAID invoices.
  - Pending revenue: sum of UNPAID invoice amounts.
  - Average bill: (PAID + UNPAID sum) / total bills. Shown as `–` when there are
    no bills.
  - Salon expenses: sum of `SalonExpense.amount` with `date` in the range.
  - Employee payouts: sum of `finalAmount` of PAID settlements whose `paidAt`
    falls in the range (money actually paid out in the period).
  - CANCELLED invoices count nowhere. The invoice date is `createdAt`.
- **Fixed cards** (do not follow the period):
  - Today's, this week's (Monday start), and this month's paid revenue.
  - Active staff: count of users with `isActive = true` (all roles).
  - Employee share %: the global `employeeSharePercentage`.
  - Active services: count of services with `isActive = true`.
- **Revenue chart** (Recharts, client component) for the selected period:
  stacked bars for paid and unpaid revenue (together they make revenue), plus
  salon expenses when `expenses.view` is held. Daily buckets for ranges of 62
  days or fewer. Monthly buckets otherwise. Every bucket in the range is present,
  including zeros. The X axis is reversed in RTL. Colors come from the existing
  `--chart-*` tokens so both themes work. A screen-reader-only table carries the
  same values. The empty state appears when every bucket is zero.
- **Top services** (the existing panel): top 5 services by paid revenue in the
  period, showing the localized service name, amount, and a CSS proportion bar.
  No second chart library component. Empty state when there is no paid revenue.
- **Latest invoices:** the 5 most recent invoices of any status (not
  period-scoped). Each row shows the invoice number linked to
  `/transactions/[id]`, the employee, the date, the amount (struck through when
  cancelled), and `InvoiceStatusBadge`. A "View all" link goes to
  `/transactions`. Empty state when there are none.
- **Personal shell** for users who fail `canViewSalonDashboard`: the welcome
  header and the account panel only. The placeholder stat cards, chart, invoice
  table, and top services are removed for them. The welcome body text is
  role-appropriate. Feature 15 fills this view.
- Money uses `Intl.NumberFormat(locale, { style: "currency", currency })` with
  the salon currency, and the percent formatter pattern from the settlements
  page. Numbers use `dir="ltr"` and `tabular-nums`.
- `app/(app)/dashboard/loading.tsx`: a simple skeleton of the card grid shown
  while a period change loads.
- EN and AR strings for everything new. Remove the now-unused placeholder
  strings.

## Out of scope

- Staff personal figures (feature 15).
- Revenue, expense, performance, and settlement report pages (features 16 to 19),
  and breakdowns by employee.
- Hourly buckets, chart series toggles, export, and printing.
- New permission keys or a dashboard-specific permission.
- Changes to sidebar navigation.

## Build loop

`workflow.stepReview` is `feature`: build all steps, running the step's checks
as you go, then present one review packet for the whole feature.
`workflow.checkpointCommits` is `disabled`: no step commits. `/complete` creates
the feature commit.

## Build steps

- [x] **1. Period and access logic (pure, tested).** Add `lib/dashboard.ts`
  with no database import: `DASHBOARD_PERIODS`, `parseDashboardPeriod(params,
  today)` returning `{ period, from, to, granularity, invalidCustom }`,
  `weekStart(day)` (Monday), `chartBuckets(from, to, granularity)`,
  `bucketInvoices(rows, buckets, timeZone)` (by salon day of `createdAt`),
  `bucketExpenses(rows, buckets)` (by `dayOf(date)`), `averageBill(sum,
  count)`, and `canViewSalonDashboard(user, permissions)`. Reuse
  `salonToday`, `isCalendarDate`, `salonDayRange`, `shiftMonth`, and
  `dateValue`/`dayOf`. Add `lib/dashboard.test.ts`.
  **Done when:** tests cover every preset's range, including a week start on a
  Monday and on a Sunday and across a year boundary for `last12` and
  `previousMonth`. Tests also cover custom fallbacks (missing, invalid date,
  `from > to`, future `to`, span > 366), daily/monthly granularity at the
  62-day edge, zero-filled buckets, an invoice near midnight UTC landing in the
  right salon day, average bill with zero bills, and the access rule for ADMIN,
  Supervisor with and without `reports.view`, and STAFF with `reports.view`.
  `pnpm test` and `pnpm exec tsc --noEmit` pass.

- [x] **2. Server data loader.** Add `lib/dashboard-data.ts` (server only),
  which takes the actor, the permission set, and the parsed period. It runs the
  card aggregates (`invoice.groupBy` by status with `_sum`/`_count` over
  `salonDayRange`, `salonExpense.aggregate` over `dateValue` bounds,
  `employeeSettlement.aggregate` on PAID with `paidAt` in range, `user.count`,
  `service.count`, fixed today/week/month paid sums, and the global share from
  `getSalonSettings`). It also runs the chart rows (non-cancelled invoices
  `createdAt, amount, status`, and expenses `date, amount` when permitted), top
  services (`invoice.groupBy` by `serviceId` on PAID, top 5, then names), and
  the latest 5 invoices. Gated queries are skipped. Queries run in parallel with
  `Promise.all`. The loader returns plain serializable values: money as strings
  from `Decimal`, chart values as numbers for Recharts.
  **Done when:** typecheck passes and the loader never queries expenses,
  settlements, or invoices without the matching permission (covered by a test
  on a small pure `dashboardSections(permissions)` helper in
  `lib/dashboard.ts`).

- [x] **3. Install Recharts and build the chart.** `pnpm add recharts`, and
  confirm the installed major supports React 19. Add
  `components/dashboard/RevenueChart.tsx` (`"use client"`). It takes buckets
  with labels already formatted on the server, series labels, a currency
  formatter config (locale and currency), `rtl`, and `showExpenses`. It renders
  a `ResponsiveContainer` bar chart with stacked paid/unpaid bars and an
  optional expenses bar, a tooltip, and a legend. Colors come from
  `var(--chart-1)` etc. It also renders a `sr-only` table of the same values
  and an empty state.
  **Done when:** `pnpm build` succeeds with the client chart imported from the
  server page, and lint passes.

- [x] **4. Dashboard page.** Rewrite `app/(app)/dashboard/page.tsx`. It parses
  `searchParams`, checks access once, and renders either the personal shell or
  the salon view: welcome header, period selector (links plus the custom-range
  form with the inline invalid message), period cards, fixed cards, chart and
  top services, and latest invoices. Add `components/dashboard/` pieces only
  where the page would otherwise repeat markup (for example `StatCard`,
  `PeriodSelector`). Add `loading.tsx`.
  **Done when:** as ADMIN, each preset link and a valid custom range update the
  URL, cards, chart, and top services. An invalid custom range shows the
  message and month figures. A Supervisor without `expenses.view` sees no
  expense card or expense series. A STAFF user sees only the personal shell.
  Typecheck, lint, and build pass.

- [x] **5. Translations and RTL.** Add `dashboard.*` keys to `locales/en.json`
  and `locales/ar.json` (period names, card titles, card hints, chart series,
  invalid-range message, "View all", personal welcome body). Remove the unused
  placeholder keys.
  **Done when:** `/dashboard?period=last7` in Arabic shows a mirrored layout and
  a reversed chart axis with no missing-key warnings, and the existing locale
  key tests (if any) pass. `pnpm test`, lint, and build pass.

## Files / areas

- `lib/dashboard.ts`, `lib/dashboard.test.ts` (new): pure logic.
- `lib/dashboard-data.ts` (new): Prisma queries.
- `components/dashboard/RevenueChart.tsx` (new, client), plus small
  `StatCard` and `PeriodSelector` components if used.
- `app/(app)/dashboard/page.tsx` (rewrite), `app/(app)/dashboard/loading.tsx`
  (new).
- `locales/en.json`, `locales/ar.json`.
- `package.json`, `pnpm-lock.yaml` (adds `recharts`).
- Reused: `lib/auth/authorize.ts` (`getPermissions`), `lib/invoices.ts`
  (`isOwnScope`, `salonDayRange`, `isCalendarDate`, `SALON_TIME_ZONE`),
  `lib/expenses.ts` (`salonToday`, `dateValue`, `dayOf`), `lib/earnings.ts`
  (`shiftMonth`, `salonMonth`), `lib/settings.ts`,
  `components/invoices/InvoiceStatusBadge.tsx`, `components/ui/date-picker.tsx`,
  `components/layout/LocalDateTime.tsx`.

## Data / contracts

- No schema change, no migration, no writes, no audit entries (read-only page).
- URL: `/dashboard?period=today|last7|week|month|previousMonth|last12|custom`
  `[&from=YYYY-MM-DD&to=YYYY-MM-DD]`. These are the stable keys. Other params
  are ignored.
- `parseDashboardPeriod` result: `{ period: DashboardPeriod; from: string; to:
  string; granularity: "day" | "month"; invalidCustom: boolean }`, with
  `from`/`to` as inclusive salon days.
- Invalid custom range: a message with `role="alert"` beside the custom form,
  linked to both pickers through `aria-describedby`, with `aria-invalid` on
  them. The pickers keep the submitted values. The message clears on the next
  valid submit or any preset.
- Money stays `Prisma.Decimal` until the boundary. Sums with no rows are zero.
  Converting to a number is for display or chart only.
- User-controlled text (employee and service names) is rendered as React text
  with `dir="auto"`. Never as HTML.
- Chart bucket labels are formatted on the server with `Intl.DateTimeFormat`
  (locale, UTC on the bucket's day value) so server and client agree.

## Testing

- `pnpm test`: `lib/dashboard.test.ts` covers the period, bucket, average, and
  access logic, plus the per-section permission helper.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.
- No browser test command exists, so manual role and RTL checks belong to
  `/check`. Do not claim them as run.

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/` before writing page
  or loading code (searchParams is a Promise, `PageProps<"/dashboard">`).
- Revenue on every card is PAID-only, following the core rule. Unpaid shows only
  as Pending and as the unpaid chart series.
- Salon expenses never reduce any revenue figure shown.
- Keep the chart component free of data fetching and secrets. It receives only
  the aggregated numbers the viewer may see.
- Follow the existing panel styling (`rounded-2xl border bg-card ...
  shadow-card`) and empty-state pattern from the current page.
- If Recharts' `XAxis reversed` or legend order behaves oddly in RTL, keep the
  axis reversal and note anything else for feature 23 (RTL review). Do not hack
  around it.

## Open questions

Non-blocking. The choices above are recorded so implementation can start, and
any of them is cheap to change.

- **Card definitions:** revenue cards are PAID-only. Pending is UNPAID within
  the period, not all-time outstanding. Payouts are PAID settlements by
  `paidAt`. Active staff counts all active users, including admins. Active
  services is the catalog count.
- **Custom range cap:** at most 366 days. The week starts on Monday.
- **Top services:** keep and fill the existing panel (top 5 by paid revenue)
  instead of removing it.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13469,"specSha256":"8c3a6a389df64d60025fd8789bee210a2b17d98fee3b1194821d1e4168416d35","branch":"refs/heads/feature/admin-dashboard","head":"f4878e932e90bf166502c7db6e2e8336f1090311","baseRef":"refs/heads/main","baseCommit":"950af45d7949950bc24d822b03d37fb7a0b68e60","sourceTree":"2162b83df670c17118ccb5b83e5f2664642bc3ec","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** f4878e932e90bf166502c7db6e2e8336f1090311
**Base commit:** 950af45d7949950bc24d822b03d37fb7a0b68e60
**Base ref:** main
**Spec hash:** 8c3a6a389df64d60025fd8789bee210a2b17d98fee3b1194821d1e4168416d35
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-06T23:58:36.475Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T00:07:51Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `950af45d7949950bc24d822b03d37fb7a0b68e60..f4878e932e90bf166502c7db6e2e8336f1090311` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed)
- `pnpm test`: pass (31 files, 582 tests)
- `pnpm lint`: pass
- `pnpm build`: pass (includes the TypeScript check against fresh route types)
- `pnpm exec tsc --noEmit`: unavailable (not run; a running dev server left a corrupt generated `.next/dev/types/routes.d.ts`, so `pnpm build` was used for the type check)

### Evidence

- All 13 changed files in the delta reviewed: `lib/dashboard.ts`, `lib/dashboard-data.ts`, `lib/dashboard.test.ts`, `app/(app)/dashboard/page.tsx` and `loading.tsx`, `components/dashboard/*`, both locales, `package.json` (adds `recharts` 3.10.1), and the spec.
- Authorization: `canViewSalonDashboard` returns false for any STAFF role regardless of `reports.view`; the page returns the personal shell before `searchParams` is parsed or `loadDashboard` runs, and the shell queries only the viewer's own username and last sign-in.
- Gated queries: the salon expense aggregate and rows, the PAID settlement aggregate, and the latest-invoices query run only when `dashboardSections` allows them (`lib/dashboard-data.ts:74`, `:77`, `:87`, `:95`); the cards, expense series, and invoice panel are omitted when their value is null.
- Money: every revenue card filters `status: "PAID"`; Pending is UNPAID only; CANCELLED is excluded from the period `groupBy`, the chart rows, and top services; sums stay `Prisma.Decimal` with zero defaults and are converted with `toNumber()` only for display and chart values.
- Time zone: invoice and payout ranges use `salonDayRange` (Asia/Dubai), chart invoices bucket by `salonToday(createdAt)`, expenses use `@db.Date` bounds via `dateValue`, and labels format UTC midnight values in UTC.
- Untrusted input: `period`, `from`, and `to` are matched against a fixed list or validated with `isCalendarDate`, ordering, `to <= today`, and the 366-day cap; submitted values are only echoed as React text or picker defaults. Employee and service names render as text with `dir="auto"`.
- Tests: `lib/dashboard.test.ts` covers every preset, Monday and Sunday week starts, year-boundary and leap-year months, all custom fallbacks, the 62-day granularity edge, zero-filled buckets, the near-midnight salon-day case, zero-bill average, the access rule for ADMIN, Supervisor with and without `reports.view`, and STAFF with all keys, plus `dashboardSections`.
- Locale key sets under `dashboard` are identical in EN and AR, every key the page uses exists, and the removed placeholder keys have no remaining references.

### Findings

- F-45 [P2] open: the `aria-hidden` chart wrapper contains Recharts' default focusable `<svg>` (`components/dashboard/RevenueChart.tsx:42`)
- F-46 [P3] unverified: the chart reads every invoice row in the range, up to a year per page view (`lib/dashboard-data.ts:83`)
- Earlier ledger entries were not re-scoped; none of their files are in this delta.

### Remaining risk

- `pnpm exec tsc --noEmit` was unavailable because of the corrupt generated dev route types; `pnpm build` ran the TypeScript check instead.
- No browser run: RTL mirroring and the reversed X axis, the chart's focus behaviour (F-45), tooltip and legend rendering in both themes, and the loading skeleton on period changes were reviewed from code only. Check was not required.
- `loadDashboard` itself was not exercised against a database; its permission gating is proven only through the pure `dashboardSections` helper, as the spec allows, and by reading the loader.
- The loader trusts its caller to have run `canViewSalonDashboard` (it takes permissions, not the actor); the only caller does so today.
