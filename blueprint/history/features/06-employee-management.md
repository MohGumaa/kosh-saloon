# Feature: Employee management

**From build-plan:** feature 6
**Build attempt:** 1
**Branch:** feature/employee-management
**Status:** verified

## Verification

Run on `feature/employee-management` after the last step, all passing:

- `pnpm exec tsc --noEmit` (no errors)
- `pnpm lint` (no warnings)
- `pnpm test` (19 files, 235 tests; 67 of them new in `lib/employees.test.ts`
  and `actions/employees.test.ts`)
- `pnpm build` (compiled; `/employees`, `/employees/new`, and
  `/employees/[id]` are in the route list)
- Locale key parity: `locales/en.json` and `locales/ar.json` hold the same 371
  keys.

Not run: no browser, dev server, real database, or real Blob store was used.
The pages, forms, RTL layout, themes, sign-in with a created account, and a
live image upload are unobserved; the done-whens that describe them rest on
the unit tests and the build.

Differences from the plan below:

- Added `components/employees/EmployeeFields.tsx`, the inputs the create and
  edit forms share, and `components/layout/Panel.tsx` (`Panel`, `Detail`,
  `panelClass`), used by the employee profile instead of a further copy of the
  account page's panel (open finding F-25 covers the two older copies).
- `EmployeeImageForm` keeps one result for upload and remove, so an error from
  one is cleared by the next result of either and always receives focus. The
  salon `LogoForm` it was modelled on does not (open finding F-23).
- The status form shows one neutral success message for both directions.
- `username_taken` and `email_taken` were added to `AuthErrorCode` and
  `auth.errors`, where the shared `FormField` reads field messages.

## Goal

Let an authorized user create employee accounts, edit their details, role,
password, and profile image, activate or deactivate them, and view each
employee's profile. Employees are `User` rows; no new model is needed.

## Design reference

- `blueprint/reference/Employees.png` - layout reference only for the list:
  avatar next to a stacked name, a status pill, and one primary "New employee"
  button in the page header. It is another product's screen: ignore its search,
  filter, grid toggle, checkboxes, teams, export, and pagination.
- Colors, radii, and spacing come from the tokens already in `app/globals.css`
  and the existing `/employees`, `/account`, and `/settings` pages. Reuse their
  panel, tab, form field, and button patterns.

## In scope

- `/employees` list: profile image (or initials), name, username, email, role,
  status, actions. A "New employee" button for holders of `employees.create`.
- `/employees/new`: create form (name, username, email, phone, password,
  confirm password, role).
- `/employees/[id]` with tabs selected by `?tab=`:
  - Overview (default): name, username, email, phone, image, role, status,
    created date, last login.
  - Account (`?tab=account`): edit details, role, image, set password,
    activate or deactivate.
  - Permissions (`?tab=permissions`): the existing permissions form, moved here.
- Server Actions for create, update, set password, activate/deactivate, upload
  image, remove image, each authorized on the server and audited.
- The profile image shown wherever the user's avatar already appears (employee
  list, employee profile, header user menu, `/account`).
- English and Arabic text, RTL-safe layout, light and dark themes.

## Out of scope

- Hard delete. An employee is deactivated, never deleted (`AuditLog.user` is
  `onDelete: Restrict`, and later features attach invoices and settlements).
  `employees.delete` stays unused.
- The list's Revenue column and the profile's Invoices, Performance, and
  Expenses tabs. They need invoice and expense data (features 8, 10, 11, 18)
  and are added by those features. Do not render placeholder tabs or columns.
- Search, filters, sorting controls, and pagination on the list.
- A user uploading their own image, or changing their own username, email, or
  role, from `/account`.
- Inviting by email, forcing a password change on first sign-in, and any new
  email. V1 email stays limited to password reset and login notifications.
- Per-user language and theme persistence (feature 24).
- Schema changes. `User` already has every field; add no migration.

## Build loop

`workflow.stepReview` is `feature`: build every step in order, then present one
review packet. `workflow.checkpointCommits` is `disabled`: make no commits
during the build. `/complete` creates the final feature commit.

## Build steps

