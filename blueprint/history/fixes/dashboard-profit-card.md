# Fix: Dashboard profit card

**Type:** Fix
**Status:** verified
**Branch:** fix/dashboard-profit-card

## The problem

The salon dashboard's period cards (`app/(app)/dashboard/page.tsx:270`) show
**Pending revenue** (unpaid invoices). The owner wants one figure for what is left
from paid revenue after salon costs and employee deductions in the selected period.
The dashboard shows paid revenue and salon expenses, but not employee expenses, and
no card combines them.

## Rules (decided by the user, 2026-11-16, revised the same day)

**Profit = paid revenue − salon expenses − employee expenses**, for the dashboard's
selected range:

| Part | Source | Which rows count in the range |
| --- | --- | --- |
| Paid revenue | `Invoice.amount`, status `PAID` | `createdAt` inside the range. This is the existing `period.paidRevenue`. |
| Salon expenses | `SalonExpense.amount` | `date` inside the range. Same filter as the existing card. |
| Employee expenses (the "Deductions" column in the reports) | `EmployeeExpense.amount` | `date` inside the range (salon calendar days) |

**How the rules behave:**
- **Settlements are not part of the formula for now.** The user removed paid
  settlement payouts from the first draft. Generating, approving, or paying a
  settlement doesn't change Profit. The existing **Employee payouts** card still
  shows paid settlements, by paid date.
- **The figure is before employee shares.** It still includes the employees'
  share of revenue (for example, a 50% share not yet paid out). That's why the
  label is "Profit", not "in hand". The user may revisit this later; any change
  is a separate fix.
- **Profit can be negative.** It is shown as a normal signed currency value.

**Who sees it:** the Profit card replaces Pending revenue only when the viewer
holds both `expenses.view` and `employee_expenses.view`. Any viewer missing either
one keeps the Pending revenue card exactly as it is today. A total should never
reveal figures whose parts the viewer can't see. The employee-expense query runs
only when this section is allowed.

## The fix

**`lib/dashboard.ts`:**
- `dashboardSections` gains `profit: expenses.view && employee_expenses.view`.
- Add one pure function, `calculateProfit({ paidRevenue, salonExpenses,
  employeeExpenses })`, that returns a `Prisma.Decimal`. All math uses `Decimal`,
  never JS numbers.

**`lib/dashboard-data.ts` (`loadDashboard`):**
- When `sections.profit` is true, add one query to the existing `Promise.all`:
  `db.employeeExpense.aggregate({ where: { date: expenseDate }, _sum: { amount } })`.
- The salon expenses total is already loaded when `sections.expenses` is true,
  which `profit` implies.
- Return `period.profit` (a `Decimal`, or `null` when the section is off).
  `period.pendingRevenue` stays.
- The Employee payouts card and the chart are unchanged.

**`app/(app)/dashboard/page.tsx`:** in `periodCards`, show `{ key: "profit", … }`
in place of the `pendingRevenue` card when `data.period.profit` is set, otherwise
keep the existing `pendingRevenue` card. Use a fitting lucide icon that is already
installed (for example `PiggyBank`).

**Card order (user request, 2026-11-16):** Salon expenses and Total bills swap
places, so the first row reads Paid revenue → Salon expenses → Profit:

1. Paid revenue
2. Salon expenses (with `expenses.view`)
3. Profit or Pending revenue
4. Average bill
5. Total bills
6. Employee payouts (with `settlements.view`)

A viewer without `expenses.view` gets the same order without the Salon expenses
card.

**`locales/en.json` and `locales/ar.json`:**
- `dashboard.stats.profit`: "Profit" / "الربح".
- `dashboard.hints.profit`: "Paid revenue minus salon and employee expenses" /
  Arabic equivalent.

**Must not break:**
- Staff personal dashboard
- Other period and fixed cards
- The chart
- Query gating for viewers without permissions
- RTL layout

## Build steps

- [x] **1. Calculation and gating (`lib/`).** Add `calculateProfit` and the
  `profit` section flag. Add the gated employee-expense query and `period.profit`
  in `loadDashboard`.
  - **Done when:** `lib/dashboard.test.ts` has passing tests that cover:
    - the formula (including a negative result and decimal amounts such as 0.10 +
      0.20)
    - `dashboardSections` returning `profit` true only with both permissions.

    Existing `dashboardSections` expectations are updated for the new key.
    `pnpm test` passes.
- [x] **2. Card and translations.** Swap in the Profit card, reorder the period
  cards as listed above, and add the EN/AR strings.
  - **Done when:** `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build` pass, and
    every new translation key exists in both locale files.

## Verify

