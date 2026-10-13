# Feature: Settlement reports

**From build-plan:** feature 19
**Build attempt:** 1
**Branch:** feature/settlement-reports
**Status:** verified

## Goal

Add the settlement report at `/reports/settlements`. It covers a range of settled
salon months and shows settlement totals (paid revenue, earnings, deductions,
adjustments, final payout) split by status, by month, and by employee, with share
percentages and approval and paid status. Viewers who are not Staff see every
employee; Staff see only their own settlements. The sidebar's Reports > Settlements
item opens this report. `/settlements` stays the place where settlements are managed.

## In scope

- **Route** `app/(app)/reports/settlements/page.tsx` plus a `loading.tsx` skeleton
  shaped like the expense report's.
- **Access** (server, before any query), with `settlementReportScope(user, permissions)`:
  - `"all"`: not own scope (`isOwnScope`) and holds both `settlements.view` and `reports.view`.
  - `"own"`: own scope (Staff) and holds `settlements.view`. Every query is forced to
    `employeeId = user.id`.
  - `null`: someone who is not Staff and holds `settlements.view` without `reports.view`
    is sent to `/settlements` with `redirect`. The sidebar item they see still gets them
    to settlements. Everyone else goes to `/forbidden`.
- **Period**: a range of settleable months (`isSettleableMonth`). `latest` is
  `shiftMonth(salonMonth(), -1)`.
  - Presets: `year` (default) runs from January of `latest`'s year to `latest`. Its chip
    is labelled with that year number (for example "2026"), so in January it reads as last
    year. `last12` is the 12 months ending at `latest`, labelled "Last 12 months".
  - Custom: a GET form with From and To month selects (`FormSelect`). The options run from
    the earlier of the first settled month in scope and January of `latest`'s year, up to
    `latest`. Each option is labelled with the localized month and year, in UTC.
  - An invalid custom range (malformed, `from > to`, or `to > latest`) falls back to
    `year`. The form keeps the submitted values, shows a `role="alert"` message, and sets
    `aria-invalid` and `aria-describedby` on both selects, as in `ReportPeriodControls`.
  - The period heading shows the localized month range, formatted in UTC.
- **Summary cards** (`StatCard`):
  - Final payout: the total `finalAmount`, with a hint giving the settlement count.
  - Paid: total `finalAmount` of PAID settlements, with count.
  - Awaiting payment: APPROVED, with count.
  - Awaiting approval: DRAFT plus CALCULATED, with count.
- **By status** table: one row per status in `SETTLEMENT_STATUSES` order, each with a
  `SettlementStatusBadge`. Columns: settlements, paid revenue, earnings, deductions,
  adjustments, final payout. A total row in the footer. Every status counts in the totals.
- **By month** table: only months in the range that have settlements, oldest first.
  - The month cell links to `/settlements?month=YYYY-MM`.
  - Columns: settlements, paid revenue, earnings, deductions, adjustments, final payout,
    paid (the PAID `finalAmount`). A total row in the footer.
- **By employee** table, `"all"` scope only, sorted by employee name:
  - Employee cell: avatar, name via `nameLabels`, and an inactive badge.
  - Columns: months settled, share % (one value, or a localized min-max range when it
    changed within the range), paid revenue, earnings, deductions, adjustments, final
    payout, paid. A total row in the footer (no share %).
- **Empty state**: when there are no settlements in range, the cards show zeros and each
  table shows a `ReportEmptyState`-style message.
- **Link** in the page header: "Open settlements" goes to `/settlements`.
- **Sidebar**: the `settlements` item under Reports gets `href: "/reports/settlements"`
  and keeps `permissions: ["settlements.view"]`.
- English and Arabic text, RTL-safe layout, Light/Dark themes, tables that scroll
  horizontally. Negative final amounts use `text-destructive`, as on `/settlements`.

## Out of scope

- Any change to `/settlements`, `/settlements/[id]`, generation, status actions, or
  adjustments.
- Approver names and dates on the report (they stay on the settlement detail page).
- Charts, export, print, and scheduled settlement emails (future).
- The `employeeEarnings` sidebar item, which still has no route.
- A `/reports` index page.
- Any schema or migration change.

## Build loop

`workflow.stepReview` is `feature`: build all the steps, then present one review packet.
`checkpointCommits` is disabled. `/complete` creates the feature commit.

## Build steps