- [x] **1. Rules and validation.** Add `lib/employees.ts` (no database import):
  the Zod schemas for create, update, and set password, and
  `canManageEmployee(actor, target)` implementing the target rule under
  Data / contracts. Extract the username and email rules from `seedAdminSchema`
  in `lib/auth/validation.ts` into exported schemas and reuse them in both
  places. Add the new audit actions to `AUDIT_ACTIONS`.
  **Done when:** `lib/employees.test.ts` covers the target rule for every
  actor/target role pair plus self, and each schema's accept and reject cases;
  `pnpm test` and `pnpm exec tsc --noEmit` pass.

- [x] **2. Create an employee.** Add `actions/employees.ts` with
  `createEmployee`, the `/employees/new` page (requires `employees.create`,
  otherwise the existing `/forbidden` redirect), `EmployeeCreateForm`, and the
  "New employee" button on the list. A non-admin creator sees no role field and
  the server stores `STAFF` whatever the form sends.
  **Done when:** an ADMIN can create a Supervisor who can then sign in with the
  given password and holds exactly `ROLE_DEFAULTS.SUPERVISOR`; a duplicate
  username or email shows a field error and keeps the other typed values (never
  the password); the audit log shows "Created employee"; action tests pass.

- [x] **3. Profile page and tabs.** Restructure `/employees/[id]` into the
  Overview, Account, and Permissions tabs with the access rules under
  Data / contracts. Build the read-only Overview. Move the permissions form
  under `?tab=permissions` and update the list: the name links to the profile
  for holders of `employees.view`, and the Permissions link points at
  `?tab=permissions`.
  **Done when:** each tab renders only for a viewer allowed to use it, an
  unknown or disallowed `?tab` value falls back to the viewer's first allowed
  tab, a missing id renders the not-found page, and saving permissions still
  works from its new URL.

