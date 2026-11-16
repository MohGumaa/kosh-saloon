# Feature: Monthly closing statement

**From build-plan:** feature 31
**Build attempt:** 1
**Branch:** feature/monthly-closing-statement
**Status:** verified

## Goal

At the end of each month, the owner and the supervisor go through one printable
statement together. It shows what the salon earned, what each employee earned and is
still owed, what the salon spent, and the **net the salon keeps**:

```
Net kept = paid revenue − employee earnings (share + adjustments) − salon expenses
```

Employee figures come from the saved monthly settlements, so they match what employees
are paid. Nothing new is stored.

## Design reference

[`blueprint/reference/closing-statement-reference.png`](../reference/closing-statement-reference.png)
(a trip statement from another product, supplied by the user). Use only its layout:

- a white "paper" sheet with the logo and company name on the left, and the statement
  title, number and issue date on the right
- a strong rule under the header
- plain, light tables with right-aligned numbers and a bold total row
- a row of bordered summary boxes at the bottom; the key box has a colored border and
  value

Use the Kosh theme tokens, not that product's colors. Keep the sheet readable in dark
mode on screen. It prints black on white.

## Rules (decided by the user, 2026-11-16)

| Line | Source | Rule |
| --- | --- | --- |
| Paid revenue | `Invoice.amount`, status `PAID`, `paidRevenueWhere(month)` | Current invoices for the salon month. This is the same filter settlements use. |
| Per employee: revenue, share %, earned (`employeeShare`), advances (`totalExpenses`), adjustments (`totalAdjustments`), final payout (`finalAmount`), status | The employee's `EmployeeSettlement` for that `periodStart` | Stored values only. Nothing is recalculated. |
| Employee earnings (deducted) | Σ `employeeShare + totalAdjustments` over the month's settlements | Every status counts, as in the settlement report. Advances are not deducted again: they are already inside the earnings, paid out in cash during the month. |
| Still to pay employees | Σ `finalAmount` of settlements not yet `PAID` | For information. It doesn't change the net. |
| Salon expenses | `SalonExpense.amount` with `date` in the month (`monthPeriod`) | Grouped by category, plus the total. |
| Net kept | paid revenue − employee earnings − salon expenses | Uses `Prisma.Decimal` only. It can be negative and is shown signed (red when negative). |

**Which employees are expected to have a settlement** (the same rule
`generateSettlements` uses): anyone with PAID invoices or employee expenses in the
month.
- **Not settled:** an expected employee with no settlement. They get a row marked
  "Not settled", showing their live paid revenue and dashes for the settlement columns.
  The net is then labelled **Provisional**, with a notice linking to
  `/settlements?month=YYYY-MM`.
- **Out of date:** a settled employee whose stored `totalRevenue` differs from their
  current paid revenue (an invoice changed after the settlement). Their row gets an "Out
  of date" marker, and a notice says the settlements no longer match current invoices.
  The net still uses the stored values and is also labelled Provisional.

**Who can see it:** a viewer who is not Staff and holds `reports.view`,
`settlements.view` and `expenses.view`. Admins always do; Supervisors do by default.
Anyone else is redirected to `/forbidden`.

## In scope

- A `/reports/closing?month=YYYY-MM` page. The month is any completed salon month.
  Unknown or invalid values fall back to the latest completed month
  (`parseSettlementMonth`). A month selector lists completed months, newest first
  (`settlementMonthOptions`, from the first settled month).
- The statement sheet:
  - **Header:** salon logo (when set) and name, licence number when set; title "Closing
    statement", the month name, and "Generated <date and time>".
  - **Revenue:** paid revenue and the paid invoice count.
  - **Employee payouts table:** employee, revenue, share %, earned, advances,
    adjustments, final payout, status, plus a total row.
  - **Salon expenses table:** one row per category with entries that month (count and
    amount), plus a total row.
  - **Summary boxes:**
    - Paid revenue
    - Employee earnings
    - Salon expenses
    - **Net kept** (highlighted)
    - Still to pay employees
  - The Provisional and out-of-date notices, when they apply.
- A **Print / Save as PDF** button (`window.print()`). Print styles hide the sidebar,
  header, controls and notices' links, and print the sheet on white.
