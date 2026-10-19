# Feature: Empty states

**From build-plan:** feature 29b
**Build attempt:** 1
**Branch:** feature/empty-states
**Status:** verified

## Goal

Every list, table, report section, and tab that can have nothing to show uses one
shared empty-state component with one look. Wording always says which case it
is: "nothing here yet" (the record type has no data at all) or "no results for
these filters" (filters, a period, or a month hide everything), in English and
Arabic.

## In scope

- One shared server-safe component, `EmptyState`, replacing the copies that exist
  today: `components/reports/ReportEmptyState.tsx`, the local `EmptyState` in
  `app/(app)/dashboard/page.tsx`, `app/(app)/reports/revenue/page.tsx`, and
  `app/(app)/reports/expenses/page.tsx`, and the hand-written empty markup on the
  list pages and tabs below.
- Two layouts of the same pattern:
  - **List**: icon chip, heading, description, optional action link. Used where a
    whole list or table is empty.
  - **Section**: icon chip and description only. Used inside a dashboard or report
    panel, or a sub-list on a detail page.
- Consistent rules:
  - Filtered list with no rows: "No matching …" heading, "No … match these
    filters." description, and a **Clear filters** link to the unfiltered URL.
  - Unfiltered list with no rows: "No … yet" heading, a description that depends
    on whether the viewer can create (existing `empty.create` / `empty.view`
    keys), and a link to the create page when the viewer may create and a
    `/…/new` route exists.
  - Period- or month-scoped views (reports, dashboard period panels, the
    settlements month) count as filtered: wording names the period ("in this
    period", "for this month"). No extra query is made to tell "never had data"
    apart from "none in this period".
- Surfaces covered:
  | Surface | Kind | Today |
  | --- | --- | --- |
  | `/transactions` | list, filters | both cases; no create link |
  | `/expenses` | list, filters | both cases; no create link |
  | `/services` | list, no filters | nothing-yet; no create link |
  | `/settlements` | list, month-scoped | month wording; generate form already on page, no link |
  | `/audit-log` | list, no filters | plain text only; gains heading |
  | Employee profile Invoices tab | list, filters | both cases |
  | Employee profile Expenses tab | list, filters | both cases, has create link |
  | Settlement detail Adjustments | section | plain text only |
  | Dashboard: latest invoices, top services, personal settlement, revenue chart | section | local copy / chart-own markup |
  | Reports: revenue, expenses, settlements, employee performance list and detail (incl. profile Performance tab) | section | `ReportEmptyState` / local copies |
- New EN/AR keys where a heading or wording is missing (audit log heading), with
  identical key sets in `locales/en.json` and `locales/ar.json`.
- A unit test that `locales/en.json` and `locales/ar.json` have the same key set.

## Out of scope

- `/employees` list: it always contains at least the signed-in viewer, so it
  cannot be empty.
- Non-list notes that are not empty states of a list: the employee earnings
  panel "No paid invoices this month" note, settings "No logo uploaded",
  settlement actions "none" text, the invoice create page "no services"
  prerequisite message, and the audit log's per-row empty change cell.
- Create links on the employee Invoices tab (no employee-preselected create route
  is confirmed) and on `/settlements` (generate is a form already on the page).
- Accessibility fixes beyond what the component itself needs (29c), loading and
  error states (29a, done), query or performance changes (29d).
- Any change to data, queries, permissions, or routes.

## Build loop

`workflow.stepReview` is `feature`: implement all steps, then present one review
packet for the whole feature. `workflow.checkpointCommits` is `disabled`: no
commits during implementation. `/complete` creates the final feature commit.

## Build steps

- [x] 1. **Shared component and locale parity test.** Add
  `components/ui/empty-state.tsx` exporting `EmptyState` with props `icon`
  (`LucideIcon`), optional `title`, `description`, optional `action`
  (`ReactNode`), optional `headingLevel` (`"h2" | "h3"`, default `"h2"`), and
  optional `className`. With `title` it renders the List layout, without it the
  Section layout. One icon chip for both (`size-11 rounded-xl bg-primary-soft
  text-primary`, icon `aria-hidden`), centered, logical-property utilities only,
  no hooks so it renders in server and client components. Add
  `i18n/locale-keys.test.ts` that flattens both locale files and asserts the same
  key set; fix any existing drift it reveals (keys only, no wording changes
  beyond adding the missing translation).
  **Done when:** `pnpm test` passes including the new parity test, and
  `pnpm exec tsc --noEmit` passes.

- [x] 2. **Reports and dashboard sections.** Replace `ReportEmptyState` and the
  local `EmptyState` copies in the dashboard, revenue report, and expenses report
  with `EmptyState` (Section layout, existing period wording and icons). Delete
  `components/reports/ReportEmptyState.tsx`. Use it in `RevenueChart`'s empty
  branch too, keeping its `h-64` height so the panel does not jump.
  **Done when:** no `ReportEmptyState` or local `EmptyState` definition remains
  (`grep`), `pnpm exec tsc --noEmit` and `pnpm lint` pass, and an empty period on
  the dashboard and each report shows the shared chip and period wording.

- [x] 3. **List pages.** Use `EmptyState` (List layout) on `/transactions`,
  `/expenses`, `/services`, `/settlements` (`headingLevel="h3"`, keeping its
  border-top spacing via `className`), and `/audit-log`. Filtered and unfiltered
  cases follow the rules above; add the create link on `/transactions`,
  `/expenses`, and `/services` behind the same permission check each page already
  uses for its header "New" button. Give the audit log a heading: change
  `audit.empty` to `{ "title", "description" }` in both locales (EN: "No activity
  yet" / "No activity recorded yet."; AR equivalent).
  **Done when:** `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm test` pass;
  each page shows the right case for an empty unfiltered list and for filters
  that match nothing, with Clear filters returning the unfiltered list and the
  create link only for a viewer with create permission.

- [x] 4. **Profile tabs and settlement adjustments.** Use `EmptyState` on the
  employee Invoices and Expenses tabs (List layout, `headingLevel="h3"`, existing
  keys and links) and the settlement detail Adjustments list (Section layout,
  existing `adjustments.empty`, `PenLine` icon).
  **Done when:** no hand-written empty-state markup remains in the surfaces table
  (`grep` for the old `bg-primary-soft text-primary` chip outside the component
  shows none of them), `pnpm build` succeeds, and both tabs show both cases in
  EN and AR (RTL) in light and dark themes.

## Files / areas

- New: `components/ui/empty-state.tsx`, `i18n/locale-keys.test.ts`
- Removed: `components/reports/ReportEmptyState.tsx`
- Pages: `app/(app)/transactions/page.tsx`, `app/(app)/expenses/page.tsx`,
  `app/(app)/services/page.tsx`, `app/(app)/settlements/page.tsx`,
  `app/(app)/settlements/[id]/page.tsx`, `app/(app)/audit-log/page.tsx`,
  `app/(app)/dashboard/page.tsx`, `app/(app)/reports/revenue/page.tsx`,
  `app/(app)/reports/expenses/page.tsx`, `app/(app)/reports/settlements/page.tsx`
- Components: `components/dashboard/RevenueChart.tsx`,
  `components/reports/EmployeePerformanceList.tsx`,
  `components/reports/EmployeePerformanceDetail.tsx`,
  `components/employees/EmployeeInvoicesTab.tsx`,
  `components/employee-expenses/EmployeeExpensesTab.tsx`
- Locales: `locales/en.json`, `locales/ar.json`

## Data / contracts

- No database, query, route, permission, or server-action changes.
- `EmptyState` props: `icon: LucideIcon; title?: string; description: string;
  action?: ReactNode; headingLevel?: "h2" | "h3"; className?: string`.
- All text comes from translation keys; no user-controlled text is rendered, so
  React's default escaping is sufficient.
- Locale change: `audit.empty` becomes an object with `title` and `description`
  in both files. Every other existing `empty` key keeps its shape and wording.

## Testing

- Unit: `i18n/locale-keys.test.ts` (key-set parity between `en.json` and
  `ar.json`) with `pnpm test`. The component is UI and is not unit tested, per the
  coding standards.
- Each step: `pnpm exec tsc --noEmit` and `pnpm lint`; final step `pnpm build`.
- UI evidence for `/check`: empty and filtered-empty states in EN and AR, light
  and dark. No Browser tests command exists, so no browser automation is added.
- No Verify command is declared, so none was run while writing this spec.

## Notes for the AI

- Read the relevant guide in `node_modules/next/dist/docs/` before touching page
  conventions; this Next.js version differs from training data.
- Chip style is one reversible choice: the list pages' `bg-primary-soft
  text-primary rounded-xl` chip is used everywhere, replacing the muted round
  chip in report and dashboard panels.
- Keep each page's existing permission checks and filter detection
  (`Object.keys(filters).length > 0`); only the rendering changes.
- Pass the existing per-page `linkClass` styling into `action`; do not add a new
  link style.
- Keep heading levels correct for where the state sits: `h2` directly under a
  page `h1`, `h3` inside a section that already has an `h2`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9558,"specSha256":"19cd57c316a05561e024a157fafa4f09d7613ed65da3caa8929387c3fb55d3d3","branch":"refs/heads/feature/empty-states","head":"cc1063e39a332c5c5f6620afb482ff6da49feae3","baseRef":"refs/heads/main","baseCommit":"cc1063e39a332c5c5f6620afb482ff6da49feae3","sourceTree":"cb5595b94773c6444c0f6b06b861e8b67f6fcd65","absentOptional":[]} -->
