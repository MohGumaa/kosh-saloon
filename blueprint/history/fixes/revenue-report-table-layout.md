# Fix: Revenue report table layout

**Type:** Fix
**Status:** verified
**Branch:** fix/revenue-report-table-layout

## The problem

The tables on `/reports/revenue` (`app/(app)/reports/revenue/page.tsx`, from feature 16):

- "Revenue by service" and "Revenue by employee" show an **Unpaid** column. The
  user doesn't want it there.
- The **Invoices** count is right-aligned like the money columns in all three
  tables. It should be centered.
- The employee names in "Revenue by employee" are plain text with no picture.

## The fix

- **By service and by employee:** drop the Unpaid column from the header, body,
  and totals row. Keep the Service/Employee, Invoices, Paid, and Gross columns.
  Gross stays paid + unpaid, so the unpaid amount is still counted there.
- **Revenue over time:** keep all its columns, including Unpaid.
- **Invoices column:** centered (`text-center`) in the header, body, and totals
  row of all three tables. Money columns stay end-aligned with `tabular-nums` and
  `dir="ltr"`.
- **Employee avatar:** in "Revenue by employee", show `UserAvatar` (the profile
  image, otherwise initials) before each name, the same as elsewhere in the app.
  `loadRevenueReport` also selects `image` for employees. The avatar stays
  decorative (`aria-hidden`); the name text is unchanged. Service names get no icon.
- **Must not break:**
  - No changes to the figures, totals, permission gating, the chart, the summary
    cards, or the RTL/dark layout.
  - The by-employee query still runs only with `reports.view_all_employees`.
  - Tables still scroll sideways on narrow screens.
- No new translation keys, components, or dependencies.

## Build steps

- [x] **1. Adjust the three tables and the employee lookup.** In `page.tsx`:
  - Let the shared heading and amount-cell helpers take the column list, so the
    breakdown tables render `invoices, paid, gross` and the time table renders
    `invoices, paid, unpaid, gross`.
  - Center the Invoices cells.
  - Add `UserAvatar` to the employee name cell.
  - In `lib/reports-data.ts`, add `image: true` to the employee `findMany` select.

  _Done when:_ `pnpm exec tsc --noEmit` and `pnpm lint` pass, and the page shows
  the column sets above with centered invoice counts and employee avatars.

- [x] **2. Final verification.** Run `pnpm test`, `pnpm lint`,
  `pnpm exec tsc --noEmit`, and `pnpm build`.

  _Done when:_ all four pass.

## Verify

1. Run `pnpm dev`, sign in as an Admin, and open `/reports/revenue`.
2. "Revenue by service" and "Revenue by employee" show Invoices, Paid, and Gross,
   with no Unpaid. "Revenue over time" still shows Unpaid.
3. The invoice counts sit in the middle of their column in all three tables,
   including the totals rows.
4. Each employee row starts with that employee's photo, or their initials when
   they have no photo.
5. Repeat in Arabic. The avatar sits on the start (right) side, and the columns
   mirror correctly.

## Open questions

Not blocking. The spec uses the choices below; say if you want something else.

- "Icon for the employee name" is read as the employee's avatar (photo or
  initials), which is what the rest of the CRM uses.
- Gross is kept in the two breakdown tables.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3209,"specSha256":"b06ad994edb99ead6d43b1b186ae99cc144cfe52ea28b0c53f7ae74d9fa87791","branch":"refs/heads/fix/revenue-report-table-layout","head":"8f3739ae19493f5a20a21a9ec51ab9ed6e2fe0a9","baseRef":"refs/heads/main","baseCommit":"8f3739ae19493f5a20a21a9ec51ab9ed6e2fe0a9","sourceTree":"f4abfd263c9d6f1651a46ab8f4befbe695e25a2a","absentOptional":[]} -->