- A sidebar item "Closing statement" under Reports.
- EN/AR strings, RTL-safe layout, Light/Dark, and a loading screen.
- Empty month (no invoices, settlements or expenses): the sheet still renders with
  zeros, and each table shows the shared empty state.

## Out of scope

- Storing, locking, signing off or auditing a closed month (the user chose report-only).
- Server-generated PDF files, emailing, and new dependencies.
- Any change to settlement, invoice or expense behavior or math.
- Including unpaid invoices or tax.
- A multi-month or yearly closing.

## Build loop

`workflow.stepReview` is `feature` and checkpoint commits are disabled. Build all the
steps, running each step's checks, then present one review packet at the end.
`/complete` creates the single feature commit.

## Build steps

- [x] **1. Rules and calculation (`lib/reports.ts`).** Add:
  - `canViewClosingStatement(user, permissions)`.
  - `CLOSING_STATEMENT_PATH = "/reports/closing"`.
  - A pure `closingStatement({ paidRevenue, invoiceCount, paidByEmployee, expectedEmployeeIds, settlements, salonExpensesByCategory, locale })`. It returns:
    - the employee rows (settled or not settled, each with an `outOfDate` flag), sorted
      by name
    - the employee totals
    - the expense rows and the expense total
    - `employeeEarnings`, `stillToPay` and `net`
    - `unsettledCount`, `outOfDateCount` and `provisional`

  It reuses `SettlementReportInput` and `Prisma.Decimal` and has no database import.
  - **Done when:** `lib/reports.test.ts` has passing tests for:
    - the permission (Staff denied even with every key; each of the three keys required)
    - the net formula, including advances not deducted twice, a negative adjustment, a
      negative net, and decimal exactness (0.10 + 0.20)
    - `stillToPay` excluding PAID
    - a not-settled employee (counted, net provisional, earnings not deducted)
    - an out-of-date employee
    - an empty month

    `pnpm test` passes.
- [x] **2. Loader (`lib/reports-data.ts`).** Add `loadClosingStatement(month, locale)`.
  In one `Promise.all` it loads:
  - salon settings
  - the paid invoice aggregate (sum and count)
  - the paid revenue grouped by employee
  - employee expenses grouped by employee (ids only)
  - the month's settlements with employee `{ id, name, image, isActive }`
  - salon expenses grouped by category
  - the first settled month

  Then it makes one `user.findMany` call for expected employees who have no
  settlement, and passes everything to `closingStatement`. The query count doesn't
  depend on the number of employees.
  - **Done when:** `pnpm exec tsc --noEmit` passes. The loader is called only after the
    page's permission check (see step 3).
- [x] **3. Page, navigation, translations.** Add these files:
  - `app/(app)/reports/closing/page.tsx`: the permission check, then a redirect to
    `/forbidden`, then `parseSettlementMonth`, the loader, and the sheet described in
    In scope, using `dir="ltr"` money, `dir="auto"` names, `nameLabels`,
    `SettlementStatusBadge`, `UserAvatar`, `EmptyState` and `generateMetadata`.
  - A small client month selector in `components/reports/ClosingMonthSelect.tsx`
    (a labelled `<select>` that navigates on change, with a no-JS submit button).
  - `app/(app)/reports/closing/loading.tsx`.
  - A `closingStatement` item in `lib/navigation.ts` (Reports group, after
    Settlements, `permissions: ["expenses.view"]`). The page itself enforces the full
    rule.
  - `closingStatement.*` and `nav.closingStatement` strings in `locales/en.json` and
    `locales/ar.json`.

  Before writing the page, read the relevant Next.js guide in
  `node_modules/next/dist/docs/` (`PageProps`, `searchParams`).
  - **Done when:** `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build` pass, every
    new key exists in both locales, and `lib/navigation.test.ts` passes, updated if it
    pins the item list.
- [x] **4. Print.** Add these pieces:
  - `components/reports/PrintButton.tsx` (client, `window.print()`, Printer icon,
    translated label).
  - `print:hidden` on the sidebar, the header, the skip link wrapper, the page controls
    and the notice links.
  - Print overrides for the sheet: white background, black text, no shadow, full width,
    and `break-inside: avoid` on table rows and summary boxes. Use Tailwind `print:`
    variants, falling back to a small `@media print` block in `app/globals.css` only
    for what the variants can't express.
  - **Done when:** `pnpm lint` and `pnpm build` pass. Manually: the browser print
    preview of `/reports/closing` shows only the sheet, on white, in both English and
    Arabic (RTL).

