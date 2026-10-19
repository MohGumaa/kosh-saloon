# Feature: Error & loading states

**From build-plan:** feature 29a
**Build attempt:** 1
**Branch:** feature/error-loading-states
**Status:** verified

## Goal

Every failure and every slow page has a deliberate, translated, themed screen.
A crash anywhere (root layout, signed-in app, sign-in pages) shows a safe
message with a retry and never exposes internal details. Every signed-in page
that loads data shows a skeleton while it loads. Every server action turns an
unexpected failure into the generic `unexpected` message and logs the details
on the server only.

## In scope

- `app/global-error.tsx` for errors in the root layout (it replaces the whole
  document).
- `app/(auth)/error.tsx` for the sign-in, forgot-password and reset-password
  pages.
- Update `app/(app)/error.tsx` to the Next 16 `retry()` API and the shared
  error component.
- A reference code on error screens: show `error.digest` when present, so a
  report can be matched to the server logs. Never show `error.message`.
- A shared loading skeleton and `loading.tsx` for every signed-in segment that
  loads data and doesn't have one yet: `account`, `audit-log`, `employees`,
  `expenses`, `services`, `settings`, `settlements`, `transactions`.
- A review of every exported server action in `actions/*.ts`: an unexpected
  failure must return the generic `unexpected` error and log on the server.
  Fix only the gaps the review finds.
- EN and AR text for every new string.

## Out of scope

- Empty states (29b), accessibility pass (29c), performance (29d), browser
  tests (29e), production checklist (29f).
- Changing the existing dashboard and report `loading.tsx` files.
- Error monitoring services or new logging infrastructure (feature 27 owns
  monitoring; server logs stay `console.error`).
- Returning real 404 status codes for detail pages (see Notes).

## Build loop

`workflow.stepReview` is `feature`: build all steps in order, run each step's
checks, then present one review packet at the end. `workflow.checkpointCommits`
is `disabled`: no commits per step. `/complete` creates the feature commit.

## Build steps

- [x] **1. Shared error screen + signed-in boundary.** Add
  `components/layout/ErrorState.tsx` (client): `role="alert"`, title, generic
  body, a "Try again" button that calls `retry`, an optional secondary link,
  and a muted "Reference: {digest}" line only when a digest exists. Rewrite
  `app/(app)/error.tsx` to use it with `retry` (not `reset`), log the error
  with `console.error` in an effect, and link back to the dashboard. Add keys
  `errors.reference` and `errors.backToDashboard` to both locale files.
  **Done when:** `pnpm exec tsc --noEmit` and `pnpm lint` pass. A thrown error
  in a signed-in page (try it temporarily, then remove it) shows the translated
  screen with a reference code in EN and AR, and "Try again" fetches the page
  again.

- [x] **2. Sign-in pages boundary.** Add `app/(auth)/error.tsx` using
  `ErrorState`, with a secondary link to `/login` (reuse `auth.backToLogin`).
  **Done when:** tsc and lint pass, and a temporary thrown error in
  `/forgot-password` shows the translated screen inside the auth layout.

- [x] **3. Global error.** Add a pure `localeFromCookie(cookieHeader: string): Locale`
  to `i18n/locales.ts` (reads `NEXT_LOCALE`, falls back to `DEFAULT_LOCALE`),
  with tests in `i18n/locales.test.ts`. Add `app/global-error.tsx` (client):
  its own `<html lang dir>` and `<body>`, imports `./globals.css`, picks the
  locale from `document.cookie` via `localeFromCookie`, gets the `errors` messages
  from the matching locale file through `NextIntlClientProvider`, and renders
  `ErrorState` with `retry`. Theme: apply the `dark` class when the stored
  next-themes value (`localStorage` key `theme`) is `dark`, or when it is
  `system`/missing and the OS prefers dark. Wrap the storage read in try/catch.
  Set the tab title with a React `<title>` (no `metadata` export here).
  **Done when:** `pnpm test` passes including the new locale tests, tsc and
  lint pass, and `pnpm build` succeeds. Check the build output and record the
  size of the global-error client chunk in the review packet. If it pulls in
  whole locale files, report that instead of adding new message files.

