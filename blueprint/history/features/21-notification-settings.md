# Feature: Notification settings

**From build-plan:** feature 21
**Build attempt:** 1
**Branch:** feature/notification-settings
**Status:** verified

## Goal

Add a Notifications tab to `/settings`. It has one salon-wide switch that turns
login notification emails on or off. When the switch is off, signing in no
longer sends an email. When it is on (the default), sign-in works as it does today.

## In scope

- A new `SalonSettings.loginNotificationsEnabled` boolean, default `true`, with
  a migration. Existing salons keep today's behavior: an email on every sign-in.
- A **Notifications** tab on `/settings` (`/settings?tab=notifications`). Every
  user with `settings.view` sees it, like Information and Financial.
- A **Login notifications** panel with one checkbox and a save button.
  Changing it needs `settings.edit`, which the server enforces. Without that
  permission the checkbox is disabled and the existing read-only banner shows.
- Each change is audited as `settings.updated` through the existing `saveSettings`.
- `login` checks the switch before it sends the login notification email.
- English and Arabic text, a layout that works in RTL, and all themes.
- Updating `project-overview.md` so it records the switch as salon-wide and
  owned by feature 21. This follows the 2026-10-19 decision recorded in the
  feature 20 archive.

## Out of scope

- Per-user notification preferences. The 2026-10-19 decision made this switch
  salon-wide.
- Scheduled daily or weekly report emails and settlement emails (future, no cron in V1).
- Any change to password reset emails. They are always sent.
- Localizing how boolean audit values look in the audit log. They show as
  `true` / `false`, the same way the audit log shows other raw values today.
  Feature 22 covers translation completion.
- The other future settings tabs (System, Backup, Printing).

## Build loop

`workflow.stepReview` is `feature`, so all steps are built and then reviewed
together in one packet. `checkpointCommits` is `disabled`, so `/complete` makes
the only commit.

## Build steps

- [x] **1. Schema field and migration.**
  In `prisma/schema.prisma`, add `loginNotificationsEnabled Boolean @default(true)`
  to `SalonSettings`. Create the migration with
  `pnpm exec prisma migrate dev --name login_notifications`. The generated SQL
  should only add the column with `DEFAULT true`, so it is non-destructive and
  existing rows read `true`. Run `pnpm exec prisma generate`. In
  `actions/settings.test.ts`, add `loginNotificationsEnabled: true` to the
  `stored` fixture.
  **Done when:** `pnpm exec prisma validate` and `pnpm exec prisma migrate status`
  pass, the migration SQL contains only that `ADD COLUMN`, and `pnpm exec tsc --noEmit`
  passes.

- [x] **2. Update action.**
  In `actions/settings.ts`, add `loginNotificationsEnabled: boolean` to
  `SettingsChanges`. Add `updateNotificationSettings(_prev: SettingsFormState, formData)`:
  1. Call `requireSession()`.
  2. Check `hasPermission(user, "settings.edit")`. Without it, return `forbidden`.
  3. Read the checkbox. If the field is missing, the value is `false`. If the
     field holds the checkbox's checked value, the value is `true`. Any other
     value returns `invalid_input` and writes nothing. In this step, confirm
     what value the Base UI `Checkbox` submits when checked: give it an explicit
     `value` if it supports one, otherwise match its default.
  4. Call `saveSettings(user.id, { loginNotificationsEnabled })`. This writes
     the row and the `settings.updated` audit entry only when the value changed.
  5. Call `revalidatePath("/settings")` and return `{ success: true }`. On a
     failure, log it and return `unexpected`.

  Add `audit.fields.loginNotificationsEnabled` ("Login notification emails") to
  both locale files.
  **Done when:** new `updateNotificationSettings` cases in `actions/settings.test.ts`
  pass under `pnpm test`. They cover: forbidden with no write, enabling and
  disabling with the audit entry inside the transaction (old and new values),
  no write when unchanged, `invalid_input` for an unexpected value, a database
  failure returning `unexpected`, and requiring a session first.

- [x] **3. Login respects the switch.**
  In `actions/auth.ts` `login`, run the check inside the existing
  `afterResponse("login notification email", …)` task, before `sendEmail`. Read
  `getSalonSettings()` and return early when `loginNotificationsEnabled` is
  `false`. The read happens after the response, so it never slows sign-in down
  and never makes it fail. If the settings read throws, `afterResponse` logs the
  error and no email is sent. Everything else in `login` stays the same.
  **Done when:** new cases in `actions/auth.test.ts` pass under `pnpm test`.
  Add `salonSettings` to its `db` mock. The cases show that sign-in sends the
  email when the switch is enabled and sends none when it is disabled. Both
  cases still create the session and redirect. A failed settings read is logged,
  sends no email, and does not break the after-response run. The existing login
  email tests still pass.

