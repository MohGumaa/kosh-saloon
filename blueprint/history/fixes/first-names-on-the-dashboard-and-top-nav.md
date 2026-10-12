# Fix: First names on the dashboard and top nav

**Type:** Fix
**Status:** verified
**Branch:** fix/first-names-on-the-dashboard-and-top-nav

## The problem

The revenue report's "Revenue by employee" table now shows first names
(`employeeLabels` in `lib/reports.ts`). The user wants the same rule in three
more places, which still show full names:

- the dashboard "Latest invoices" table, Employee column
  (`app/(app)/dashboard/page.tsx:419`)
- the top-nav user button (`components/layout/UserMenu.tsx:43`)
- the dashboard welcome heading (`app/(app)/dashboard/page.tsx:101`)

**Scope added after review (user request):** apply the same rule to every
list table in the app:

| Page | Columns |
| --- | --- |
| `/transactions` (`app/(app)/transactions/page.tsx`) | Employee, Created by |
| `/expenses` (`app/(app)/expenses/page.tsx`) | Created by |
| `/settlements` (`app/(app)/settlements/page.tsx`) | Employee |
| `/employees` (`app/(app)/employees/page.tsx`) | Name |
| `/audit-log` (`app/(app)/audit-log/page.tsx`) | User |

Excluded at the user's request: the employee details page (including its
expenses tab, `components/employee-expenses/EmployeeExpensesTab.tsx`) and the
account page. Single-record detail pages (invoice, expense, settlement) and
filter dropdowns are not tables and keep full names.

## The fix

- **Shared helper:** move `employeeLabels` from `lib/reports.ts` to a new
  `lib/names.ts`, along with its tests (`lib/reports.test.ts` to
  `lib/names.test.ts`).
  - Add `firstName(name)`: the trimmed name up to the first run of whitespace.
    `employeeLabels` uses it.
  - The file stays pure, with no database or server imports, because
    `UserMenu.tsx` is a client component.
  - The revenue page imports from the new file. Its behavior is unchanged.
- **Latest invoices:** the Employee column shows `employeeLabels` output.
  - Clashes are counted across distinct employees, not rows. Several invoices
    from the same employee are not a clash.
  - `lib/dashboard-data.ts` adds `id: true` to the invoice `employee` select so
    rows can be grouped by employee.
  - A shortened name gets `title` with the full name.
- **Top nav:** the button shows `firstName(user.name)`.
- **Welcome heading:** `t("welcome", { name: firstName(user.name) })`.
- **Keep the full name in:**
  - the user menu dropdown header (`UserMenu.tsx:53`)
  - the menu button's `aria-label` (`UserMenu.tsx:37`)
  - the dashboard account card (`page.tsx:118`)
  - every `UserAvatar` (initials)
- **Must not break:** the dashboard figures, permission gating, invoice links,
  RTL, or the revenue report. No new translation keys or dependencies. The only
  new component is `PersonName` (step 4).

## Build steps

- [x] **1. Move the helper and add `firstName`.**
  - Create `lib/names.ts` and `lib/names.test.ts`. Move the four existing
    `employeeLabels` tests and add tests for `firstName`: a two-word name, a
    single word, extra spaces, and an Arabic name.
  - Remove the helper and its tests from the reports files, and update the
    revenue page import.

  _Done when:_ `pnpm exec vitest run lib/names.test.ts lib/reports.test.ts` and
  `pnpm exec tsc --noEmit` pass.

- [x] **2. Use it on the dashboard and in the top nav.**
  - Latest invoices labels, with the employee `id` select.
  - Welcome heading.
  - `UserMenu` button text.

  _Done when:_ `pnpm exec tsc --noEmit` passes, and the three places show first
  names while the listed full-name places are unchanged.

- [x] **3. Final verification.** Run `pnpm test`, `pnpm lint`,
  `pnpm exec tsc --noEmit`, and `pnpm build`.

  _Done when:_ all four pass.

- [x] **4. A per-table label map and a name cell.**
  - Add `nameLabels(people, locale)` to `lib/names.ts`. It takes `{ id, name }`
    entries, removes duplicates by `id`, runs `employeeLabels`, and returns a
    `Map` from id to label, with tests.
  - One map covers every person in a table. Someone who appears in both the
    Employee and Created by columns gets the same label, and clashes are
    counted across all distinct people in that table.
  - Add a small server-safe `components/layout/PersonName.tsx` that renders
    `<span dir="auto" title=…>`, with the full name in `title` only when the
    label is shorter. Use it for the dashboard Latest invoices table too.

  _Done when:_ `pnpm exec vitest run lib/names.test.ts` and
  `pnpm exec tsc --noEmit` pass.

- [x] **5. Apply it to the list tables.** For each page in the table above, add
  `id: true` to the person `select`, build one `nameLabels` map from the rows,
  and render the column with `PersonName`. On `/employees`, the avatar and the
  permissions `aria-label` keep the full name.

  _Done when:_ `pnpm exec tsc --noEmit` passes, and each listed column shows
  first names.

- [x] **6. Final verification again.** Run `pnpm test`, `pnpm lint`,
  `pnpm exec tsc --noEmit`, and `pnpm build`.

  _Done when:_ all four pass.

## Verify

1. Run `pnpm dev`, sign in as an Admin, and open `/dashboard`.
2. The welcome heading reads "Welcome, Tamir" (or your first name). The account
   card still shows the full name.
3. "Latest invoices" shows first names in the Employee column. Several invoices
   from one employee still show the first name. Two different employees who share
   a first name show full names. Hovering a short name shows the full name.
4. The top-nav button shows the first name. Opening the menu shows the full name
   in the header.
5. Sign in as Staff. The personal dashboard welcome and the nav also show the
   first name.
6. Open `/transactions`, `/expenses`, `/settlements`, `/employees`, and
   `/audit-log`. The person columns show first names, with the full name on
   hover. The employee details page and the account page still show full names.
7. Switch to Arabic and repeat. `/reports/revenue` still shows first names in
   "Revenue by employee".


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5880,"specSha256":"8ef458ed4fd7dcfcb2d00381f96fcd999bf932a1fc6536656e3964eb4fa1b41c","branch":"refs/heads/fix/first-names-on-the-dashboard-and-top-nav","head":"946a3aada00a883cadda8ea3a95b59f1d29a1df6","baseRef":"refs/heads/main","baseCommit":"946a3aada00a883cadda8ea3a95b59f1d29a1df6","sourceTree":"e82462799a4fa92543256a0d0d9efd6fa5d75256","absentOptional":[]} -->
