# Fix: UI refresh for login, dashboard, and profile

**Type:** Fix
**Branch:** fix/ui-refresh-login-dashboard-profile
**Status:** verified

## The problem

The sign-in pages, the app shell, the dashboard, and the change-password page
are functional but plain. The user added design references in
`blueprint/reference/` (`Login.png`, `Login - dashboard.png`, `signup.png`,
`Dashboard.png`, `dash.png`, `Employees.png`) and asked for these pages to look
much closer to them, and for the change-password page to become a profile page
with Info and Settings tabs.

## The fix

Adopt the references' structure while keeping the Kosh blue tokens, both
languages (RTL), and the Light/Dark/System themes. Decisions made by the user
on 2026-10-01:

- Keep the current colours and themes; take layout and structure from the
  references (split-screen sign-in, dark navy sidebar, roomier cards).
- Dashboard uses the reference layout with honest empty states. No invented
  numbers; feature 14 fills the widgets with real data.
- The profile Info tab lets a user edit their own name and phone. Username,
  email, and role stay read-only (feature 6 owns admin editing).

It must not change authentication behaviour, rate limiting, session handling,
or any Server Action in `actions/auth.ts`.

### Sign-in pages (`/login`, `/forgot-password`, `/reset-password`)

- `app/(auth)/layout.tsx` becomes a split screen at `lg` and up: the form on
  one side, a brand panel on the other (brand mark, a decorative dashboard
  illustration built with CSS, a headline and one line of copy). Below `lg`
  only the form side shows, with the brand above the form.
- The form sits directly on the page (no card), with a larger heading.
- Inputs are taller, with a leading icon. Password fields get a show/hide
  button with an accessible name and `aria-pressed`.
- The illustration is decorative (`aria-hidden`); all copy is translated.

### App shell

- The sidebar is dark navy in the light theme too (sidebar tokens only), with
  larger rounded items, a clearer active state, and a sign-out button at the
  bottom. Disabled "coming soon" items stay non-links.
- The header user menu shows avatar initials, name, and role, and links to
  Profile instead of Change password.

### Dashboard (`/dashboard`)

- Welcome banner: user's name, role, today's date, last sign-in.
- Four stat cards (revenue this month, invoices, pending amount, salon
  expenses), a monthly revenue chart area, a latest-invoices table, and a
  top-services panel. Each shows a clear "no data yet" state; values are a
  dash, never a made-up number.
- An account card from real data (username, role, last sign-in) linking to
  the profile.

### Profile (`/account`)

- Header card: avatar initials, name, role, email.
- Tabs are links (`/account` and `/account?tab=settings`), marked with
  `aria-current="page"`.
- **Info:** form for name (1-100 characters) and phone (optional, up to 30
  characters: digits, spaces, `+`, `-`, `(`, `)`); read-only username, email,
  role, last sign-in, and member-since.
- **Settings:** the existing `ChangePasswordForm`, plus language and theme
  switchers (still stored per browser; feature 24 persists them per user).
- `/account/password` redirects to `/account?tab=settings`.
- New Server Action `updateProfile` in `actions/account.ts`: calls
  `requireSession()`, validates with Zod, updates only the signed-in user's
  own `name` and `phone`, revalidates the layout so the header shows the new
  name, and returns the same result shape as the auth actions.

## Build steps

- [x] **1. Sign-in pages.** Split-screen auth layout, brand panel, plain page
  headings, input icons, password show/hide.
  **Done when:** `/login`, `/forgot-password`, and `/reset-password` render the
  new layout in EN and AR, light and dark, at mobile and desktop width; sign-in
  still works; the show/hide button toggles the field type.
- [x] **2. App shell.** Navy sidebar tokens, nav item styling, sidebar sign-out,
  user menu with role and Profile link.
  **Done when:** the sidebar is navy in both themes with readable items, the
  mobile drawer matches, and sign-out works from the sidebar and the menu.
- [x] **3. Dashboard.** Welcome banner, stat cards, chart area, latest
  invoices, top services, account card, all with empty states.
  **Done when:** `/dashboard` shows the layout with no invented numbers in EN
  and AR, and stacks to one column on mobile.
- [x] **4. Profile.** `/account` with Info and Settings tabs, `updateProfile`
  action and its test, redirect from `/account/password`.
  **Done when:** saving a new name updates the header; an empty name and an
  invalid phone show field errors; the password form works on the Settings
  tab; `/account/password` lands on the Settings tab.