- [x] **1. Report rules and totals (pure, no DB).** Add these to `lib/reports.ts`:
  - `SETTLEMENT_REPORT_PERIODS = ["year", "last12", "custom"]`
  - `settlementReportScope(user, permissions)`
  - `parseSettlementReport(params, latest)`, which returns
    `{ period, from, to, invalidCustom, submitted? }` with `YYYY-MM` bounds
  - `settlementReportHref(period, latest)` for the preset links (the default `year` gets
    no query)
  - `settlementReportTotals(rows)`, which takes the stored settlement values plus
    `periodStart`, `status`, and `employee`. It returns the overall totals, the totals per
    status (every status, zero when none), the month rows (only months with settlements,
    ascending), and the employee rows (months settled, min and max `sharePercentage`,
    sums), all as `Prisma.Decimal`.

  _Done when:_ `lib/reports.test.ts` covers:
  - Scope: ADMIN `"all"`; default SUPERVISOR `"all"`; SUPERVISOR without `reports.view`
    `null`; default STAFF `"own"`; STAFF without `settlements.view` `null`; STAFF granted
    every key still `"own"`.
  - Parsing: the default `year`; `year` and `last12` in January (they cross the year
    boundary); a valid custom range; and invalid custom ranges (malformed, `from > to`,
    `to` after `latest`), each falling back to `year` with `invalidCustom`.
  - Totals: status totals that include drafts, month rows with no empty months, a share
    range when the percentage changed, negative finals, and exact decimal sums.
  - `pnpm test` passes.

- [x] **2. Loader.** In `lib/reports-data.ts`, add
  `loadSettlementReport({ from, to }, scope, viewerId)`. It runs one
  `employeeSettlement.findMany` with `periodStart` between `monthPeriod(from).periodStart`
  and `monthPeriod(to).periodStart`, plus `employeeId: viewerId` when `scope === "own"`. It
  selects only the stored values, `periodStart`, `status`, and the employee's
  `{ id, name, image, isActive }`. In parallel it runs an `aggregate` `_min.periodStart`
  with the same scope, which gives the first settled month, and it reads `currency` from
  `getSalonSettings()`. It returns `settlementReportTotals` plus `firstMonth` and
  `currency`.

  _Done when:_ `pnpm exec tsc --noEmit` passes.

- [x] **3. Page, controls, and translations.**
  - Add `components/reports/SettlementReportControls.tsx`, a server component with the
    preset chip links and the custom month form. It reuses `FormSelect` and the
    `ReportPeriodControls` styling.
  - Add `app/(app)/reports/settlements/page.tsx` and `loading.tsx`, with the access rule,
    the period heading, the cards, and the three tables.
  - Add a `settlementReport` namespace (title, description, loading, presets, custom,
    invalid, summary, hints, table titles and empty text, columns, total, inactive,
    openSettlements) to `locales/en.json` and `locales/ar.json`. Reuse
    `settlements.statuses` and `settlements.columns` where they fit.

  _Done when:_
  - As ADMIN in EN and AR (RTL), Light and Dark, the report renders and the presets and
    custom range work.
  - Totals match `/settlements` for each month in range.
  - An invalid custom range shows the alert and the `year` fallback.
  - Default Staff see only their own settlements and no by-employee table.
  - A SUPERVISOR without `reports.view` lands on `/settlements`.
  - A user without `settlements.view` gets `/forbidden`.
  - `pnpm lint` and `pnpm exec tsc --noEmit` pass.

- [x] **4. Sidebar.** Point the `settlements` item in `lib/navigation.ts` at
  `/reports/settlements`, and update the matching expectation in `lib/navigation.test.ts`.

  _Done when:_ the sidebar item opens the report for ADMIN and default Staff, and
  `pnpm test` passes.

- [x] **5. Final verification.** Run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`,
  and `pnpm build`.

  _Done when:_ all four pass, and the results are recorded in the review packet.

## Files / areas

- `lib/reports.ts`, `lib/reports.test.ts`
- `lib/reports-data.ts`
- `components/reports/SettlementReportControls.tsx` (new)
- `app/(app)/reports/settlements/page.tsx`, `loading.tsx` (new)
- `lib/navigation.ts`, `lib/navigation.test.ts`
- `locales/en.json`, `locales/ar.json`
- Reused, unchanged:
  - `lib/settlements.ts`: `SETTLEMENT_STATUSES`, `monthPeriod`, `isSettleableMonth`
  - `lib/earnings.ts`: `salonMonth`, `shiftMonth`
  - `lib/invoices.ts`: `isOwnScope`
  - `lib/dashboard.ts`: `first`
  - `components/settlements/SettlementStatusBadge.tsx`
  - `components/dashboard/StatCard.tsx`
  - `components/ui/form-select.tsx`
  - `components/layout/UserAvatar.tsx`
  - `lib/names.ts`: `nameLabels`

## Data / contracts

- **URL:** `/reports/settlements?period=year|last12|custom&from=YYYY-MM&to=YYYY-MM`.
  `from` and `to` are read only when `period=custom`. Unknown values fall back to `year`.
  The page is read-only and adds no server actions.
- **Authorization** (server, in the page, before any query): the step 1 scope comes from
  the session user and `getPermissions`. The `"own"` scope adds `employeeId = user.id` to
  both queries, so Staff never receive another employee's row or first month. Hiding the
  sidebar item is not the check.
- **Figures:** the stored, frozen settlement values only. Nothing is recalculated. Totals
  are exact `Prisma.Decimal` sums. Money is formatted with `Intl.NumberFormat` currency
  inside `dir="ltr"` and `tabular-nums`. Percentages use `style: "percent"` of `value / 100`,
  as `/settlements` does.
- **Months:** a `periodStart` is UTC midnight on the 1st, so month labels are formatted
  with `timeZone: "UTC"`.
- **Rendering:** employee names render as React text only, with `dir="auto"`.

## Testing

- Unit tests (Vitest, `pnpm test`): scope, parsing, preset hrefs, and totals in
  `lib/reports.test.ts`, plus the sidebar href in `lib/navigation.test.ts`.
- No browser test command exists. Roles, EN/AR, Light/Dark, and matching the totals
  against `/settlements` are confirmed manually during `/check`.

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/` before adding the route
  (`PageProps`, where `searchParams` is a Promise, and `redirect`).
