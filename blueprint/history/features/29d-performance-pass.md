# Feature: Performance pass

**From build-plan:** feature 29d
**Build attempt:** 1
**Branch:** feature/performance-pass
**Status:** verified

## Goal

Review database queries (repeated per-row queries, missing indexes, unbounded
lists), client bundle size, and build output, then fix only what the evidence
shows. There are no user-visible behavior changes: every page shows the same data,
in the same order, with the same permissions.

## In scope

- One written baseline covering:
  - every page and report loader's queries: per-row (N+1) patterns, unbounded
    `findMany` on tables that keep growing, and duplicate reads within one request
  - index coverage of each `where`/`orderBy` on the growing tables
  - the client bundle per main route
  - `pnpm build` output (warnings, route list).
- Fixes for each item in that baseline that has evidence behind it, chosen from the
  candidate list below.
- A before/after comparison for every change made.

## Out of scope

- Load testing, seeding synthetic data, or adding monitoring/APM.
- New dependencies, including `@next/bundle-analyzer`. Next 16.3's built-in
  `next experimental-analyze` covers this.
- Caching layers (`"use cache"`, `unstable_cache`, Redis, CDN rules) that change
  how fresh financial data is.
- Full-text or trigram search indexes for the invoice `q` search
  (`lib/invoices.ts:302`). This is salon scale, so `ILIKE` is acceptable.
- Moving dashboard/report chart bucketing into SQL (F-46), unless step 1 gives
  measured evidence that it is slow. "Unverified at scale" alone does not justify it.
- Repairing unrelated open findings (F-20 to F-56). They are not performance work.
- E2E tests (29e) and the production checklist (29f).

## Build loop

`workflow.stepReview` is `feature` and `checkpointCommits` is `disabled`. Build all
steps, then hand over one review packet. **The one exception:** stop after step 1
and show the baseline and the proposed fix list. Which fixes get built depends on
that evidence, and the user approves it before any code changes. `/complete` makes
the final commit.

## Build steps

- [x] **1. Baseline (no code changes).**
  - Run `pnpm build` and save the route list and any warnings.
  - Run `pnpm next experimental-analyze --output` (writes to
    `.next/diagnostics/analyze`, which is git-ignored) and note the client JS for
    `/dashboard`, `/transactions`, `/transactions/new`, `/reports/revenue`,
    `/reports/employees`, and `/settlements`. Also note which routes pull in
    `recharts`.
  - Read every loader that runs a query (list below) and fill one table: route or
    function | queries per request | per-row? | unbounded? | index used | duplicate read?
  - Check whether `getSalonSettings` (`lib/settings.ts:17`, not wrapped in
    `cache`) runs more than once in one render, for example in a page plus a child
    server component such as `EmployeeEarningsPanel` or `EmployeeInvoicesTab`.
  - If the local database has data, run `EXPLAIN ANALYZE` through
    `pnpm exec prisma db execute` or psql for the invoice list default query, the
    paid-revenue `groupBy`, and the dashboard `last12` row read. Record only what
    was actually run.
  - **Done when:** the baseline table and the proposed fix list (each fix tied to a
    table row) are added under "Baseline evidence" in this spec, and the user has
    approved the list.

- [x] **2. Request-level duplicate reads.** Do this only if step 1 found any. _Skipped: step 1 found no duplicate reads._
  - Wrap the request-path read in React `cache` the same way
    `lib/auth/current-user.ts:6` and `lib/auth/authorize.ts:11` do.
  - Keep the `client` parameter path uncached. Server actions call
    `getSalonSettings(tx)` inside transactions, and a cached value must never leak
    into a transaction.
  - **Done when:** a page that read settings twice now reads them once (confirmed
    by reading the call graph, or by Prisma query logging if it was used), and
    `pnpm test` passes.

- [x] **3. Indexes.** _Skipped: step 1 found no missing index._ Do this only for queries step 1 shows are not served by an
  existing index on a growing table (`Invoice`, `SalonExpense`, `EmployeeExpense`,
  `AuditLog`, `Session`, `EmployeeSettlement`, `SettlementAdjustment`).
  - Add `@@index` in `prisma/schema.prisma`.
  - Create one migration with
    `pnpm exec prisma migrate dev --name performance-indexes`.
  - Confirm `pnpm exec prisma migrate status` is clean.
  - Indexes only: no column, type, or data changes.
  - **Done when:** `pnpm exec prisma validate` passes, the migration contains only
    `CREATE INDEX` statements, and `EXPLAIN` (if available) shows the index in use.