- [x] **4. Notifications tab and form.**
  In `lib/settings.ts`, add `"notifications"` to `SettingsTab`.
  `resolveSettingsTab` returns it for `tab === "notifications"` and needs no
  permission beyond the page's `settings.view`. In `app/(app)/settings/page.tsx`:
  - Add the tab to `TABS` with the `Bell` icon and the href
    `/settings?tab=notifications`, placed after Security.
  - Remove the stale comment "Notifications joins these in feature 21."
  - Render a `Panel` (icon `Mail`, `settings.notifications.title` / `description`)
    containing the new client component
    `components/settings/NotificationsForm.tsx`, with
    `loginNotificationsEnabled={settings.loginNotificationsEnabled}` and
    `readOnly={readOnly}`.

  The form follows the `FinancialForm` pattern:
  - It uses `useActionState(updateNotificationSettings)`, `useFocusOnError`, and
    `useSuccessToast(state, t("notifications.success"))`. A failure renders
    `FormMessage` with tone `error` and the `settings.errors.*` text.
  - It shows a labelled `Checkbox` (wrapped in a `<label>`, as in
    `PermissionsForm`) with a hint below. The checkbox's `aria-describedby`
    points to the hint.
  - It uses `defaultChecked` and remounts with a key on the stored value.
  - When `readOnly`, the checkbox is disabled and there is no submit button.
    Otherwise there is a submit button that uses `settings.submit` /
    `submitting` and is disabled while pending.

  Add `settings.tabs.notifications` and a `settings.notifications.*` block
  (`title`, `description`, `loginLabel`, `loginHint`, `success`) to
  `locales/en.json` and `locales/ar.json`. `loginHint` explains that each user
  gets an email at their account address when they sign in, and that password
  reset emails are always sent. Update `settings.description` in both locale
  files to mention notifications. Use logical CSS properties only.
  **Done when:** the `lib/settings.test.ts` cases for `resolveSettingsTab` cover
  `notifications`, both with and without `settings.security`. `pnpm test`,
  `pnpm lint`, and `pnpm exec tsc --noEmit` pass. An ADMIN sees the tab, can
  turn the switch off and on, and gets a toast. A viewer without `settings.edit`
  sees a disabled checkbox, the read-only banner, and no save button.

- [x] **5. Overview and final verification.**
  Update `blueprint/context/project-overview.md`:
  - Add `loginNotificationsEnabled` (Boolean, default true) to the SalonSettings
    data model.
  - Change feature 20's line to drop "login notification preference".
  - Change feature 21's line to say "salon-wide login notification email switch".

  Then run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build`.
  **Done when:** all four pass, and the results are reported as observed.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_login_notifications/migration.sql`
- `actions/settings.ts`, `actions/settings.test.ts`: new action and tests
- `actions/auth.ts`, `actions/auth.test.ts`: the switch check in `login`
- `lib/settings.ts`, `lib/settings.test.ts`: tab type and resolver
- `app/(app)/settings/page.tsx`: tab and panel
- `components/settings/NotificationsForm.tsx`: new client form
- `locales/en.json`, `locales/ar.json`
- `blueprint/context/project-overview.md`

## Data / contracts

- Column `SalonSettings.loginNotificationsEnabled`: `BOOLEAN NOT NULL DEFAULT true`.
  It lives on the single `"salon"` row. `getSalonSettings` creates that row with
  the schema default when it is missing.
- Action state: the existing `SettingsFormState` (no fields), with errors
  `forbidden | invalid_input | unexpected`.
- Form field: `loginNotificationsEnabled`. Missing means `false`; the checkbox's
  checked value means `true`; anything else is `invalid_input`.
- Audit entry: action `settings.updated`, entity `SalonSettings`, `entityId` `"salon"`,
  `oldValue: { loginNotificationsEnabled: "true" | "false" }` (the stored value's
  string form, which `saveSettings` already produces),
  `newValue: { loginNotificationsEnabled: boolean }`. It is written only when the
  value changes, in the same transaction as the update.
- Login email: sent only when the setting reads `true` at the moment the email
  task runs. Password reset emails are not affected.

## Testing

