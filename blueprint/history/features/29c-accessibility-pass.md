# Feature: Accessibility pass

**From build-plan:** feature 29c
**Build attempt:** 1
**Branch:** feature/accessibility-pass
**Status:** verified

## Goal

Make the CRM usable by keyboard and screen-reader users in both languages and
both themes. Check and fix five areas: form labels and error announcements,
keyboard focus in dialogs and drawers, landmarks and a skip link, icon-only
buttons, and contrast in both themes. This is a review-and-fix pass over
existing UI. It adds no new product behaviour.

## In scope

- **Skip link and landmarks.** Add a translated "Skip to main content" link as
  the first focusable element in the app layout and in the sign-in layout. It
  stays visually hidden until it gets focus, and it moves focus to `<main>`.
  Each layout keeps exactly one `<main>`. The header, the sidebar `aside` and
  the `nav` keep, or gain, accessible names where there is more than one of
  that landmark type.
- **Focus visibility.** Every focus indicator (buttons, inputs, selects,
  textareas, checkboxes, radios, calendar days, sidebar links) must reach at
  least 3:1 against its surrounding background in Light and Dark. This is
  WCAG 1.4.11. Measured today: `--ring` at 35% / 45% alpha, further halved by
  `ring-ring/50` in `components/ui/*`, gives about 1.7:1. `--sidebar-ring`
  gives about 2.9:1.
- **Text contrast.** Body text and small text must reach 4.5:1 in both themes.
  Known failures:
  - `text-primary` used as small text on dark cards: `#2f6bff` on `#111a2e` is
    about 3.85:1.
  - `--faint`: about 2.9:1 in Light and 3.2:1 in Dark, if it is used as text
    anywhere.

  Disabled controls are exempt; this covers the "coming soon" sidebar items.
  Known passes are recorded in Notes.
- **Forms.** Every input, select, textarea, date picker, checkbox and radio
  across all forms needs:
  - a programmatic label;
  - `aria-invalid` plus `aria-describedby` that points at its error and hint;
  - focus moved to the first invalid field, or to the form-level
    `FormMessage` (`role="alert"`), after a failed submit;
  - errors that disappear after a successful resubmit.

  Groups of checkboxes or radios get a group name (a `fieldset` with a
  `legend`, or `role="group"` with `aria-labelledby`). `PermissionsForm` is
  the one `*Form.tsx` without `useFocusOnError`, so review it specifically.
- **Dialogs, drawers, menus and popovers.** These are the mobile nav `Sheet`,
  the user `DropdownMenu`, `Select` popups and the date-picker `Popover`. For
  each one, check that:
  - focus moves inside on open;
  - Tab stays inside while it is modal;
  - Escape closes it;
  - focus returns to the trigger.

  Fix any failure. Translate the `Sheet` close button label, which is
  hard-coded English `Close` in `components/ui/sheet.tsx`.
- **Icon-only controls and non-text content.**
  - Every icon-only button or link needs a translated accessible name. This
    covers the header menu button, the sheet close button, the calendar
    month buttons and the password reveal button.
  - Decorative icons are `aria-hidden`.
  - Charts (`RevenueChart` and the report charts) have a text alternative or
    an accessible summary or table.
  - Status is never shown by colour alone.
- **EN/AR.** Every new string goes in both `locales/en.json` and
  `locales/ar.json`, and every fix works in RTL.

## Out of scope

- New features, changes to layout design, and redesigning the theme palette
  beyond the token changes needed to meet contrast.
- Browser or axe test tooling. There is no `Browser tests` command. That work
  belongs to 29e, after `/tests browser`.
- Performance (29d) and production verification (29f).
- WCAG AAA targets, and a full audit of third-party library internals beyond
  what the CRM's own usage exposes.

## Build loop

`workflow.stepReview: "feature"`: implement all steps, then present one review
packet. `checkpointCommits` is disabled, so there are no per-step commits.
`/complete` creates the single feature commit on `feature/accessibility-pass`.

## Build steps