## Files / areas

- `lib/reports.ts`, `lib/reports.test.ts`: permission, path and `closingStatement`
- `lib/reports-data.ts`: `loadClosingStatement`
- `app/(app)/reports/closing/page.tsx`, `loading.tsx`: new files
- `components/reports/ClosingMonthSelect.tsx`, `components/reports/PrintButton.tsx`:
  new files
- `lib/navigation.ts` (and its test if needed)
- `app/(app)/layout.tsx` and/or `components/layout/Sidebar.tsx`, `Header.tsx`:
  `print:hidden`
- `app/globals.css`: only if needed for print
- `locales/en.json`, `locales/ar.json`

Reused as-is: `paidRevenueWhere` and `salonMonth` (`lib/earnings.ts`); `monthPeriod`,
`parseSettlementMonth`, `monthOf` and `expensesWhere` (`lib/settlements.ts`);
`settlementMonthOptions` and `SettlementReportInput` (`lib/reports.ts`);
`getSalonSettings`; `getPermissions` and `requireSession`; and the existing report
components.

## Data / contracts

- No schema change, migration, server action or stored state.
- URL: `GET /reports/closing?month=YYYY-MM`. This is the only input. It is validated
  with `parseSettlementMonth`: anything other than a completed month falls back to the
  latest one.
- Money: `Prisma.Decimal` end to end. It is formatted with
  `Intl.NumberFormat(locale, { style: "currency", currency: settings.currency })` only
  at render.
- Employee names, the salon name and the licence number are user text. They are
  rendered as React text nodes (escaped), with `dir="auto"` for names.
- The logo is the stored Blob URL from settings, rendered as an `<img>` with
  `alt` = salon name. When it is missing, a neutral placeholder or no logo is shown.

## Testing

- **Automated:** `pnpm test` (new `closingStatement` and permission tests),
  `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`. No Verify command or browser
  test command exists, so none is claimed.
- **Manual** (`pnpm dev`):
  1. As Admin, open `/reports/closing` for a settled month. Check that paid revenue
     equals that month's PAID total in `/reports/revenue`, that each employee row
     matches `/settlements?month=…`, that salon expenses match `/reports/expenses` for
     the month, and that Net = revenue − earnings − salon expenses.
  2. Pick a month where one employee has invoices but no settlement. Their row shows
     "Not settled" and the net shows Provisional with a link to settlements.
  3. Mark a paid invoice in a DRAFT-settled month as unpaid. The employee row shows
     "Out of date".
  4. As Staff, and as a Supervisor without `expenses.view`, the page redirects to
     `/forbidden`, and Staff don't see the sidebar item.
  5. Print preview in EN and AR shows only the sheet.

## Notes for the AI

- The overview lists "receipt/PDF printing" as out of V1. That means invoice receipts.
  The user explicitly approved browser printing for this statement, so no PDF library
  is added.
- "Employee earnings" deliberately includes adjustments: a correction to an earlier
  payout is a cost in the month it is applied.
- Don't recalculate settlements here. Stored values are the contract (feature 13).
  Only the out-of-date comparison reads live revenue.
- Follow the existing settlement report page's patterns for formatting, tables,
  `numberCell` and `panelClass`. Keep the sheet's own look per the design reference.
- Keep queries constant in number (feature 29d).

## Implementation notes

- **Month selector:** `ClosingMonthSelect` is a server-rendered GET form (labelled select plus a Show button), the same pattern as `SettlementReportControls`, instead of a client select that navigates on change. It works without JavaScript and adds no client code.
- **`closingStatement` input:** it takes `expectedEmployees` (with name and image) instead of bare ids. The loader fetches details only for expected employees without a settlement, which is still one query.
- **Security matrix:** `lib/security-matrix.test.ts` now pins `canViewClosingStatement` (allowed for Admin and default Supervisor; denied for Staff even with every key, and for a Supervisor with no keys) and the new sidebar item.
- **Print layout:** `app/(app)/layout.tsx` wraps the skip link, sidebar and header in `print:hidden` `display: contents` wrappers. `app/globals.css` forces the light palette under `@media print` so a dark-theme print is still black on white.