- Vitest unit tests (`pnpm test`) for the action (with the `db` mocked as
  `actions/settings.test.ts` already does), the login gating (the
  `afterCallbacks` pattern in `actions/auth.test.ts`), and the tab resolver.
- No Verify command or browser harness exists. The tab UI, the toast, RTL, the
  themes, and a real email being skipped are not tested end to end here.
  `/check` can verify them by hand.
- The migration needs the local database from `.env`. If it cannot be reached,
  stop step 1 and report it. Do not hand-write the migration.

## Notes for the AI

- Authorization: viewing uses `settings.view` (enforced by the page's
  `requirePermission`), and changing uses `settings.edit` (checked server-side
  in the action). This is a salon-wide setting, so it follows Information and
  Financial, not the Security tab's own-account rule. The client `readOnly` is
  only for display.
- Disabling the switch removes a security signal for every user. The audit
  entry is the record of who changed it. Do not skip the audit when the value
  is `false`.
- Reuse `saveSettings`. Its comparison works for a boolean as it is.
- Keep the settings read inside the after-response task. Do not add a database
  read before `redirect` in the sign-in path.
- Read the relevant guide in `node_modules/next/dist/docs/` before touching
  `after`, `revalidatePath`, or other Next.js APIs.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10785,"specSha256":"40a0de6b1ecdd997026a62366a0b8271799a703ca075a7b197fce806b1b186a9","branch":"refs/heads/feature/notification-settings","head":"515b891d0ab900d361b9aac9c68d7bc98aaf1f3b","baseRef":"refs/heads/main","baseCommit":"8debe3ca8f3d0e33be3ab6434a2eac6cca5347e4","sourceTree":"3b19315d14445262329d26f2db10277d544dd072","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 515b891d0ab900d361b9aac9c68d7bc98aaf1f3b
**Base commit:** 8debe3ca8f3d0e33be3ab6434a2eac6cca5347e4
**Base ref:** main
**Spec hash:** 40a0de6b1ecdd997026a62366a0b8271799a703ca075a7b197fce806b1b186a9
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-19T03:30:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-18T23:27:55Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `pnpm lint`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm test`: pass (33 files, 682 tests)
- `pnpm build`: pass
- `/check`: not required by the request; not run

## Evidence

- Preconditions verified: `HEAD` = target, `git merge-base main <target>` = base, raw SHA-256 of `blueprint/context/current-feature.md` = Spec hash (tracked spec, no snapshot), only `blueprint/context/review.md` dirty before review and after the build.
- Whole `8debe3c..515b891` delta reviewed (15 files): schema and migration (only `ADD COLUMN ... BOOLEAN NOT NULL DEFAULT true`), `updateNotificationSettings`, the login gate, the tab resolver, the page, `NotificationsForm`, both locales, and the overview.
- Authorization: the action calls `requireSession` first and checks `settings.edit` on the server before any read or write. The page still requires `settings.view`, and the new tab is read-only without `settings.edit` (`app/(app)/settings/page.tsx:66`).
- Input trust: only a missing field or `"true"` is accepted, and anything else returns `invalid_input` with no write. Base UI 1.8.0 `CheckboxRoot` submits the `value` prop when checked and nothing when unchecked (no `uncheckedValue`), which matches `CHECKBOX_ON`.
- Audit: `saveSettings` writes the update and `settings.updated` in one transaction, only on change, for `true` and for `false` alike. `auditChanges` displays a boolean `false` as `"false"`, as the spec's out-of-scope note expects.
- Login: the settings read runs inside `afterResponse` before `sendEmail`. No database read was added before `redirect`. A read failure is caught and logged by `afterResponse`. `login` is the only sender of `loginNotificationEmail`, and password reset is untouched.
- Tests cover every case in spec steps 2 to 4. The enabled login path stays covered by the existing test, with the new mock defaulting to `true`.

## Findings

- F-58 [P3] open: unrelated whitespace drift (`=(`) in `lib/settings-validation.ts:7` and `actions/settings.test.ts:317`
- No P0 or P1 findings

## Remaining risk

- No browser harness: the tab UI, success toast, disabled checkbox with read-only banner, RTL layout, and themes were reviewed from code only and not seen running.
- No Verify command configured. The four declared commands were run individually instead.
- No real email delivery or production after-response run was observed. Login gating is proven only by unit tests with `after` mocked.
- `NotificationsForm` has no component test (the project has no component test setup, and the spec accepts this).
- `pnpm exec prisma migrate status` was not run, because it needs the local database. The migration SQL was reviewed statically.