- [x] 1. **Skip link and landmarks.**
  - Add the skip-link string to an existing shared namespace in both locale
    files, such as `header`, or a new `a11y` namespace if no existing one
    covers both layouts.
  - Render the link first inside `<body>` content for `app/(app)/layout.tsx`
    and `app/(auth)/layout.tsx`, as `sr-only` until focused, using
    `focus:not-sr-only` and logical positioning.
  - Give each `<main>` `id="main-content"` and `tabIndex={-1}`, with no
    visible outline on programmatic focus.
  - Review landmark names: header, sidebar `aside`, `nav`, and the drawer's
    second `nav`.
  - **Done when:** on any app page and on `/login`, the first Tab shows the
    link in EN and AR, and Enter moves focus to the main content. Typecheck and
    lint pass.
- [x] 2. **Focus ring and contrast tokens.**
  - In `app/globals.css`, make `--ring` and `--sidebar-ring` colours that
    reach at least 3:1 against `--background`, `--card` / `--popover` and
    `--sidebar` respectively in both themes.
  - Remove the `/50` dilution, or any equivalent, from focus-ring utilities in
    `components/ui/*`. Today it is in `button`, `calendar`, `checkbox`,
    `date-picker`, `input`, `radio-group`, `select` and `textarea`.
    `aria-invalid` and destructive rings may stay as they are, because they
    are not the focus indicator.
  - Fix small-text contrast: replace `text-primary` small text in Dark with a
    token that reaches 4.5:1 on cards. Reuse an existing token such as
    `--st-approved` where it fits, or adjust the dark value used for text.
    Confirm `--faint` is unused as text, or fix it.
  - Add `app/theme-contrast.test.ts`. It reads `app/globals.css`, resolves the
    hex and rgba tokens for `:root` and `.dark` (compositing alpha over the
    stated background), and asserts the pairs listed in Data / contracts.
  - **Done when:** the contrast test passes, `pnpm test` is green, and focus
    rings are visibly solid in both themes.
- [x] 3. **Dialogs, drawers, menus and popovers.**
  - Translate the `Sheet` close label using `useTranslations` in
    `components/ui/sheet.tsx` (a client component), or by passing a label
    prop.
  - Check open focus, the Tab trap, Escape and focus return for the mobile nav
    drawer, the user menu, `FormSelect` and `DatePicker`, in LTR and RTL.
  - Check that the calendar month buttons have translated names, under the
    `datePicker` namespace.
  - Fix any failures with Base UI's built-in props, such as `initialFocus` and
    `finalFocus`, and no custom focus traps.
  - **Done when:** each surface passes the keyboard checks by hand in EN and
    AR. Typecheck and lint pass.
- [x] 4. **Forms.**
  - Review every form in `components/**/` (`*Form.tsx`, `*Fields.tsx`,
    `ReportPeriodControls`, `SettlementReportControls`, `PeriodSelector`)
    against the form rules under In scope.
  - Fix gaps by reusing `FormField`, `FormMessage` and `useFocusOnError`. Add
    group names to checkbox and radio sets, starting with `PermissionsForm`.
  - **Done when:** submitting each form with invalid input moves focus to the
    first invalid field and a screen reader reads the label and the error, and
    a successful resubmit clears the errors. Typecheck, lint and tests pass.
- [x] 5. **Icon-only controls, charts and status.**
  - Find buttons and links whose only child is an icon. Give each a
    translated `aria-label`, or `sr-only` text, in EN and AR.
  - Make sure decorative icons are `aria-hidden`.
  - Give `RevenueChart` and the report charts an accessible name and a text
    summary, or point to the adjacent data table if one already exists.
  - Confirm that status badges show text, not colour alone.
  - **Done when:** an accessibility-tree review (browser devtools) shows no
    unnamed interactive element on the dashboard, transactions, employees,
    reports and settings pages. `pnpm build` succeeds.

## Files / areas

- `app/(app)/layout.tsx`, `app/(auth)/layout.tsx`
- `app/globals.css`, plus the new `app/theme-contrast.test.ts`
- `components/ui/{button,calendar,checkbox,date-picker,input,radio-group,select,textarea,sheet}.tsx`
- `components/layout/{Header,Sidebar,SidebarNav}.tsx`
- `components/**/*Form.tsx`, `components/**/*Fields.tsx`,
  `components/reports/*Controls.tsx`, `components/dashboard/{PeriodSelector,RevenueChart,StatCard}.tsx`