**Automated:** `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.

**Manual** (`pnpm dev`):
1. As Admin, open `/dashboard?period=month`. The third card reads **Profit** and
   equals Paid revenue − Salon expenses − the total of that month's employee
   expenses (the Deductions total in `/reports/employees` for the same range).
2. Add an employee expense dated today and reload. Profit drops by that amount.
   Marking a settlement PAID doesn't change it.
3. As a Supervisor without `employee_expenses.view`, the dashboard still shows
   **Pending revenue**.
4. Switch to Arabic. The label and hint are translated and the card lays out RTL.

## Notes

- The overview's feature 14 line ("revenue, bills, pending, …") describes the
  original dashboard. Viewers with full access now see Profit instead of Pending.
  This archive records that change; the plans are not edited.
- No schema or migration changes. The employee-expense filter is by `date` alone,
  and the only index is `(employeeId, date)`, which a date-only range can't use
  well. At salon scale that table is small, so no index is added. This matches the
  29d decision to add indexes only on evidence.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5911,"specSha256":"204c309f6383e579a873f2f27693b9c48a9d8a1fbdcd1b61d5e3ac770f18f076","branch":"refs/heads/fix/dashboard-profit-card","head":"ecd7cb2cfd4bbdd67be6a59b01b1e45bdfcee2a5","baseRef":"refs/heads/main","baseCommit":"1f544eca0cce9cfc01145e437d4ec1ad34b079f5","sourceTree":"58de8b1de84e17d8fdc64bde2b01193e79f4846a","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** ecd7cb2cfd4bbdd67be6a59b01b1e45bdfcee2a5
**Base commit:** 1f544eca0cce9cfc01145e437d4ec1ad34b079f5
**Base ref:** refs/heads/main
**Spec hash:** 204c309f6383e579a873f2f27693b9c48a9d8a1fbdcd1b61d5e3ac770f18f076
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-11-16T19:39:44Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-11-16T19:43:31Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `1f544eca0cce9cfc01145e437d4ec1ad34b079f5..ecd7cb2cfd4bbdd67be6a59b01b1e45bdfcee2a5` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm test`: pass (43 files, 894 tests)
- `pnpm build`: pass

### Evidence

- Preconditions: `HEAD` = target; `git merge-base refs/heads/main HEAD` = base; SHA-256 of `blueprint/context/current-feature.md` matches Spec hash; spec is tracked (no snapshot); only `blueprint/context/review.md` differed from the target before review.
- Formula: `calculateProfit` (`lib/dashboard.ts:231`) is `Prisma.Decimal(paidRevenue).minus(salonExpenses).minus(employeeExpenses)`; no JS number math; settlements excluded; negative results allowed.
- Permission gating: `dashboardSections.profit` = `expenses.view && employee_expenses.view` (`lib/dashboard.ts:220` to `:227`); `db.employeeExpense.aggregate` runs only when `sections.profit` (`lib/dashboard-data.ts:115`); `period.profit` is `null` unless both the employee and salon totals were loaded (`:126` to `:133`); the page shows Profit only when `data.period.profit` is set, otherwise the unchanged Pending revenue card (`app/(app)/dashboard/page.tsx:274` to `:276`). No figure reaches a viewer lacking either view.
- Date rule: employee expenses filter on `date` with the same `gte`/`lte` `expenseDate` as salon expenses, matching the expense report's Deductions filter (`lib/reports-data.ts:104`).
- Card order: Paid revenue, Salon expenses (gated), Profit or Pending revenue, Average bill, Total bills, Employee payouts (gated), as specified.
- Translations: `dashboard.stats.profit` and `dashboard.hints.profit` added to both `locales/en.json` and `locales/ar.json`; the page reads both via `stats.${key}` / `hints.${key}` (`page.tsx:306`). `PiggyBank` comes from installed `lucide-react`.
- Tests: `lib/dashboard.test.ts` covers the formula (including 0.10 + 0.20 exactness and a negative result) and `profit` true only with both permissions; existing section expectations updated.
- Security/performance: no new input surface, actions, or schema; one extra aggregate per salon-dashboard load, gated; date-only filter without a matching index is acknowledged in the spec's Notes at salon scale.

### Findings

- F-68 [P3] open: no loader test pins that `loadDashboard` skips the employee-expense query and returns `profit: null` without both views.

### Remaining risk

- Manual browser verification (spec Verify steps 1 to 4, including RTL layout and the Supervisor fallback) was not performed; Check was not required and no dev server was started.
- `loadDashboard` gating is verified by code reading only (F-68); no automated test exercises it.
- Dashboard activity state (`blueprint/.state/run.json`) was not written because this reviewer was limited to the findings and review files.