<!-- blueprint:completion {"schemaVersion":1,"specBytes":13555,"specSha256":"6098b6b76d157503d33ae811a0b408d6cd461e4acb54c1b4db3867c7531b95ab","branch":"refs/heads/feature/monthly-closing-statement","head":"d589c2859cc83f1854e8c48d9f9c3207f3f86cad","baseRef":"refs/heads/main","baseCommit":"d65908c0eed5d58381cd12ce8044d2de1616c293","sourceTree":"467929d6dbb6e441644aaf67b15f107c4cf0db02","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** d589c2859cc83f1854e8c48d9f9c3207f3f86cad
**Base commit:** d65908c0eed5d58381cd12ce8044d2de1616c293
**Base ref:** refs/heads/main
**Spec hash:** 6098b6b76d157503d33ae811a0b408d6cd461e4acb54c1b4db3867c7531b95ab
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-11-16T20:18:22Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-11-16T20:22:22Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base refs/heads/main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base and spec hash match the request; only `blueprint/context/review.md` differed)
- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm test`: pass (43 files, 907 tests)
- `pnpm build`: pass (`/reports/closing` built as a dynamic route)
- EN/AR locale key parity script (node, read-only): pass (no key missing in either locale)

### Evidence

- Whole `d65908c..d589c28` delta reviewed (18 files): `lib/reports.ts`, `lib/reports-data.ts`, `app/(app)/reports/closing/page.tsx` and `loading.tsx`, `app/(app)/layout.tsx`, `app/globals.css`, `components/reports/ClosingMonthSelect.tsx`, `components/reports/PrintButton.tsx`, `lib/navigation.ts`, the three test files, both locales, and the plan/spec/overview docs; the reference PNG is a design input only.
- Money: `closingStatement` uses `Prisma.Decimal` throughout; `net = paidRevenue − (Σ employeeShare + Σ totalAdjustments) − Σ salon expenses`; advances are summed for display only; `stillToPay` excludes `PAID`; unsettled rows add live revenue to the revenue total only. Tests cover the formula, a negative adjustment, a negative net, 0.10 + 0.20 exactness, not-settled, out-of-date, and an empty month. Conversion to number happens only at `Intl` formatting, as in the other report pages.
- Security: `page.tsx:39-40` runs `requireSession` and `canViewClosingStatement` (non-Staff plus `reports.view`, `settlements.view`, `expenses.view`) and redirects before `loadClosingStatement`; `loading.tsx` renders only a skeleton. The month comes only from `searchParams` and is validated by `parseSettlementMonth` (regex plus strictly before the current salon month; arrays fall back). Salon name, licence and employee names render as React text nodes with `dir="auto"`; the logo uses `next/image` under the existing Blob `remotePatterns`, as `LogoForm` does. No server action or stored state was added.
- Performance: `loadClosingStatement` runs seven queries in one `Promise.all` plus at most one `user.findMany` for unsettled ids; the count is independent of the number of employees.
- Layout: the `display: contents` + `print:hidden` wrappers keep `SkipLink` as the first focusable element and leave the flex layout of the sticky sidebar and header unchanged on screen; the unlayered `@media print .dark` block overrides the dark tokens for printing.
- Checked against `AGENTS.md`, the spec, and the relevant coding standards (Decimal money, escaped user text, constant queries, EN/AR parity).

### Findings

- F-69 [P3] open: Closing statement sidebar link visible on `expenses.view` alone, so some custom-permission viewers get a link to `/forbidden` (spec-directed; same family as F-50)
- F-70 [P3] open: no test pins permission-before-load or the loader's constant query count
- F-71 [P3] unverified: expected-employee rule leaves out pending-adjustment-only employees that `generateSettlements` includes
- No P0 or P1 findings

### Remaining risk

- Check was not required and was not run; no browser, print preview (EN/AR, light/dark), or running-app evidence was inspected.
- No `Verify` command exists (unavailable).
- No browser test command exists (unavailable).
- Loader and page behavior against a real database (Prisma `groupBy`/`aggregate` results, Blob logo rendering) is verified by reading code and types only.