- Components using `text-primary` as text: `components/dashboard`, `components/reports`,
  `components/employees`, `components/employee-expenses`, `components/settlements`,
  `components/layout/Panel.tsx`, `components/ui/empty-state.tsx`, `app/(app)/account/page.tsx`
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- No changes to the schema, server actions, permissions or routes.
- The skip-link target is `#main-content`. There is one per layout.
- Contrast pairs asserted by the test, in both `:root` and `.dark`:
  - `--foreground`, `--muted-foreground` and `--destructive` on `--background`
    and `--card`: 4.5:1 or more.
  - `--primary-foreground` on `--primary`: 4.5:1 or more.
  - The token chosen for small primary-coloured text on `--card`: 4.5:1 or
    more.
  - `--ring` on `--background` and `--card`: 3:1 or more.
  - `--sidebar-ring` and `--sidebar-foreground` on `--sidebar`: 3:1 and 4.5:1
    respectively.
- The test uses WCAG 2.x relative luminance. It composites alpha tokens over
  the background they sit on.

## Testing

- `pnpm test`: the new contrast test plus the existing suite.
- `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build`.
- Manual keyboard and screen-reader checks for steps 1, 3, 4 and 5, in EN/AR
  and Light/Dark. These go in the review packet as a checklist, and are not
  claimed as run unless they were run. No browser harness exists.

## Notes for the AI

- Already in place, so keep it:
  - `FormField` links errors and hints through `aria-describedby`.
  - `FormMessage` uses `role="alert"` / `role="status"`.
  - `useFocusOnError` handles focus after a failed submit.
  - The sidebar `nav` has `aria-label` and `aria-current`.
  - The header menu button has `aria-label`.
  - The toaster has a container label.
  - Icons are mostly `aria-hidden`.
- Measured contrast that already passes:
  - Light `--muted-foreground` on background: 5.66:1.
  - Dark `--muted-foreground` on card: 6.85:1.
  - Light / Dark `--primary-foreground` on primary: 5.17:1 / 4.50:1.
  - Sidebar group labels at `/50`: 4.59:1.
  - Sidebar link text at `/70`: 7.7:1.
- Keep token changes minimal and visually close to the Kosh palette. Do not
  restyle components.
- Use logical properties (`start`/`end`, `ms`/`me`) for the skip link
  position.
- Rely on Base UI's dialog and menu focus management. Do not add a
  focus-trap dependency.
- Read the relevant guide in `node_modules/next/dist/docs/` before touching
  layouts (Next 16).

## Implementation notes

- **Skip link:** `components/layout/SkipLink.tsx` (server component,
  `header.skipToContent`) targets `#main-content` in both layouts.
- **Contrast fixes beyond the planned `components/ui` scope**, all needed to meet
  the spec's thresholds:
  - Dark `--primary` goes from `#2f6bff` to `#2e6afe`: white text measured
    4.499:1.
  - `--primary-hover` is now darker in Dark (`#2459e0`), and button hovers use
    `hover:bg-primary-hover` instead of `hover:bg-primary/80`. Light hover text
    measured 3.6:1.
  - `ring-ring/50` is removed from page-level controls as well as
    `components/ui`.
- **New token:** `--primary-text` (Light `#2563eb`, Dark `#6b97ff`) for links and
  small blue text (`text-primary-text`). Primary-coloured icons on soft tiles and
  the large 404 numeral keep `text-primary`, because they are non-text or large
  text at 3:1 or more.
- **`--faint`** is unused as text.
- **No change needed:**
  - Calendar month labels come translated from the react-day-picker `ar` locale.
  - Charts: only `RevenueChart` uses Recharts, and it already has an `sr-only`
    table.
  - Status badges render text.
  - Invoice create already focuses the first radio when there is a status error.
- **Form fix:** `PermissionsForm` now focuses its error message after a failed
  save.
- **Sheet close label:** translated (`header.close`).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12241,"specSha256":"50ec79d1b938e3c4b11aaed3af614835af8bd2c487ebf4fad79cb1d78bf79211","branch":"refs/heads/feature/accessibility-pass","head":"cecb95b243c3c091b792fbe31dce94240805ff99","baseRef":"refs/heads/main","baseCommit":"cecb95b243c3c091b792fbe31dce94240805ff99","sourceTree":"3379401011bfc1d0da95ac70e0522c4143bf461b","absentOptional":[]} -->
