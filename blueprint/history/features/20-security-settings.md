# Feature: Security settings

**From build-plan:** feature 20
**Build attempt:** 1
**Branch:** feature/security-settings
**Status:** verified

## Goal

Add a Security tab to `/settings` where an authorized user can change their own
password (reusing the feature 2 form) and sign out every other device they are
signed in on.

## In scope

- A **Security** tab on `/settings` (`/settings?tab=security`), shown only to
  users holding `settings.security` (ADMIN always; others only when granted).
- A **Change password** panel on that tab that reuses `ChangePasswordForm` and the
  existing `changePassword` action unchanged.
- A **Sign out other devices** panel: shows how many other active sessions the
  current user has, and a button that ends all of them while keeping the
  current one. The action is audited.
- English and Arabic text for everything new, RTL-safe layout, all themes.

## Out of scope

- The login notification email toggle. Per the 2026-10-19 decision it becomes
  a salon-wide `SalonSettings` switch owned by **feature 21** (Notifications tab).
  Login emails keep being sent on every sign-in until then.
- A per-session list with device/IP details and per-session revoke (would need
  new `Session` columns).
- Adding sign-out-other-devices to `/account` (password change stays there as is).
- Any change to `changePassword`, session duration, or rate limits.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet. `checkpointCommits` is `disabled`; `/complete` makes the only commit.

## Build steps

- [x] **1. Sign-out-other-sessions action.**
  Add `"auth.other_sessions_signed_out"` to `AUDIT_ACTIONS` in `lib/audit.ts`, with
  labels under `audit.actions.auth.other_sessions_signed_out` in `locales/en.json`
  ("Signed out other devices") and `locales/ar.json`. Add
  `signOutOtherSessions(_prev, _formData)` to `actions/auth.ts`:
  `requireSession()` supplies `sessionId` and `user.id` (never form data). Then one
  interactive `db.$transaction(async (tx) => …)` runs
  `tx.session.deleteMany({ where: { userId, id: { not: sessionId } } })` and
  `recordAudit({ userId, action: "auth.other_sessions_signed_out", entity: "User",
  entityId: userId, newValue: { sessionsEnded: count } }, tx)`. Return
  `{ success: true, count }`, or `{ success: false, error: "unexpected" }` after
  logging on failure. Call `revalidatePath("/settings")` on success.
  **Done when:** new cases in `actions/auth.test.ts` pass under `pnpm test`. They must
  show that only the caller's other sessions are deleted, the current session is
  kept, the audit entry is written in the same transaction with the count, a
  zero count still succeeds, and a DB error returns `unexpected`.

- [x] **2. Security tab and panels.**
  In `app/(app)/settings/page.tsx`, add a `security` tab (`ShieldCheck` icon) that
  appears only when `permissions.has("settings.security")`. Resolve the active
  tab with a small pure helper (`resolveSettingsTab(tab, permissions)` in
  `lib/settings.ts`). It returns `security` only with the permission. Any other or
  unpermitted value falls back as today: `financial` stays `financial`, and
  anything else goes to `information`. On the Security tab, hide the
  `settings.readOnly` banner, because these actions affect only the caller's own
  account and do not need `settings.edit`. Render two `Panel`s:
  - Change password: `<ChangePasswordForm />` with the existing
    `auth.changePassword.title` / `description` strings.
  - Sign out other devices: the server counts
    `db.session.count({ where: { userId, id: { not: sessionId }, expiresAt: { gt: now } } })`
    and passes it to a new client component
    `components/settings/SignOutOtherSessionsForm.tsx`. The component uses
    `useActionState(signOutOtherSessions)`. It shows the count text, or a
    "no other devices" message when the count is 0, and disables the button at 0.
    The button reads "Signing out…" and is disabled while pending. Success uses
    `useSuccessToast`, and a failure renders `FormMessage` with tone `error`,
    focused via `useFocusOnError`.

  Add `settings.tabs.security` and a `settings.security.*` block to both locale
  files. Update `settings.description` to mention security. Replace the stale
  "Security and Notifications join these" comment and the `ChangePasswordForm`
  doc comment.
  **Done when:** a `lib/settings.test.ts` case covers `resolveSettingsTab`
  (security with and without the permission, financial, unknown, and missing).
  `pnpm test`, `pnpm lint`, and `pnpm exec tsc --noEmit` pass. The tab shows for an
  ADMIN, and requesting `?tab=security` without `settings.security` shows
  Information.