- [x] **5. Verify.** Locale key sets match; `pnpm test`,
  `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `lib/auth/validation.test.ts`: profile schema (name trimmed and required,
  phone optional, empty phone becomes null, invalid characters rejected).
- `actions/account.test.ts`: `updateProfile` updates only the session user's
  row, returns field errors for bad input, and reports `unexpected` on a
  database failure.
- UI is verified in the browser with screenshots, not unit tests.

## Verify

1. Signed out, open `/login`: split screen on desktop, single column on
   mobile; switch EN/AR and light/dark.
2. Sign in, check the navy sidebar, the dashboard empty states, and the user
   menu.
3. Open Profile, change the name and phone, and confirm the header updates.
4. Open the Settings tab, change the password, and switch language and theme.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5662,"specSha256":"a49ffe2558b72d59c36c553813bc2d0fe01acbbb167f060bc6f0fbaf983ba3ec","branch":"refs/heads/fix/ui-refresh-login-dashboard-profile","head":"ee1596603aa5ed96cb3f22efd45ecac2a66d675e","baseRef":"refs/heads/main","baseCommit":"2a92e2b6ab70f714e88dd2faf4ec5317628164da","sourceTree":"b821542a3dc5d0df41a5cd93af7b4b60128fffa0","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** ee1596603aa5ed96cb3f22efd45ecac2a66d675e
**Base commit:** 2a92e2b6ab70f714e88dd2faf4ec5317628164da
**Base ref:** main
**Spec hash:** a49ffe2558b72d59c36c553813bc2d0fe01acbbb167f060bc6f0fbaf983ba3ec
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T02:59:28Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T03:05:17Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base, and spec hash match the request; only `blueprint/context/review.md` differed)
- `pnpm test`: pass (8 files, 62 tests)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm build`: pass (8 routes, all dynamic)
- `pnpm exec prisma validate`: pass
- `pnpm exec tsx <scratch probe outside the repo>` running the real `profileSchema` and the `initials` expression: pass as a probe (results recorded in F-10, F-11, F-12); scratch file removed
- Node script comparing `locales/en.json` and `locales/ar.json`: pass (143 keys each, no missing, empty, or placeholder-mismatched keys)

## Evidence

- Reviewed the full `2a92e2b..ee15966` delta: 37 files, 28 of them code, locale, CSS, or spec, plus 9 PNG reference images under `blueprint/reference/` (about 3.1 MB in total, 1.4 MB of it `signup.png`) treated as binary assets and not reviewed for content.
- Authorization: `updateProfile` calls `requireSession()` first, takes the row id only from the session, and writes `parsed.data`, which Zod limits to `name` and `phone`. The test posts `id`, `role`, and `email` and asserts the exact `where` and `data`. `validateSessionToken` rejects inactive users. `actions/auth.ts` is unchanged in the delta, as the spec requires.
- Data to client components: only `name`, `phone`, `role`, and ISO timestamps cross; no hash, token, or other user's data. Email templates escape the now user-editable name.
- Accessibility and RTL: fields keep label, `aria-invalid`, and `aria-describedby` for hint and error; the password toggle has a stable name with `aria-pressed`; tabs and nav use `aria-current="page"`; decorative art is `aria-hidden`. No `ml-`/`mr-`/`left-`/`right-` utilities were added; the one physical direction is the decorative `bg-linear-to-r` gradient on the profile header.
- Hydration: `LocalDateTime` uses `useSyncExternalStore` with a server snapshot, the same pattern as `ThemeSwitcher`; see F-16 for the remaining cross-engine risk.
- Tests: no skipped, focused, or placeholder tests; the new tests call the real action and schema and assert outputs, not mocks of themselves.
- Performance: one extra primary-key lookup on `/dashboard` and `/account`; `requireSession` is request-cached; no unbounded work added.

## Findings

- F-10 [P3] open - Profile name accepts control and invisible characters
- F-11 [P3] open - Phone validation rejects Arabic-Indic digits
- F-12 [P3] open - Avatar initials split characters outside the basic plane
- F-13 [P3] open - Account details list nests dt and dd one level too deep
- F-14 [P3] open - Revealed password is an ordinary text input with spellcheck on
- F-15 [P3] open - Welcome banner omits the last sign-in the spec lists
- F-16 [P3] unverified - Date text may differ between server and browser during hydration
- F-09 [P3] open (earlier entry, `actions/auth.ts` is outside this delta) left unchanged
- No P0 or P1 finding is open or fixed

## Remaining risk

- No browser or runtime evidence was gathered: Check was not required, no dev server was started, and no Browser tests command is declared. Visual fidelity to the reference images, contrast in both themes, RTL layout, focus order, the password toggle, the sidebar sign-out, and the header refresh after saving a name were reviewed from code only.
- No accessibility scanner, security scanner, dependency audit, or performance command is declared in `AGENTS.md`, so none ran.
- `updateProfile` was exercised through its unit tests with a mocked database, not against PostgreSQL; the NUL-character behaviour in F-10 rests on PostgreSQL's documented text rules.
- F-16 needs a multi-browser hydration check against a production build.
- The dashboard activity record (`blueprint/.state/run.json`) was not written by this reviewer because the review was limited to the two evidence files.