- [x] **4. Unbounded lists and per-row queries.** _Skipped: step 1 found none._ Do this only for items step 1
  confirms.
  - Bound a list with the existing pagination pattern (`resolvePage` plus
    `take`/`skip`, as on `/transactions`), or replace a per-row query with one
    `groupBy`/`in` query.
  - Order, totals, and permission scope must stay the same.
  - **Done when:** the loader's query count no longer grows with the row count, and
    existing tests plus a new focused test (when the change is in a `lib/` function
    with a mocked `db`, as in `actions/settlements.test.ts`) pass.

- [x] **5. Client bundle.** _Done: zod moved out of client imports through `lib/form-constants.ts`; next/dynamic was not needed._ Do this only for items step 1 shows, for example
  `recharts` or another heavy client module in the shared chunk or on a route that
  does not render it.
  - Fix the import boundary, for example with `next/dynamic` for the chart. Keep
    the existing loading skeleton and the `sr-only` table fallback.
  - **Done when:** a second `experimental-analyze` run shows the module gone from
    the affected route or shared chunk, and the chart still renders on
    `/dashboard` and `/reports/revenue`.

- [x] **6. Final verification.**
  - Run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build`.
  - Re-run the analyzer if step 5 changed anything.
  - Add an "After" column to the baseline table.
  - **Done when:** all four commands pass and every fix has a before/after entry.
    If a step was skipped because the evidence showed nothing to fix, it says so.

## Files / areas

**Loaders to review:**
- Pages: `app/(app)/**/page.tsx` (dashboard, transactions, transactions/[id],
  transactions/new, expenses, employees, employees/[id], services, settlements,
  settlements/[id], audit-log, settings, reports/*)
- `lib/dashboard-data.ts`, `lib/reports-data.ts`
- `components/employees/EmployeeInvoicesTab.tsx`,
  `components/employees/EmployeeEarningsPanel.tsx`,
  `components/employee-expenses/EmployeeExpensesTab.tsx`
- `actions/settlements.ts` (generation was already batched by the
  settlement-transaction-timeouts fix; confirm only)

**Likely edit targets:**
- `lib/settings.ts`
- `prisma/schema.prisma` and `prisma/migrations/`
- `components/dashboard/RevenueChart.tsx` and the pages that import it

## Data / contracts

- Any migration contains only additive `CREATE INDEX` statements. It needs no data
  backfill and can be reversed by dropping the index.
- No changes to stored values, API/action result shapes, URLs, search params, sort
  order, pagination size, or permission checks.
- Every query stays behind its existing `requirePermission` / `isOwnScope` checks.
  Staff scoping (`employeeId: user.id`) must be preserved exactly in any rewritten
  query.

## Testing

- `pnpm test` (Vitest) must pass.
- Add a focused test only when a `lib/` loader's query shape changes. Use a mocked
  `db`, as `actions/settlements.test.ts` does, to assert the query count and that
  the Staff scope is kept.
- No browser test command exists yet (29e). The chart-render check in step 5 is a
  manual `pnpm dev` check, recorded as manual.
- Do not claim any timing that was not measured.

## Notes for the AI

**What the code shows now** (from reading it, not measured):
- Invoice and expense lists, the audit log, and the employee tabs already paginate
  with `count` plus `take`/`skip`.
- Indexes already exist for: `Invoice(createdAt)`, `Invoice(employeeId, createdAt)`,
  `SalonExpense(date)`, `EmployeeExpense(employeeId, date)`,
  `EmployeeSettlement(employeeId, periodStart)` (unique), and
  `EmployeeSettlement(periodStart)`. That covers the main filters, so step 3 may
  find nothing to add.
- Session and permission reads are already request-cached. `getSalonSettings` is
  not.
- Report and dashboard row reads are capped at 366 days (`lib/dashboard.ts:23`).
- `recharts` is imported by `components/dashboard/RevenueChart.tsx`, which is used
  on the dashboard, the revenue report, and the employee performance view.

**Rules for the fix steps:**
- An empty fix step is a valid outcome. Do not invent work to fill one.
- Read `node_modules/next/dist/docs/01-app/02-guides/package-bundling.md` before
  using the analyzer or `next/dynamic`.
- The lists of users and services are not paginated. These tables stay small at
  salon scale, so leave them unbounded unless the evidence says otherwise.

## Baseline evidence

Recorded 2026-11-16 on `feature/performance-pass`, base commit `1ef44de`.

### Build output

`pnpm build` (Next 16.3.8, Turbopack): compiled successfully with no warnings.
TypeScript passed. There are 32 app routes, all dynamic (`ƒ`), plus the Proxy.

### Client bundle

Source: `pnpm next experimental-analyze --output`, reading
`.next/diagnostics/analyze/data/<route>/analyze.data`. Sizes are raw
(uncompressed) bytes of JS in `/_next/static/chunks/`. Each figure is every chunk
the route *can* load. The App Router fetches a client component's chunks only when
that component renders.

| Route | Client JS | zod | recharts |
| --- | --- | --- | --- |
| /login | 879k | 0 | 0 |
| /transactions | 1203k | 0 | 0 |
| /transactions/new | 1610k | **381k** | 0 |
| /expenses/new, /expenses/[id] | 1597–1599k | **381k** | 0 |
| /employees/new | 1498k | **381k** | 0 |
| /employees/[id] | 1978k | **381k** | 239k (Performance tab only) |
| /employees/[id]/expenses/new, /[expenseId] | 1597–1599k | **381k** | 0 |
| /settings | 1476k | **381k** | 0 |
| /settlements/[id] | 1464k | **381k** | 0 |
| /dashboard, /reports/revenue, /reports/employees | 1516–1517k | 0 | 239k |
| /settlements, /services, /audit-log, /employees | 1052–1054k | 0 | 0 |

**What this shows:**
- zod is about 24% of the client JS on 9 form routes. No client component
  validates with zod: validation runs in server actions. zod gets in because eight
  `"use client"` files import a plain constant from a `lib/` module that also
  builds zod schemas at module level. Those module-level `z.*()` calls are side
  effects, so they can't be tree-shaken:

  | Client file | Imports | From |
  | --- | --- | --- |
  | `components/invoices/InvoiceCreateForm.tsx` | `MAX_INVOICES_PER_CREATE` | `lib/invoices` |
  | `components/expenses/ExpenseFields.tsx` | `DESCRIPTION_MAX`, `EXPENSE_CATEGORIES`, `TITLE_MAX` | `lib/expenses` |
  | `components/employee-expenses/EmployeeExpenseFields.tsx` | `EMPLOYEE_EXPENSE_CATEGORIES`, `DESCRIPTION_MAX` | `lib/employee-expenses`, `lib/expenses` |
  | `components/settlements/SettlementAdjustmentForm.tsx` | `DESCRIPTION_MAX` | `lib/expenses` |
  | `components/employees/EmployeeFields.tsx` | `ROLES` | `lib/employees` |
  | `components/employees/EmployeeImageForm.tsx` | `LOGO_MAX_BYTES` | `lib/settings-validation` |
  | `components/settings/LogoForm.tsx` | `LOGO_MAX_BYTES` | `lib/settings-validation` |
  | `components/settings/NotificationsForm.tsx` | `CHECKBOX_ON` | `lib/settings-validation` |

- recharts loads only on routes that draw a chart. On `/employees/[id]`, the chart
  renders only in the Performance tab, so other tabs don't download it. No fix.
- `cn` (shadcn's clsx + tailwind-merge replacement, about 31k compressed on every
  route) is the project's class helper. No fix.
- Most of the analyzer's `[client-fs]` share is fonts (`.woff2` per script subset)
  and the favicon, not JS. No fix.

### Queries

These findings come from reading the code. I did not run `EXPLAIN ANALYZE`,
because the only configured database URL is the shared `.env` one, and I didn't
run ad-hoc queries against it.

| Area | Queries per request | Per row? | Unbounded? | Index | Duplicate read? |
| --- | --- | --- | --- | --- | --- |
| /transactions list | count + page + users + services + settings | no | no (`take`) | `Invoice(createdAt)`, `(employeeId, createdAt)`, `(serviceId)` | no |
| /expenses list | count + page + settings | no | no (`take`) | `SalonExpense(date)` | no |
| /audit-log | count + page + one user `in` | no | no (`take`) | `AuditLog(createdAt)` | no |
| Employee tabs (invoices, expenses, earnings) | count + page or aggregate | no | no (`take`) | `(employeeId, createdAt)` / `(employeeId, date)` | no |
| /settlements, /settlements/[id] | one `findMany` by month + adjustments | no | bounded by employees | `EmployeeSettlement(periodStart)`, unique `(employeeId, periodStart)` | no |
| /employees, /services, user/service pickers | one `findMany` | no | yes, small tables | n/a | no |
| Dashboard and reports (`lib/dashboard-data.ts`, `lib/reports-data.ts`) | parallel `groupBy`/`aggregate` plus one row read for charts | no | capped at 366 days | `Invoice(createdAt)`, expense `date` indexes | no |
| Settlement generation (`actions/settlements.ts`) | batched `groupBy`s (fix settlement-transaction-timeouts) | no | n/a | covered | n/a |
| `getSalonSettings` | at most one call per render: one per page, and on `/employees/[id]` one per active tab | no | n/a | primary key | **no** |
| Expired session cleanup (`lib/auth/session.ts:88`) | `deleteMany expiresAt <= now` | no | n/a | none on `expiresAt` | no |

**What this shows:**
- No per-row queries, no unbounded list on a growing table, and no duplicate read
  in one request.
- Every list and aggregate filter on a growing table already has an index.
- The session cleanup has no index on `expiresAt`, but that cleanup keeps the
  table small, so an index would cost more on writes than it saves. No fix.
- F-46 (chart row read for up to 366 days) stays unmeasured. There is no measured
  slowness, so per the spec it stays out of scope.

### Proposed fix list (for approval)

1. **Step 5, client bundle: keep zod out of the browser.**
   - Add one module with no imports, `lib/form-constants.ts`, holding the eight
     constants above with their current values and types.
   - The original modules import those constants from the new module and
     re-export them, so server code and tests keep their imports.
   - The eight client files import from `@/lib/form-constants` instead.
   - **Expected result:** zod drops to 0 on all 9 routes, roughly 381k raw JS
     less on each.
   - **Behavior:** unchanged. The same values reach the same inputs and limits.
2. **Step 2: skip.** There are no duplicate reads.
3. **Step 3: skip.** No index is missing.
4. **Step 4: skip.** No per-row queries or unbounded growing lists.

The user approved this list on 2026-11-16.

### After

Measured by re-running `pnpm next experimental-analyze --output` after step 5.
Sizes are raw client JS.

| Route | Before | After | zod before → after |
| --- | --- | --- | --- |
| /transactions/new | 1610k | 1226k | 381k → 0 |
| /expenses/new | 1597k | 1212k | 381k → 0 |
| /expenses/[id] | 1599k | 1214k | 381k → 0 |
| /employees/new | 1498k | 1115k | 381k → 0 |
| /employees/[id] | 1978k | 1595k | 381k → 0 |
| /employees/[id]/expenses/new | 1597k | 1212k | 381k → 0 |
| /employees/[id]/expenses/[expenseId] | 1599k | 1214k | 381k → 0 |
| /settings | 1476k | 1093k | 381k → 0 |
| /settlements/[id] | 1464k | 1079k | 381k → 0 |
| All other routes | unchanged | unchanged | 0 → 0 |

Final checks:
- `pnpm lint`: exit 0
- `pnpm exec tsc --noEmit`: exit 0
- `pnpm test`: 43 files, 889 tests passed
- `pnpm build`: compiled successfully with no warnings

Not run: a manual browser check of the nine forms. The constant values and types
are unchanged and the typecheck covers every import.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16108,"specSha256":"d01644e41cc3218d94dba9727f6094226ea48fbf2f226e2ca25c115ff09b142c","branch":"refs/heads/feature/performance-pass","head":"1ef44de0fec1aeb621c4dae5eb441a2525f3d837","baseRef":"refs/heads/main","baseCommit":"1ef44de0fec1aeb621c4dae5eb441a2525f3d837","sourceTree":"63ba3b2b51aed852ff517098e5bf8225f9cc3c79","absentOptional":[]} -->
