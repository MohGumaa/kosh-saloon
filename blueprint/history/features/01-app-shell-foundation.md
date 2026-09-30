# Feature: App shell & foundation

**From build-plan:** feature 1
**Build attempt:** 1
**Branch:** feature/app-shell-foundation
**Status:** verified

## Goal

Lay the foundation every later feature builds on: a Prisma connection to
PostgreSQL, shadcn/ui themed with the Kosh tokens, an English/Arabic translation
layer with RTL switching, a Light/Dark/System theme switch, and the app layout
with a sidebar and header. When this ships, a later feature can add a page
inside the shell and have it translated, RTL-ready, and themed.

## Design reference

- `prototypes/dashboard.html`: sidebar layout (brand block, grouped nav, footer)
  and the header's EN | AR and theme segmented controls.
- `prototypes/theme.css`: the tokens to port. Dark is the default, the Kosh blue
  accent is used for the primary action, focus, and the active nav item, and
  Arabic swaps to IBM Plex Sans Arabic.
- `prototypes/` is **untracked** right now. It is the design source, so commit it
  before or with this feature (see the review handoff).

The prototype only has Light and Dark buttons. This feature adds **System** as a
third option, as the plan requires.

## In scope

- Prisma with PostgreSQL: install it, add a schema that has only the datasource
  and generator (no models yet), a shared Prisma client in `lib/db.ts`, and
  `.env.example` documenting `DATABASE_URL`.
- shadcn/ui set up for Tailwind v4 with no `src/`, and only the components the
  shell uses (Button, Sheet).
- The Kosh tokens ported into `app/globals.css` and mapped onto shadcn's
  semantic variables (`--background`, `--card`, `--primary`, `--border`,
  `--ring`, and so on) for both themes. The status and settlement tokens are
  ported too, so later features can use them.
- Fonts: Inter (Latin) and IBM Plex Sans Arabic loaded with `next/font/google`,
  replacing Geist. Arabic uses the Arabic stack.
- i18n: `locales/en.json` and `locales/ar.json`, with no locale in the URL. The
  locale comes from a cookie and defaults to English. `<html lang dir>` is set on
  the server. The EN | AR switcher sets the cookie through a Server Action and
  refreshes the page.
- Theme: Light, Dark, and System, defaulting to **Dark** (the product is
  dark-first). The choice is kept per browser. Saving it per user is feature 24.
  There is no flash of the wrong theme on load.
- Layout: an `(app)` route group with a sidebar (≥ `lg`) plus a header, and on
  mobile a header whose menu button opens the nav in a Sheet drawer. The drawer
  slides from the inline-start side, so it comes from the right in RTL.
- Sidebar nav from one config, in the prototype's order and groups: Dashboard;
  Transactions (Invoices, Salon Expenses); Manage (Employees, Services); Reports
  (Revenue, Expenses, Employee Performance, Employee Earnings, Settlements);
  System (Settings). Only Dashboard has a route today. Every other item renders
  as a **disabled, non-link** item, so no link leads to a 404. The feature that
  builds each route enables its item.
- `/` redirects to `/dashboard`. `/dashboard` is a translated placeholder page
  with a heading and a card saying the dashboard arrives in a later feature.
- A translated error boundary for the `(app)` group, with a retry button.
- A translated `<title>` ("Kosh CRM").

## Out of scope

