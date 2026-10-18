# Feature: Theme polish

**From build-plan:** feature 24
**Build attempt:** 1
**Branch:** feature/theme-polish
**Status:** verified

## Goal

Apply the full Kosh visual style to Light, Dark, and System themes and persist
each signed-in user's theme preference to their account, so it follows them
across browsers and devices.

## Design reference

- `prototypes/theme.css` and `prototypes/dashboard.html` (badge colours at
  `.b-paid`, `.b-unpaid`, `.b-cancelled`).
- Overview UI/UX: dark-mode-first, Kosh blue primary, rounded cards, clear
  financial numbers, high contrast. Dark: navy background, dark cards, light
  text. Light: light background, white cards, dark text. Theme saved per user.

## In scope

- Persist the theme choice to `User.theme` (`LIGHT | DARK | SYSTEM`, already in
  `prisma/schema.prisma`, default `DARK`) whenever a signed-in user picks a theme
  from any `ThemeSwitcher` (header, account settings).
- Apply the stored preference: first paint on a new browser uses the account's
  theme, and a browser holding a stale local choice is corrected to the
  account's theme after sign-in.
- Signed-out pages (`app/(auth)`) keep the current browser-only behaviour.
- Bring invoice status badges onto Kosh status tokens to match the prototype.
- Ensure status text tokens (success, warning, destructive, settlement states)
  meet WCAG AA 4.5:1 for small text on their soft backgrounds and on cards in
  both themes; adjust only the light or dark values that measure below it,
  keeping each hue.
- Update the account preferences description, which currently says "Saved in
  this browser only.", in English and Arabic.

## Out of scope

- Persisting language per user (still cookie-based via `actions/locale.ts`).
  The overview calls for it, but it is not part of feature 24's line.
- New tokens, fonts, spacing scales, or layout changes; responsive and RTL work
  (features 23 and 25).
- The decorative sign-in illustration in `components/auth/BrandPanel.tsx`; it
  sits on the always-navy brand panel and is `aria-hidden`.
- Audit-log entries for theme changes (a cosmetic, self-only preference).
- Prisma schema or migration changes.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet. `workflow.checkpointCommits` is `disabled`: no per-step commits.
`/complete` creates the final feature commit.

## Build steps

- [x] **1. Theme mapping and save action.** Add a small pure mapping in
  `lib/theme.ts` between next-themes values (`light | dark | system`) and the
  Prisma `Theme` enum, with an `isThemeValue` guard. Add
  `actions/preferences.ts` with `saveThemePreference(theme: unknown)`: reject
  anything other than the three values with `invalid_theme`; with no current
  session (`getCurrentSession`), return success without writing; otherwise
  `db.user.update({ where: { id: session.user.id }, data: { theme } })` only for
  the signed-in user's own row. Catch DB errors, log with `console.error`, and
  return `unexpected`. Add `lib/theme.test.ts` and `actions/preferences.test.ts`
  (mocked db and session, following `actions/account.test.ts`).
  **Done when:** `pnpm test` passes the new tests for valid, invalid,
  signed-out, and DB-failure cases, and `pnpm exec tsc --noEmit` is clean.

- [x] **2. Expose the stored theme and apply it.** Add `theme` to the session
  user select and `SessionUser` in `lib/auth/session.ts` (update
  `lib/auth/session.test.ts` fixtures). In `app/layout.tsx`, read the cached
  `getCurrentSession()` and pass the user's theme (mapped to lowercase) as
  next-themes `defaultTheme`, falling back to `"dark"` when signed out. Add a
  client `components/layout/ThemePreferenceSync.tsx`, rendered from
  `app/(app)/layout.tsx` with the stored theme, that calls next-themes
  `setTheme(stored)` once after mount when the browser's theme differs.
  **Done when:** typecheck and tests pass; a fresh browser (empty
  localStorage) signed in as a LIGHT user paints light with no dark flash, and a
  browser with a stale local `dark` switches to the account's theme after
  sign-in.

- [x] **3. Save from the switcher.** In `components/layout/ThemeSwitcher.tsx`,
  apply the choice locally first (instant), then call `saveThemePreference` in a
  transition. On failure, show a sonner error toast with a new translated
  message (`theme.saveFailed` in `locales/en.json` and `locales/ar.json`); the
  local choice stays applied. Keep the existing `aria-label`s, pressed state,
  and mount guard. Update `account.preferences.description` in both locales to
  say the theme is saved to the account and the language to this browser.
  **Done when:** changing theme in the header persists across a reload in a
  different browser profile, signed-out pages still switch themes without
  errors, and a forced action failure shows the translated toast.