- [x] **4. Loading screens.** Add `components/layout/PageLoading.tsx` (server):
  `role="status"` with a screen-reader-only label, plus `aria-hidden` pulse
  blocks for a page header, a toolbar and a table/card area, using the same
  `rounded-2xl border bg-card shadow-card` panel styling as the existing
  dashboard skeleton. Add `loading.tsx` in the 8 segments listed in In scope,
  each passing its page's translated label. Add a `loading` key to each of
  those pages' locale namespaces in EN and AR.
  **Done when:** tsc, lint and build pass, and moving between those pages in
  `pnpm dev` shows the skeleton right away with no layout jump in LTR/RTL and
  light/dark.

- [x] **5. Server action review.** Check every exported action in
  `actions/*.ts` (not tests). For each one: an unexpected exception is caught,
  logged with `console.error("[<area>] <op> failed:", error)` and returned as
  `{ success: false, error: "unexpected" }` (or that file's existing form-state
  equivalent). No `error.message` reaches the client. Known expected results
  (validation, forbidden, not found, unique violations) keep their current
  codes. `redirect()`/`notFound()` errors must not be swallowed by a new catch
  (rethrow them, following the existing pattern in `actions/auth.ts`). List
  the result of the review per file in the review packet, and fix only real
  gaps, each with a unit test next to the existing action test.
  **Done when:** `pnpm test`, tsc, lint and build all pass, and the review
  packet lists every action file with "covered" or the fix made.

## Files / areas

- New: `components/layout/ErrorState.tsx`, `components/layout/PageLoading.tsx`,
  `app/global-error.tsx`, `app/(auth)/error.tsx`, `i18n/locales.test.ts`,
  `app/(app)/{account,audit-log,employees,expenses,services,settings,settlements,transactions}/loading.tsx`
- Changed: `app/(app)/error.tsx`, `i18n/locales.ts`, `locales/en.json`,
  `locales/ar.json`, and `actions/*.ts` (+ tests) only where step 5 finds a gap.

## Data / contracts

- No schema, migration, route or API change.
- Error screen contract: shows the translated title, body and retry. It may
  show `error.digest` as an opaque reference. It never renders `error.message`
  or a stack trace.
- Action error contract stays as it is: `unexpected` is the only code for
  unplanned failures. Server logs carry the details.
- `localeFromCookie("")` → `"en"`; `"NEXT_LOCALE=ar"` → `"ar"`; an unknown
  value → `"en"`.

## Testing

- Vitest: `localeFromCookie` cases (missing, `ar`, `en`, invalid, the cookie
  among others), plus one test per action gap fixed in step 5.
- tsc, lint, `pnpm test`, `pnpm build` at the end. No Verify command or browser
  harness exists, so the error/loading screens are checked by hand in
  `pnpm dev` (EN/AR, light/dark), with temporary thrown errors removed before
  review.

## Notes for the AI

- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`
  and `loading.md` before writing the boundaries. In this Next version the
  error props are `{ error, retry }`, and `reset` is the uncommon option.
- `global-error` doesn't get the root layout, `NextIntlClientProvider`,
  `ThemeProvider` or global CSS. Everything it needs, it brings itself.
- A segment `loading.tsx` also wraps nested routes (for example
  `/transactions/[id]`). Once a page streams, `notFound()` and the forbidden
  `redirect()` still work, but `notFound()` returns HTTP 200 with a `noindex`
  meta tag instead of 404. That's acceptable for this signed-in internal app.
  Don't add proxy checks to work around it.
- Use logical utilities only (RTL), no inline styles, and no hardcoded UI strings.
  Every new key goes into both locale files.
- Don't touch empty-state markup; that's 29b.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8026,"specSha256":"2bd3da8cf0ea8cb244792b102802f68d07eb56030f29b00bbc2a1fdb8a480551","branch":"refs/heads/feature/error-loading-states","head":"69ca037e9a2a4d1cf0720abf780642ef622a575b","baseRef":"refs/heads/main","baseCommit":"69ca037e9a2a4d1cf0720abf780642ef622a575b","sourceTree":"efb4456379a1307bdfcf8ee4589f0337acd8fd23","absentOptional":[]} -->