- Any Prisma models or migrations (each feature adds its own, starting with
  feature 2's User).
- Login, sessions, route protection, the user/avatar block in the header, and
  hiding nav items by permission (features 2 and 3). The shell is public until
  feature 2, and it shows no data.
- The header search box (no search feature is planned yet).
- Saving language or theme per user (features 2 and 24). Translation
  completeness beyond the shell (feature 22). A full RTL audit (feature 23). The
  full Kosh visual polish (feature 24).
- Env validation modules, a health route, a test runner, and a Verify command.

## Build loop

`workflow.stepReview` is `feature`: build all the steps and run each step's
checks as you go, then present **one** review packet at the end. Checkpoint
commits are disabled. `/complete` creates the feature commit on
`feature/app-shell-foundation`.

## Build steps

> **Progress (implement, 2026-10-01):** code for all six steps is written, and
> `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec prisma validate`, and
> `pnpm build` pass. Step 1 stays unchecked because `prisma migrate status`
> reports "Connection url is empty": there is no `.env` on disk yet.
>
> **Runtime evidence (Playwright against `pnpm dev`, 2026-10-01):**
> - `/` redirects to `/dashboard`.
> - First visit renders EN/`ltr` and dark, with the sidebar at x 0–256.
> - AR renders `lang="ar" dir="rtl"`, Arabic strings, and the IBM Plex Sans
>   Arabic font, with the sidebar at x 1664–1920 and `NEXT_LOCALE=ar` set.
> - A tampered `NEXT_LOCALE=fr` cookie renders `lang="en" dir="ltr"`.
> - Light survives a reload (`theme=light`). System resolves from
>   `prefers-color-scheme` on load. Live OS-change following could not be proven
>   because Playwright's media emulation fired no change events.
> - The next-themes script runs before `<main>`.
> - The primary colour is `#2f6bff` in dark and `#2563eb` in light.
> - The mobile drawer in AR is `side=right`, flush with the right edge, and a
>   dialog. Focus moves inside it, Esc closes it and returns focus to the
>   trigger, and following a link closes it.
> - Disabled nav items are non-focusable spans.
> - No hydration or console warnings, apart from a dev-only CSS preload notice.
>
> **Deviations from the plan above:**
> - No `ThemeProvider.tsx` wrapper. `next-themes` and Base UI's
>   `DirectionProvider` already ship `"use client"`, so the root layout uses them
>   directly.
> - Added `components/layout/SegmentedButton.tsx`, which both switchers share.
> - Added `i18n/locales.ts` for the locale list, the guard, and the direction.
> - `prisma` is pinned to `7.10.0` to match `@prisma/client`. The unpinned
>   install resolved to `8.0.0-rc.19`.
> - Added `generated/**` to the ESLint ignores.
> - **Changes the user requested after review:**
>   - The env var is `kosh_DATABASE_URL`, not `DATABASE_URL`. That is the prefix
>     the Vercel Prisma Postgres integration injects (the host is Prisma Postgres
>     at `db.prisma.io`).
>   - The Arabic font is **Tajawal** (weights 400, 500, 700) instead of IBM Plex
>     Sans Arabic. Tajawal has no 600 weight, so `font-semibold` renders at the
>     nearest weight in Arabic.

- [x] **1. Branch, Prisma, and env.** Create `feature/app-shell-foundation`.
  Install the current stable `prisma`, `@prisma/client`, and whatever the
  installed major version requires. Check the installed version first: Prisma 7
  needs a driver adapter (`@prisma/adapter-pg`), a `prisma.config.ts`, and a
  generated-client output path. Follow what that version documents. Add
  `prisma/schema.prisma` (datasource `postgresql` plus generator, no models) and
  a `lib/db.ts` singleton that is reused across dev hot reloads. Add
  `.env.example` with a placeholder `DATABASE_URL`, and add `!.env.example` to
  `.gitignore`, because `.env*` currently ignores it. Keep real `.env` files
  ignored, and git-ignore the generated client output if it lives in the repo.
  Add a `postinstall` or build-time `prisma generate` so a clean install and
  build work.
  **Done when:** `pnpm exec prisma validate` passes.
  `pnpm exec prisma migrate status` connects to the developer's `DATABASE_URL`
  and reports no migrations. `git status` shows `.env.example` but no `.env`.
  `pnpm exec tsc --noEmit` passes.

- [x] **2. shadcn/ui and Kosh tokens.** Run shadcn init for this layout (no
  `src/`, alias `@/*`, Tailwind v4 CSS-first). Add `button` and `sheet`. Rewrite
  `app/globals.css`:
  - light values go on `:root` and dark values on `.dark`, taken from
    `prototypes/theme.css`;
  - the values are mapped onto shadcn's variable names and exposed through
    `@theme inline`;
  - the radius comes from the prototype (12px cards, 8px controls).

  Remove the create-next-app body font and colors. Swap Geist for Inter plus IBM
  Plex Sans Arabic through `next/font/google` CSS variables. Arabic uses the
  Arabic stack through `:lang(ar)` or `[lang="ar"]`.
  **Done when:** `pnpm build` passes and a Button renders with the Kosh blue
  primary in both the `.dark` and light themes.

- [x] **3. Translation and RTL foundation.** Install `next-intl` and use its
  mode without i18n routing:
  - `i18n/request.ts` reads the `NEXT_LOCALE` cookie, accepts only `en` or `ar`,
    falls back to `en`, and loads `locales/<locale>.json`;
  - `next.config.ts` is wrapped with the next-intl plugin;
  - the root layout sets `lang`, and sets `dir="rtl"` for `ar` and `dir="ltr"`
    for `en`;
  - `NextIntlClientProvider` wraps the children.

  Add `actions/locale.ts`, a Server Action that takes the locale. It rejects
  any value except `en` or `ar` on the server and sets the cookie (`path=/`,
  one-year max-age, `sameSite=lax`). Add `components/layout/LanguageSwitcher.tsx`,
  a client component: a segmented EN | AR control with `aria-pressed` that is
  disabled while pending (`useTransition`) and calls `router.refresh()` after the
  cookie is set. Make the metadata title translated.
  **Done when:** switching to AR re-renders with `<html lang="ar" dir="rtl">` and
  Arabic strings, and switching back restores `en`/`ltr`. A tampered cookie value
  (for example `fr`) renders English. Lint and typecheck pass.

- [x] **4. Theme foundation.** Install `next-themes`. Add a
  `components/layout/ThemeProvider.tsx` client wrapper with `attribute="class"`,
  `defaultTheme="dark"`, `enableSystem`, and `disableTransitionOnChange`. Put
  `suppressHydrationWarning` on `<html>`. Add
  `components/layout/ThemeSwitcher.tsx`, a segmented Light | Dark | System control
  with lucide icons, a translated `aria-label` for each button, and `aria-pressed`
  on the current choice. It renders a neutral, same-size placeholder until it
  mounts, so there is no hydration mismatch.
  **Done when:** each option applies right away and survives a reload. System
  follows the OS setting. A first visit renders dark with no flash. There are no
  hydration warnings in the console.

- [x] **5. App shell layout.** Add the following:
  - `lib/navigation.ts`: the typed nav config (key, group, translation key,
    lucide icon, `href` or none);
  - `app/(app)/layout.tsx`: the grid shell, with the sidebar at
    `--sidebar-width` from `lg` up and the header at `--header-height`;
  - `components/layout/Sidebar.tsx`: brand block, grouped nav, and the "Kosh
    Salon · v1.0" footer;
  - `components/layout/SidebarNav.tsx`: a client component that uses
    `usePathname` for the active state and `aria-current="page"`, and renders
    disabled items as non-links with `aria-disabled="true"` and muted styling;
  - `components/layout/Header.tsx`: a mobile menu button with a translated
    label, which opens a Sheet containing `SidebarNav` and closes on navigation,
    plus the language and theme switchers at the inline end;
  - `app/(app)/dashboard/page.tsx`: the placeholder page;
  - `app/(app)/error.tsx`: a translated message plus a retry button that calls
    `reset`;
  - `app/page.tsx`: replaced with a redirect to `/dashboard`.

  Use only logical utilities (`ms-`, `ps-`, `start-`, `border-s`, `text-start`).
  Mirror directional icons in RTL. All strings go in both locale files.
  **Done when:** `/` lands on `/dashboard`. At desktop width the sidebar sits on
  the left in EN and on the right in AR. At mobile width the menu opens the
  drawer from the correct side and it is keyboard-operable (focus trap, Esc
  closes). Disabled items are not focusable links. Lint, typecheck, and build
  pass.

- [x] **6. Clean-up and docs.** Remove unused create-next-app assets from
  `public/` if nothing references them. Update the `AGENTS.md` Commands section
  with the Prisma commands. In `blueprint/context/coding-standards.md`, fill in
  the i18n TODO (next-intl, cookie locale, no URL prefix, `locales/*.json`) and
  confirm the folder layout TODO.
  **Done when:** `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` all
  pass on a clean tree, and the docs match what was built.

## Files / areas

- New: `prisma/schema.prisma`, `prisma.config.ts` (if the installed Prisma needs
  it), `lib/db.ts`, `.env.example`, `components.json`, `lib/utils.ts`,
  `components/ui/{button,sheet}.tsx`, `i18n/request.ts`,
  `locales/{en,ar}.json`, `actions/locale.ts`, `lib/navigation.ts`,
  `components/layout/{ThemeProvider,ThemeSwitcher,LanguageSwitcher,Sidebar,SidebarNav,Header}.tsx`,
  `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/error.tsx`
- Changed: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`,
  `package.json`, `pnpm-lock.yaml`, `.gitignore`, `AGENTS.md`,
  `blueprint/context/coding-standards.md`

## Data / contracts

- **Locale cookie:** `NEXT_LOCALE`, with the value `en` or `ar`. Any other value
  is treated as `en`. It is not httpOnly-sensitive and holds no user data.
  Feature 2 or 24 will add the per-user `language` value.
- **Locale URL shape:** none. Routes stay unprefixed (`/dashboard`), as the
  overview's route list expects.
- **Theme storage:** next-themes `localStorage` key `theme`, with the value
  `light`, `dark`, or `system`. Feature 24 moves it to per-user `theme`
  (LIGHT | DARK | SYSTEM).
- **Translation keys:** namespaced JSON, for example `nav.dashboard`,
  `nav.groups.transactions`, `header.language`, `theme.light`,
  `dashboard.placeholder`, and `errors.generic`. `en` and `ar` must have the
  same key set.
- **Env:** only `DATABASE_URL` for now. The other names in the overview are added
  by the features that use them.
- **Server Action `setLocale(locale: unknown)`:** returns
  `{ success: true } | { success: false, error: "invalid_locale" }` and sets no
  cookie on failure.

## Testing

- No test runner is configured, so there are no unit tests. The gates are
  `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.
- A DB connectivity check through `prisma migrate status` needs a reachable
  `DATABASE_URL`.
- There is no browser harness. `/check` checks the language, direction, theme,
  mobile drawer, and disabled nav behavior manually in the running app. Do not
  claim visual or RTL evidence that was not observed.

## Notes for the AI

- Next.js 16 and React 19. Check the next-intl, next-themes, and shadcn setup
  against their current docs for Next 16 before writing config. Do not rely on
  older App Router examples.
- Check whether the current shadcn has built-in RTL support (for example an
  `rtl` option or logical-class output). If it does not, make sure the Sheet
  `side` follows the direction (`dir === "rtl" ? "right" : "left"`) and replace
  any physical `left`/`right` utilities in the generated components you keep.
- Do not use `@import` for Google Fonts, as the prototype does. Use
  `next/font/google`.
- The shell must not import `lib/db.ts` yet. Nothing queries the DB in this
  feature.
- Keep the Server Action the only way to set the cookie on the server, and do not
  trust its input.

## Open questions

- **PostgreSQL for development:** resolved. Development uses Vercel Prisma
  Postgres through `kosh_DATABASE_URL` in the git-ignored `.env`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":15355,"specSha256":"aa107c1f0579608afdd31cb1ee57b3fd14cbde2dc9a5e78419a3c7c0c5007d4c","branch":"refs/heads/feature/app-shell-foundation","head":"1a75836513f61f25afd79ebaa06c8c310da5225a","baseRef":"refs/heads/main","baseCommit":"1a75836513f61f25afd79ebaa06c8c310da5225a","sourceTree":"cd6b6b80ba1c53eff424ccb3632ff900c68fd237","absentOptional":[]} -->