- [x] **4. Edit details and role.** Add `updateEmployee` and the details form
  on the Account tab (name, username, email, phone; role for an ADMIN actor
  only, and never for the actor's own account).
  **Done when:** changed fields are saved and audited with old and new values,
  an unchanged submit writes nothing, a role change replaces the stored
  permission list as specified, changing an email deletes that user's password
  reset tokens, and action tests cover forbidden, not found, invalid, taken,
  and unexpected results.

- [x] **5. Status and password.** Add `setEmployeeActive` and
  `setEmployeePassword` with their Account tab controls.
  **Done when:** a deactivated employee is signed out on their next request and
  cannot sign in, reactivating restores sign-in without reviving old sessions,
  setting a password signs the target out everywhere and the new password
  works, neither action is offered or accepted for the actor's own account, and
  action tests pass.

- [x] **6. Profile image.** Add `updateEmployeeImage` and
  `removeEmployeeImage` following the salon logo flow in `actions/settings.ts`,
  an `EmployeeImageForm`, and an optional `image` prop on `UserAvatar` that
  falls back to initials. Add `image` to `SessionUser` so the header menu and
  `/account` show it. First confirm where `UserAvatar` is rendered
  (`components/layout/UserMenu.tsx`, `Header.tsx`) and pass the image at each
  site.
  **Done when:** uploading a PNG, JPEG, or WebP up to 1 MB shows the image in
  the list, profile, header, and `/account`; removing it restores initials and
  deletes the blob; an oversized file, a non-image, and a missing
  `BLOB_READ_WRITE_TOKEN` each show their own message; action tests pass.

- [x] **7. Final pass.** Check both locale files hold the same keys, both
  directions and both themes render the three pages, and no shipped comment
  still says "until feature 6".
  **Done when:** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
  `pnpm build` all pass.

## Files / areas

- New: `lib/employees.ts`, `lib/employees.test.ts`, `actions/employees.ts`,
  `actions/employees.test.ts`, `app/(app)/employees/new/page.tsx`,
  `components/employees/EmployeeCreateForm.tsx`,
  `components/employees/EmployeeDetailsForm.tsx`,
  `components/employees/EmployeeImageForm.tsx`,
  `components/employees/EmployeePasswordForm.tsx`,
  `components/employees/EmployeeStatusForm.tsx`.
- Changed: `app/(app)/employees/page.tsx`, `app/(app)/employees/[id]/page.tsx`,
  `components/layout/UserAvatar.tsx` and its call sites,
  `lib/auth/session.ts` (`SessionUser.image`), `lib/auth/validation.ts`
  (exported username and email schemas), `lib/audit.ts`, `locales/en.json`,
  `locales/ar.json`, `app/(app)/account/page.tsx` (avatar image only).
- Reused as is: `requireSession`, `getPermissions`, `hasPermission`,
  `requirePermission`, `recordAudit`, `hashPassword`, `ROLE_DEFAULTS`,
  `profileSchema` rules for name and phone, `detectImageType`,
  `LOGO_MAX_BYTES`, `FormField`, `FormMessage`, `useFocusOnError`,
  `useSuccessToast`, the Blob `remotePatterns` and 2 MB action body limit
  already in `next.config.ts`.

## Data / contracts

**Actor.** Always the session user from `requireSession()`. The target id comes
from the form and is validated (`z.string().min(1).max(100)`), then loaded from
the database. Role, permissions, and status are never read from form data,
except the submitted role value an ADMIN chooses.

**Permission per action.**

| Action | Permission |
| --- | --- |
| View list, Overview tab | `employees.view` |
| Create | `employees.create` |
| Edit details, set password, upload or remove image | `employees.edit` |
| Activate or deactivate | `employees.activate` |
| Permissions tab | `permissions.manage` (unchanged) |

**Target rule (`canManageEmployee`).** Applies to edit, set password, image,
and activate/deactivate, on top of the permission above:

- An ADMIN may manage any user.
- Anyone else may manage only another user whose role is `STAFF`.
- Nobody, including an ADMIN, may deactivate their own account, change their
  own role, or set their own password here (their password changes on
  `/account`, which requires the current one). An ADMIN may edit their own
  name, username, email, phone, and image here.

Because no ADMIN can deactivate or demote themself and only an ADMIN can touch
an ADMIN, at least one active ADMIN always remains. No separate last-admin
check is needed.

**Roles.** Only an ADMIN assigns or changes a role. A non-admin creator always
creates `STAFF`.

**Permissions on create and role change.** In the same transaction as the user
write: a new `SUPERVISOR` or `STAFF` gets one `UserPermission` row per key in
`ROLE_DEFAULTS[role]`; an `ADMIN` gets none. A role change deletes the user's
stored rows and inserts the new role's defaults (none for `ADMIN`). Missing
`Permission` catalog rows throw, as in `actions/permissions.ts`.

**Fields.**

- `name`, `phone`: the rules in `profileSchema` (empty phone stored as null).
- `username`: trimmed, lowercased, `^[a-z0-9._-]+$`, the seed's existing rule.
- `email`: trimmed, lowercased, valid email, the seed's existing rule.
- `password`, `confirmPassword`: `passwordSchema` (8 to 128), must match.
  Hashed with `hashPassword`. Never echoed back in `values`, logged, or audited.
- `role`: `ADMIN | SUPERVISOR | STAFF`.
- New users are active, with the schema defaults for language and theme.

**Uniqueness.** Username and email are unique. Check before writing and also
map Prisma `P2002` to the same result, so a race gives the field error
`username_taken` or `email_taken`, not `unexpected`.

**Side effects, each in the same transaction as the change and its audit row.**

- Email changed: delete the target's `PasswordResetToken` rows.
- Deactivated: delete the target's `Session` and `PasswordResetToken` rows.
- Password set: delete the target's `Session` and `PasswordResetToken` rows.

**Audit.** New actions: `user.created`, `user.updated`, `user.activated`,
`user.deactivated`, `user.password_set`. Entity `User`, `entityId` the target.
`user.created` records name, username, email, phone, role as `newValue`.
`user.updated` records only changed fields as old and new values, including
`image` (URL or null) and, on a role change, `permissions`. Status and
password actions record no values. Add labels under `audit.actions.user` and
`audit.fields` (`username`, `role`, `image`) in both locales.

**Image storage.** Vercel Blob, public, path `employees/<userId>.<extension>`
with `addRandomSuffix: true`. The type comes from `detectImageType` on the
bytes, the size limit is `LOGO_MAX_BYTES` (1 MB), checked on the client before
submit and again on the server. If the database write fails, delete the new
blob; after success, delete the previous one best effort. `User.image` stores
the public URL.

**Result shape.** Follow `SettingsFormState`: `{ success: true }` (plus `id`
for create) or `{ success: false, error, fieldErrors?, values? }`. Form-level
codes, with labels under `employees.errors`: `forbidden`, `not_found`,
`invalid_input`, `unexpected`, `file_required`, `file_too_large`, `file_type`,
`storage_unavailable`. Field codes: `required`, `invalid_input`,
`username_taken`, `email_taken`, and the existing mismatch code used by
`ChangePasswordForm`; add missing keys where `FormField` reads them.

**URL shape.** `/employees`, `/employees/new`, `/employees/[id]`,
`/employees/[id]?tab=account`, `/employees/[id]?tab=permissions`. Later
features add `?tab=invoices`, `performance`, and `expenses`.

**Page access.** `/employees/[id]` renders when the viewer holds
`employees.view` or `permissions.manage`; otherwise it redirects to
`/forbidden`. Overview needs `employees.view`. Account shows when the viewer
may perform at least one Account action on this target. Permissions needs
`permissions.manage`. Inside Account, each form renders only when its own
action is allowed; the server enforces the same rule whatever is rendered.

**States.**

- Invalid: field errors are associated with their inputs through `FormField`,
  focus moves to the first error (`useFocusOnError`), and typed values other
  than passwords are kept.
- Denied: pages redirect to `/forbidden`; actions return `forbidden`.
- Missing target: page `notFound()`; actions return `not_found`.
- Unexpected: log with an `[employees]` prefix, return `unexpected`.
- Success: toast through `useSuccessToast`; create then navigates to the new
  profile. Revalidate `/employees`, the profile, and the layout when the
  actor's own name, email, or image changed.
- Pending: submit buttons disable and show their in-progress label.
- Empty list: not reachable, the viewer is always in the list.

**Rendering.** Names and other user text render as React text only. Username
and email keep `dir="ltr"`. The avatar image is decorative (`alt=""`), since
the name is always next to it.

## Testing

- `lib/employees.test.ts`: `canManageEmployee` matrix, schema accept/reject
  (normalization, username characters, password length and mismatch, phone
  digits, role enum).
- `actions/employees.test.ts`, mocking `db`, the session, `@vercel/blob`, and
  `hashPassword` as the existing action tests do: per action, the forbidden,
  not found, invalid, and unexpected results; the target rule and self rules;
  forced `STAFF` for a non-admin creator; default permissions on create and
  role change; taken username and email including `P2002`; session and token
  deletion; no write and no audit row on an unchanged submit; passwords absent
  from audit values and returned `values`; blob cleanup on failure.
- Existing `i18n/locales.test.ts` and `lib/audit.test.ts` must stay green.
- No Browser tests command exists, so UI behavior, RTL, and themes are checked
  by hand or with `/check`. No live Blob upload is claimed by unit tests.
- No `Verify` command exists; step 7 runs typecheck, lint, test, and build.

## Notes for the AI

- Read `actions/settings.ts` and `actions/permissions.ts` first and match their
  structure: session, permission check, parse, transaction with audit, try/catch
  with a logged prefix, revalidate.
- Read the stored row inside the transaction before diffing, as `saveSettings`
  does.
- Server Components by default. Only the forms are client components.
- Keep `lib/employees.ts` free of database imports so client forms and tests
  can use its schemas and rule.
- Use logical utilities (`ms-*`, `text-start`) and mirror directional icons
  with `rtl:-scale-x-100`.
- No em dashes, en dashes, or ellipsis characters in new prose or comments.
  Existing locale strings are not rewritten by this feature.
- This feature touches accounts, passwords, and roles, so the configured
  independent review (`when-sensitive`) is expected to select itself.

## Open questions

Each has a conservative default recorded above, so the build can start. Confirm
or change them at spec review.

1. **Non-admin reach.** The plan says a Supervisor gets permission-controlled
   access to "Staff accounts" and no access to admin accounts or role
   management by default, but defines no permission key for either. Default
   here: a non-admin with the `employees.*` permissions manages only other
   `STAFF` users and can never assign a role. Alternative: also let them manage
   `SUPERVISOR` accounts.
2. **Role change and permissions.** Default here: changing a role replaces the
   user's stored permissions with the new role's defaults, discarding custom
   grants. Alternative: keep the stored list when moving between `SUPERVISOR`
   and `STAFF`.
3. **Password and email by non-admins.** Default here: `employees.edit` covers
   setting a Staff user's password and email. Alternative: make both
   ADMIN-only.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":18182,"specSha256":"1a8c50678e9e44b9dee368a6e13f9ba7f9dccae4698c0f0a567ede841f38ea8b","branch":"refs/heads/feature/employee-management","head":"2034aa79dfe37baa53afd5c3ad27d920fb3e162b","baseRef":"refs/heads/main","baseCommit":"a475138f3badb43384f7fd611399bff6451c4186","sourceTree":"256b0dadd0b00f206ac57d53520869c8dfb3c09e","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 2034aa79dfe37baa53afd5c3ad27d920fb3e162b
**Base commit:** a475138f3badb43384f7fd611399bff6451c4186
**Base ref:** main
**Spec hash:** 1a8c50678e9e44b9dee368a6e13f9ba7f9dccae4698c0f0a567ede841f38ea8b
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-02T07:06:35Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-02T07:20:49Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `a475138f3badb43384f7fd611399bff6451c4186..2034aa79dfe37baa53afd5c3ad27d920fb3e162b` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash)
- `git status --porcelain=v1 --untracked-files=all`: pass (only `blueprint/context/review.md` and `blueprint/context/findings.md` differ, before and after the review)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (19 files, 235 tests)
- `pnpm build`: pass (`/employees`, `/employees/new`, `/employees/[id]` in the route list)
- `/check`: unavailable (not required by the request; no dev server, browser, database, or Blob store was used)