- [x] **4. Status colour polish.** Change `components/invoices/InvoiceStatusBadge.tsx`
  to the prototype mapping: PAID `bg-success-soft text-success`, UNPAID
  `bg-warning-soft text-warning`, CANCELLED `bg-destructive-soft
  text-destructive`, removing the raw `amber-*` classes. Measure the contrast of
  `--success`, `--warning`, `--destructive`, `--st-draft`, `--st-calculated`,
  and `--primary` text on their `-soft` fill over `--card`, in both themes;
  darken (light) or lighten (dark) in `app/globals.css` only those below 4.5:1,
  keeping the hue, and record the measured before/after ratios in the review
  packet. Grep `app/` and `components/` (outside `components/ui/`) for raw
  palette classes or hex colours and move any non-decorative ones onto tokens.
  **Done when:** invoice and settlement badges render in token colours in Light,
  Dark, and System; every listed pair meets 4.5:1 by the recorded measurement;
  `pnpm lint`, typecheck, tests, and `pnpm build` pass.

## Files / areas

- `lib/theme.ts`, `lib/theme.test.ts` (new)
- `actions/preferences.ts`, `actions/preferences.test.ts` (new)
- `lib/auth/session.ts`, `lib/auth/session.test.ts`
- `app/layout.tsx`, `app/(app)/layout.tsx`
- `components/layout/ThemeSwitcher.tsx`,
  `components/layout/ThemePreferenceSync.tsx` (new)
- `components/invoices/InvoiceStatusBadge.tsx`
- `app/globals.css` (status token values only, if needed)
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- Stored field: existing `User.theme` enum `LIGHT | DARK | SYSTEM`, default
  `DARK`. No migration.
- Client values: next-themes `"light" | "dark" | "system"`; mapping is
  one-to-one and lives only in `lib/theme.ts`.
- `saveThemePreference(theme: unknown)` returns
  `{ success: true } | { success: false; error: "invalid_theme" | "unexpected" }`.
- Trusted actor: the server session only; the action never accepts a user ID
  and writes only the session user's row. Signed-out calls are a successful
  no-op.
- Local storage remains next-themes' default key; the account value wins after
  sign-in.

## Testing

- Vitest unit tests for the mapping/guard and the server action (valid save,
  invalid input, signed-out no-op, DB error).
- Session fixture updated for the added `theme` field.
- No Verify command or Browser tests command exists. Visual and cross-browser
  persistence checks are manual (via `/check`) and must not be claimed until run.

## Implementation decisions

- Measured contrast (status text on its soft fill over `--card`). Light, before
  -> after: success 2.95 -> 4.85 (`#147a3a`), warning 3.04 -> 4.85 (`#9a5b07`),
  destructive 3.86 -> 4.75 (`#c53030`), st-draft 4.11 -> 4.88 (`#5a687e`);
  st-calculated 4.91 and primary 4.50 unchanged. Dark: all pass except primary
  (3.33 on soft, 3.85 on card).
- Dark primary, approved by the user during implement: only the settlement
  "Approved" badge gets its own dark value (`--st-approved: #6b97ff`, 5.34:1).
  `--primary` is unchanged because it sits behind white button text; dark
  `text-primary` links (3.85:1 on cards) remain a known risk.
- Decorative `bg-white/10` circles on the account banner left as is.

## Notes for the AI

- Read the next-themes `ThemeProvider` props in `node_modules/next-themes`
  before relying on `defaultTheme`; confirm it applies only when no local value
  is stored.
- `getCurrentSession` is wrapped in React `cache`, so the root layout and
  `app/(app)/layout.tsx` share one lookup per request.
- Keep the switcher usable while saving; do not disable it on pending.
- This Next.js version differs from training data; check
  `node_modules/next/dist/docs/` for Server Action and layout APIs before
  writing.
- `blueprint/build-plan.md` has uncommitted edits marking features 22, 23, and
  25 done with no matching commits or history archives; leave that file alone
  in this feature.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8716,"specSha256":"dd0445f6f4dde2c50aa775807c57fe36ce9cace3ee1d9b7acaf7b4948096a6e3","branch":"refs/heads/feature/theme-polish","head":"5ff343fdef716f307ae7bbfbd1a192efa35931ee","baseRef":"refs/heads/main","baseCommit":"5ff343fdef716f307ae7bbfbd1a192efa35931ee","sourceTree":"ff57d315f74e0113ba40a69f7164adb5bd703494","absentOptional":[]} -->