- [x] **3. Final verification.**
  Run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build`.
  **Done when:** all four pass. Report the results as observed.

## Files / areas

- `actions/auth.ts`, `actions/auth.test.ts`: new action and tests
- `lib/audit.ts`: new audit action
- `lib/settings.ts`, `lib/settings.test.ts`: tab resolver
- `app/(app)/settings/page.tsx`: tab, panels, session count
- `components/settings/SignOutOtherSessionsForm.tsx`: new client form
- `components/auth/ChangePasswordForm.tsx`: doc comment only
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- No schema change or migration.
- Action state: `null | { success: true; count: number } | { success: false; error: "unexpected" }`.
- Audit entry: action `auth.other_sessions_signed_out`, entity `User`,
  `entityId` = acting user, `newValue: { sessionsEnded: number }`. No tokens or
  hashes are recorded.
- Ended sessions fail `validateSessionToken` on their next request (row gone).
  Those devices are sent to `/login` by the existing protected-route handling.

## Testing

- Vitest unit tests (`pnpm test`) for the action, which mocks `db` the way
  `actions/auth.test.ts` already does, and for the tab resolver.
- No browser harness exists, so the multi-device behavior is not tested
  end to end in this feature. `/check` can verify it manually with two browsers.

## Notes for the AI

- Authorization: the tab is gated by `settings.security`, which follows plan §5
  (Supervisors do not get security settings by default). `signOutOtherSessions`
  needs only a valid session, because it acts solely on the caller's own sessions.
  This matches `changePassword`, which `/account` already exposes to every user.
- Do not show the delete count from `deleteMany` as the "devices" count. The
  panel's number comes from the active-session `count` query. The audit entry
  records the rows actually deleted.
- Follow the existing `Panel` and tab markup in `settings/page.tsx`. Use logical
  CSS properties (`ps`, `ms`, `inset-s`) for RTL.
- Read the relevant guide in `node_modules/next/dist/docs/` before using
  `revalidatePath` or other Next.js APIs.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6859,"specSha256":"e6ec1dd9ae79f530a9fac7a7107bfab24317246fd3fa42348e324adc23f800ae","branch":"refs/heads/feature/security-settings","head":"5a4b3afca96535e3cdddb37705b5fffe25473e02","baseRef":"refs/heads/main","baseCommit":"200d67559814f0fc5602cb98e2de8ac7c2c02a60","sourceTree":"50cb6989ce02334b7cbdf1f241277b0d81f60f68","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 5a4b3afca96535e3cdddb37705b5fffe25473e02
**Base commit:** 200d67559814f0fc5602cb98e2de8ac7c2c02a60
**Base ref:** main
**Spec hash:** e6ec1dd9ae79f530a9fac7a7107bfab24317246fd3fa42348e324adc23f800ae
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-19T02:40:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-19T02:50:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `200d67559814f0fc5602cb98e2de8ac7c2c02a60..5a4b3afca96535e3cdddb37705b5fffe25473e02` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm test`: pass (33 files, 672 tests)
- `pnpm build`: pass

## Evidence

- Preconditions verified: `HEAD` = target, `git merge-base main HEAD` = base, raw SHA-256 of `blueprint/context/current-feature.md` matches the spec hash, and the only dirty path was `blueprint/context/review.md`.
- Reviewed all 12 changed paths in the delta: `actions/auth.ts`, `actions/auth.test.ts`, `app/(app)/settings/page.tsx`, `components/settings/SignOutOtherSessionsForm.tsx`, `components/auth/ChangePasswordForm.tsx`, `lib/audit.ts`, `lib/settings.ts`, `lib/settings.test.ts`, both locale files, the spec, and `project-overview.md`; followed `lib/auth/session.ts`, `lib/auth/current-user.ts`, `lib/audit.ts` (`recordAudit`), `useFocusOnError`, and `useSuccessToast`.
- Security: `signOutOtherSessions` takes `sessionId` and `user.id` only from `requireSession()`, deletes `{ userId, id: { not: sessionId } }`, and writes the audit row through `tx` in one interactive transaction; deleted rows fail `validateSessionToken` on the next request. The tab and its session query are gated by `settings.security` via `resolveSettingsTab`; no token or hash is logged or returned.
- Performance: the extra `session.count` runs only on the Security tab; no unbounded work added.
- Tests: new action cases (scope of delete, zero count, DB failure, no session) and `resolveSettingsTab` cases (with and without permission, financial, unknown, missing, repeated value) pass.

## Findings

- No new findings.
- F-25 [P3] open: re-examined, still open (settings page keeps its local `Panel` copy).
- F-28 [P3] open: re-examined, still open; extended to the new `signOutOtherSessions` tests, which pass `mocks.db` as the transaction client.
- F-30 [P3] open: re-examined, still open; one more U+2026 pending label, named by the spec.
- No P0 or P1 finding is open or fixed.

## Remaining risk

- Multi-device sign-out was not exercised end to end; no browser harness exists and Check was not required.
- The Security tab UI (RTL, themes, focus, toast) was not observed in a browser.
- The "same transaction" contract for the audit row is proven by code reading, not by the unit tests (F-28).
