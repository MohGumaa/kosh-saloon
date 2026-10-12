# Fix: Revenue by employee first names

**Type:** Fix
**Status:** verified
**Branch:** fix/revenue-by-employee-first-names

## The problem

The "Revenue by employee" table on `/reports/revenue`
(`app/(app)/reports/revenue/page.tsx`) shows each employee's full name, for
example "Tamir Abdelrahman". The user wants only the first name ("Tamir").

## The fix

- **Short label:** the first name is the stored name, trimmed, up to the first
  run of whitespace. A name with no space is shown in full.
- **Clashes:** when two or more employees in the same table have the same first
  name, those rows show the full name instead. The comparison is
  case-insensitive and uses the page locale. Other rows keep the first name.
- **Tooltip:** a row that shows a shortened name gets `title` with the full
  name.
- **Unchanged:**
  - `UserAvatar` initials still come from the full name.
  - Rows still sort by gross, then by full name.
  - The inactive badge, the service table, the figures, the permission gating,
    and the RTL and dark layouts stay as they are.
- **Where:** one pure helper in `lib/reports.ts`, for example
  `employeeLabels(names, locale)`, returns the label for each row. The page uses
  it only for the employee table. No new components, translation keys, or
  dependencies.

## Build steps

- [x] **1. Add the label helper and use it in the employee table.**
  - Add the helper to `lib/reports.ts`, with tests in `lib/reports.test.ts`:
    - a first name is returned
    - a single-word name is returned in full
    - extra spaces are trimmed
    - two names with the same first name both return the full name
    - a case-only difference ("tamir" and "Tamir") counts as a clash
    - Arabic names follow the same rules
  - In `page.tsx`, show the label in the employee name cell, add `title` when
    the label differs from the full name, and keep the avatar's `name` as the
    full name.

  _Done when:_ the new tests and `pnpm exec tsc --noEmit` pass, and the employee
  table shows first names, or full names when first names clash.

- [x] **2. Final verification.** Run `pnpm test`, `pnpm lint`,
  `pnpm exec tsc --noEmit`, and `pnpm build`.

  _Done when:_ all four pass.

## Verify

1. Run `pnpm dev`, sign in as an Admin, and open `/reports/revenue` for a period
   with invoices from several employees.
2. "Revenue by employee" shows "Tamir" rather than "Tamir Abdelrahman". Hovering
   the name shows the full name.
3. If two employees share a first name, both rows show their full names.
4. The avatars still show the same initials as before.
5. Switch to Arabic. Arabic names show only the first word.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2630,"specSha256":"40ed1d6b101c1664bae4af3ff1df9c7332d4c31518ec322d125fe9a29fe7f216","branch":"refs/heads/fix/revenue-by-employee-first-names","head":"52e31be48b1662a17007fab93e8394017d2f43c5","baseRef":"refs/heads/main","baseCommit":"52e31be48b1662a17007fab93e8394017d2f43c5","sourceTree":"1fe3611ebb4dfeb4234e8f8e2ab18d5af07375b9","absentOptional":[]} -->