- The by-month table lists only months with settlements, so the row count is bounded by
  the stored data. No range-length cap is needed.
- Check how the sidebar marks the active item. `/settlements` and `/settlements/[id]` may
  no longer highlight any item after step 4, which is acceptable. Do not add a new item.
- Do not refactor `/settlements` or the other report pages to share these tables.
- No Verify command exists, so none was run while writing this spec.
- As built: `settlementReportHref(period)` takes no `latest` (preset links need no
  months); `settlementMonthOptions(firstMonth, latest)` in `lib/reports.ts` builds the
  custom selects' months; `loadSettlementReport` also takes the locale for the employee
  sort. A select whose submitted month is not offered shows the nearest end instead.
- Final verification (2026-10-13): `pnpm test` 33 files / 665 tests passed; `pnpm lint`
  clean; `pnpm exec tsc --noEmit` clean; `pnpm build` succeeded with
  `/reports/settlements` listed.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11745,"specSha256":"d31c6bb7b22befbd137ef2c4822b3d01214a2772c01978c069eb9224c43fe863","branch":"refs/heads/feature/settlement-reports","head":"7d70f64d93d76785be5b91b4a036713ec5db4878","baseRef":"refs/heads/main","baseCommit":"490d17d91d11eae950ae32a6fb708ffd67a3bd0f","sourceTree":"ee74111c707adc459ebb0b0d57c5335dbf296435","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 7d70f64d93d76785be5b91b4a036713ec5db4878
**Base commit:** 490d17d91d11eae950ae32a6fb708ffd67a3bd0f
**Base ref:** main
**Spec hash:** d31c6bb7b22befbd137ef2c4822b3d01214a2772c01978c069eb9224c43fe863
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-13T01:44:13Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-13T01:52:40Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, SHA-256 of `blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` differed)
- `pnpm test`: pass (33 files, 665 tests)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm build`: not run (optional for this review)

## Evidence

- Full `490d17d..7d70f64` delta reviewed (11 files): `app/(app)/reports/settlements/page.tsx`, `loading.tsx`, `components/reports/SettlementReportControls.tsx`, `lib/reports.ts`, `lib/reports.test.ts`, `lib/reports-data.ts`, `lib/navigation.ts`, `lib/navigation.test.ts`, `locales/en.json`, `locales/ar.json`, and the spec.
- Authorization: `settlementReportScope` runs on the session user and `getPermissions` before any query; `null` redirects non-Staff holding `settlements.view` to `/settlements` (which itself requires `settlements.view`) and everyone else to `/forbidden`. Scope `own` spreads `employeeId: viewerId` into both the `findMany` and the `_min` `aggregate` (`lib/reports-data.ts:306`, `:326`); the by-employee table renders only for `all`.
- Totals and parsing: `Prisma.Decimal` sums for every status, `paid` counted only for PAID, months from `periodStart.toISOString()` sorted ascending, min/max share tracked; custom ranges validated with `isSettleableMonth(…, shiftMonth(latest, 1))` and `from <= to`, falling back to `year` with `invalidCustom` and `submitted`. Unit tests assert exact decimal sums, drafts, negative finals, share ranges, January boundary, and each invalid case.
- Rendering: employee names are React text with `dir="auto"`; money uses `Intl.NumberFormat` currency in `dir="ltr"` with `text-destructive` for negatives; month labels use `timeZone: "UTC"`; tables use `overflow-x-auto`, `scope` headers, and `aria-labelledby`; the custom form has `<label htmlFor>` on each `FormSelect` trigger, `aria-invalid`/`aria-describedby` on both, and a `role="alert"` message, matching `ReportPeriodControls`. Reused `settlements.columns`/`statuses` keys exist in both locales.
- Performance: one `findMany` with a narrow `select` plus one `aggregate` and settings in parallel; rows bounded by stored settlements in range.

## Findings

- F-56 [P3] open: no test pins the loader's `employeeId` filter on both queries in scope `own` (tests lens)
- F-57 [P3] open: by-employee share range is hand-joined instead of `formatRange`-localized (quality lens)

## Remaining risk

- `pnpm build` was not run in this review (the spec records a successful builder run on 2026-10-13).
- No browser test command exists; EN/AR, RTL, Light/Dark, role redirects, and totals against `/settlements` were reviewed from code only (Check not required).
- The loader's own-scope filter is correct by inspection but untested (F-56).