## Evidence

- All 27 paths in the `a475138..2034aa7` delta were read: `actions/employees.ts` and its tests, `lib/employees.ts` and its tests, the three employee pages, the six employee components, `components/layout/Panel.tsx`, `UserAvatar.tsx`, `UserMenu.tsx`, the session, validation, audit, and auth type changes, both locale files, and the spec.
- Callers and contracts followed outside the delta: `actions/auth.ts`, `actions/permissions.ts`, `actions/settings.ts`, `lib/auth/authorize.ts`, `lib/auth/permissions.ts`, `lib/auth/current-user.ts`, `lib/audit.ts`, `lib/settings-validation.ts`, `components/auth/FormField.tsx`, `useFocusOnError`, `useSuccessToast`, `app/(app)/audit-log/page.tsx`, `next.config.ts`, `proxy.ts`, `prisma/schema.prisma`, `prisma/seed.ts`.
- Every employee action takes the actor from `requireSession()`, checks its permission with `hasPermission`, validates the target id, loads the target from the database, and applies the target rule before writing; role is forced to `STAFF` for a non-admin creator and a role change needs `canChangeEmployeeRole`.
- Passwords are hashed with `hashPassword` and are absent from returned `values` and from audit values; deactivate and password set delete the target's sessions and reset tokens in the same transaction array as the change and its audit row.
- Uploaded images are size-checked, typed from their bytes, and stored under a server-chosen path; the new blob is deleted when the database write fails.
- Locale parity: `locales/en.json` and `locales/ar.json` hold the same 371 keys; every `audit.fields` and `audit.actions.user` key the new actions write has a label, and the audit page falls back to the raw key otherwise.
- No skipped, focused, or placeholder tests were found.
- No performance findings: the list and profile each run one user query in parallel with translations, permissions are cached per request, and the list has no pagination by the spec's own scope.

