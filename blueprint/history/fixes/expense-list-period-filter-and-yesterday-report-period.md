# Fix: Expense list period filter and Yesterday report period

**Type:** Fix
**Status:** verified
**Branch:** fix/expense-list-period-filter-and-yesterday-report-period

## The problem

1. **Expenses list (`/expenses`)** shows every salon expense ever recorded when no
   filter is set. It only offers free From/To date pickers, so the common views
   (this month, last month, this year) take several clicks.
2. **Reports** (Revenue, Expenses, Employee performance, and the employee detail
   performance section) share one period list, `REVENUE_PERIODS` in
   [lib/reports.ts](../../lib/reports.ts): Today, This week, This month, This
   year, Custom. There is no **Yesterday** preset, so checking the previous day's
   numbers needs a custom range.

## The fix

### Expenses list

- Add a `period` URL param to the expense list filters in
  [lib/expenses.ts](../../lib/expenses.ts) with values `month` (default),
  `previousMonth`, `year`, and `all`.
- With no `period` and no From/To, the list shows **the current salon month**
  (1st of the month to today, from `salonToday()`).
- Explicit From/To dates win over the preset (a custom range), exactly as today.
- Reuse `presetRange` from [lib/dashboard.ts](../../lib/dashboard.ts) for `month`
  and `previousMonth`; `year` is Jan 1 to today (same as the revenue report);
  `all` applies no date limit.
- On [app/(app)/expenses/page.tsx](../../app/(app)/expenses/page.tsx), add preset
  links (This month · Previous month · This year · All time) above the filter
  form, marking the active one with `aria-current`, keeping `q` and `category`.
- `expenseListHref` and pagination keep the active period. The default period
  is left out of the URL. "Clear filters" returns to the default (this month).
- Empty state: the default month view with no rows uses the no-match message
  with a link to "All time", so an empty month does not look like "no expenses
  at all".

### Reports

- Add `"yesterday"` to `REVENUE_PERIODS` (order: Today, Yesterday, This week,
  This month, This year, Custom) and a `yesterday` case in the preset range
  (`addDays(today, -1)` for both ends). Daily grouping applies as for Today.
- `ReportPeriodControls` already renders every preset, so Revenue, Expenses,
  Employee performance, and the employee detail page all get the button.
- Add `yesterday` labels to the report period keys in
  [locales/en.json](../../locales/en.json) and [locales/ar.json](../../locales/ar.json).

### Must not break

- Existing `/expenses?from=…&to=…` links and search/category filters.
- Permissions (`expenses.view`, report permissions) are unchanged.
- Dashboard periods are untouched (not requested).
- Employee expense lists are out of scope.
- No new dependencies or abstractions.

## Build steps

- [x] 1. **Report "Yesterday" preset** - add the period, range case, and EN/AR labels;
   extend `lib/reports.test.ts`.
   Done when: `/reports/revenue?period=yesterday` (and the Expenses and Employee
   reports) show only yesterday's salon day, and the button is active.
- [x] 2. **Expense list period presets** - add `period` parsing, default month, href
   handling, preset links, and empty state; extend `lib/expenses.test.ts`.
   Done when: `/expenses` with no query lists only this month's expenses, and
   the four preset links switch the range while keeping search and category.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`.
- Open `/expenses`: only this month's expenses appear and "This month" is active.
  Click Previous month, This year, All time, and check the dates. Set From/To:
  the custom range applies. Page 2 keeps the period.
- Open Revenue, Expenses, and Employee performance reports: click "Yesterday";
  totals cover only yesterday. Check Arabic (RTL) labels.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3776,"specSha256":"a4fbf8e862296be0d909654f4b20f0e164660957cda8508009a54930653c3e3b","branch":"refs/heads/fix/expense-list-period-filter-and-yesterday-report-period","head":"dd63186997350b8696fddb6ca1b8890e816f766a","baseRef":"refs/heads/main","baseCommit":"dd63186997350b8696fddb6ca1b8890e816f766a","sourceTree":"8308f01658c031419d4dccd40c57d4a0291d621f","absentOptional":[]} -->