## Findings

- F-27 (P2, open): a non-admin with `employees.edit` can take over a Staff account that holds permissions the actor does not
- F-28 (P3, open): the action tests cannot tell the transaction client from `db`
- F-29 (P3, open): the employee actions copy form and upload helpers from the auth and settings actions
- F-30 (P3, open): new pending labels use the ellipsis character the spec rules out
- F-31 (P3, unverified): the target and self rules are checked before the write transaction, not inside it
- Re-examined and still open: F-22, F-24, F-25 (P3, notes added). Not re-examined in this pass: F-20, F-21, F-23, F-26.
- No P0 or P1 finding is `open` or `fixed`.

## Remaining risk

- `/check` was not run (not required). No dev server was started and no browser was used, so the three pages, the forms, focus on error, toasts, tab fallback, RTL layout, and both themes are unobserved.
- No real database was used: the interactive transactions, the `P2002` mapping through the `pg` driver adapter, the empty `createMany` on a change to ADMIN, and sign-in with a created or reset account rest on mocked unit tests.
- No real Blob store was used: `put`, `del`, and rendering the stored URL through `next/image` are unobserved.
- No `Browser tests` command and no `Verify` command are declared in `AGENTS.md`.
- No dependency or vulnerability scan was run (none is declared, and network use was not approved).
- The tab and access rules in `app/(app)/employees/[id]/page.tsx` are inline in the page and have no unit test; they were reviewed by reading.
- F-27 is a rule the spec chose as its default; it needs the user's decision before features 8 to 13 give the affected permissions financial effect.
- F-31 was derived from the code; no concurrent run was made.
