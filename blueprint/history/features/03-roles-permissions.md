# Feature: Roles & permissions

**From build-plan:** feature 3
**Build attempt:** 1
**Branch:** feature/roles-permissions
**Status:** verified

## Goal

Give every later feature one server-side way to ask "may this user do this?".
The three roles (ADMIN, SUPERVISOR, STAFF) already exist on `User`. This
feature adds the permission catalog, a stored permission list per user filled
from role defaults, server-side checks, sidebar items that follow those
permissions, and a screen where permissions are managed per user.

## In scope

- **Catalog.** The 33 permission keys from the project overview, grouped:
  - `employees.{view,create,edit,delete,activate}`
  - `services.{view,create,edit,delete}`
  - `invoices.{view,create,edit,delete,change_status}`
  - `expenses.{view,create,edit,delete}`
  - `employee_expenses.{view,create,edit,delete}`
  - `reports.{view,view_all_employees,view_own_performance}`
  - `settlements.{view,create,approve,mark_paid}`
  - `settings.{view,edit,security}`
  - `permissions.manage`
- **Role defaults.**
  - ADMIN: every permission, always. Nothing is stored for an admin and an
    admin's permissions cannot be edited.
  - SUPERVISOR: `employees.view`, `services.view`,
    `invoices.{view,create,edit,change_status}`, `expenses.{view,create}`,
    `employee_expenses.{view,create}`, `reports.{view,view_all_employees}`,
    `settlements.{view,create}`.
  - STAFF: `services.view`, `invoices.{create,view}`,
    `reports.view_own_performance`, `settlements.view`.
- **Stored list per user (decided).** Each Supervisor or Staff user has their
  own stored list of permissions. A user's effective permissions are exactly
  that list; role defaults are only what the list is filled with. Changing a
  role's defaults in code later does not touch existing users.
- **Server-side checks.** Helpers that load the signed-in user's permissions
  once per request and guard pages and Server Actions. A denied page shows an
  access-denied page inside the app shell; a denied action returns a
  `forbidden` error and writes nothing.
- **Sidebar by permission.** A sidebar item is hidden when the user lacks its
  permission; a group with no visible items is hidden. Items whose feature is
  not built yet stay disabled ("coming soon") as today.
- **Employee list (minimal, decided).** `/employees`: a read-only table of all
  users with name, username, email, role, and active status. Requires
  `employees.view`. Each Supervisor or Staff row links to that user's
  Permissions tab when the viewer may manage permissions. Feature 6 adds
  create, edit, images, revenue, and the other columns.
- **Permissions tab (decided).** `/employees/[id]` with one tab, Permissions
  (feature 6 adds the other tabs). Requires ADMIN or `permissions.manage`. It
  shows the user's name, role, and status, and one checkbox per permission,
  grouped as above, with a Save button and a "Reset to role defaults" button
  that only re-ticks the boxes; nothing is stored until Save.
  - Target is an ADMIN: read-only, with a note that admins always have every
    permission.
  - Target is the viewer themselves: read-only, with a note that you cannot
    change your own permissions.
  - Unknown id: the standard not-found page.
- **Who may change what (decided: limited managers).**
  - An ADMIN may give or remove any permission for any Supervisor or Staff
    user.
  - A non-admin holding `permissions.manage` may change only Supervisor and
    Staff users other than themselves, only permissions they hold themselves,
    and never `permissions.manage`. Boxes they cannot change are shown
    disabled with the target's current value.
  - The server applies these rules itself; a permission the actor may not
    change always keeps the target's stored value, whatever the form sends.
- **States.** Saving shows a pending button; success and form-level errors use
  the existing `FormMessage`; unexpected failures on pages reach the existing
  `app/(app)/error.tsx`.
- **EN/AR, RTL, themes.** Every label, group name, permission name, note, and
  message exists in `locales/en.json` and `locales/ar.json`; layouts use
  logical (start/end) utilities.

## Out of scope

- Creating, editing, activating, or deleting users, changing a user's role,
  and filling a new user's list from role defaults at creation (feature 6).
  This feature exports the role-defaults helper feature 6 will call.
- Record-level "own only" scoping for STAFF (own invoices, own settlement,
  own performance). The features that own those records enforce it
  (8, 12, 15, 18); the permission key is the same for everyone.
- Audit log entries for permission changes (feature 4).
- Enforcing permissions on routes that do not exist yet. Each later feature
  calls the helpers from this one.
- A Role table, custom roles, or editing role defaults in the UI.

## Build loop

`workflow.stepReview` is `feature` and checkpoint commits are disabled: build
all steps in order, run the narrow check for each, then present one review
packet after the final step. `/complete` makes the feature commit.

## Build steps

- [x] **1. Catalog, schema, and migration.** Add the permission catalog and
  role defaults as code, the `Permission` and `UserPermission` models, and a
  migration that creates the tables and inserts the 33 catalog rows.
  **Done when:** `pnpm exec prisma validate` passes and
  `pnpm exec prisma migrate status` reports the schema in sync; unit tests
  show the catalog has exactly the 33 keys above, the Supervisor and Staff
  defaults match this spec exactly, and the keys inserted by the migration SQL
  equal the catalog keys.
- [x] **2. Server-side authorization helpers.** Load the signed-in user's
  permissions once per request (every key for an ADMIN without a query, the
  stored list otherwise) and add a page guard, an action check, and the
  access-denied page.
  **Done when:** unit tests with a mocked database show an ADMIN holding every
  key, a non-admin holding exactly their stored keys, the page guard
  redirecting a user without the permission to `/forbidden`, and the action
  check reporting denial without throwing; `/forbidden` renders inside the app
  shell in EN and AR with a link back to the dashboard.
- [x] **3. Sidebar by permission.** Give navigation items an optional required
  permission, compute the visible items on the server, and pass only the
  visible item keys to the client sidebar (desktop and mobile drawer). Enable
  the Employees item.
  **Done when:** a unit test shows the visible items for an ADMIN (all), a
  default Supervisor, and a default Staff user, with empty groups removed; the
  Employees item links to `/employees` for users with `employees.view` and is
  absent for a default Staff user.
- [x] **4. Employee list.** Build the read-only `/employees` page guarded by
  `employees.view`.
  **Done when:** an admin sees every user with name, username, email, role,
  and status, in EN and AR; a user without `employees.view` who opens
  `/employees` lands on the access-denied page; the Permissions link appears
  only on Supervisor and Staff rows and only for a viewer who may manage
  permissions.
- [x] **5. Permissions tab and save action.** Build `/employees/[id]` with the
  Permissions tab, the grouped checkbox form, "Reset to role defaults", and
  the save action with the rules under "Who may change what".
  **Done when:** unit tests on the action show an admin replacing a Staff
  user's list in one transaction; a limited manager changing only permissions
  they hold, with other submitted keys ignored and `permissions.manage` never
  changed; and refusal with nothing written for an admin target, the actor's
  own id, an unknown user id, an unknown permission key, and an actor without
  `permissions.manage`. In the browser, an admin saves a change for a Staff
  user and the reloaded page shows it; an admin target and the viewer's own
  page are read-only.
- [x] **6. Verify.** Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`,
  `pnpm build`, and `pnpm exec prisma migrate status`.
  **Done when:** all five pass and the EN and AR locale key sets match.
- [x] **7. Repair F-21: boxes revert after Save.** React resets a form after
  its `action` runs, which put the controlled checkboxes back to their
  page-load values; a second Save then sent the old values and undid the
  change. Submit the Permissions form through `onSubmit` so no reset happens.
  **Done when:** in the browser, an admin presses "Reset to role defaults" and
  Save for a Staff user, the five default boxes stay ticked without a reload,
  and they are still ticked after a second Save and a page reload.
- [x] **8. Repair F-22 and F-23: test gaps.** Move the empty-group filter from
  `SidebarNav` into `lib/navigation.ts` as `visibleNavGroups` and test it; make
  the save-action test prove the transaction received the delete and create
  operations themselves.
  **Done when:** unit tests show a default Staff user gets no `system` group
  and a user with no permissions gets only the ungrouped dashboard item, and
  the "one transaction" test asserts the exact operations passed to
  `$transaction`.
- [x] **9. Verify again.** Run the step 6 commands after the repairs.
  **Done when:** all five pass.

## Files / areas

- `prisma/schema.prisma`, new `prisma/migrations/<timestamp>_permissions/`
- New `lib/auth/permissions.ts` (catalog, groups, role defaults; no database
  import, so client components and tests can use it) and its test
- New `lib/auth/authorize.ts` (request-cached permission loading, page guard,
  action check) and its test
- `lib/navigation.ts` (required permission per item, visible-items function)
  and a test; `components/layout/SidebarNav.tsx`, `Sidebar.tsx`, `Header.tsx`,
  `app/(app)/layout.tsx`
- New `app/(app)/forbidden/page.tsx`, `app/(app)/employees/page.tsx`,
  `app/(app)/employees/[id]/page.tsx`
- New `components/employees/PermissionsForm.tsx` (client)
- New `actions/permissions.ts` and `actions/permissions.test.ts`
- `locales/en.json`, `locales/ar.json`

## Data / contracts

- **Permission:** `id` (cuid-style string), `key` (string, unique), `name`
  (string, English), `description` (string, English), `createdAt`,
  `updatedAt`. Rows are inserted only by migrations; the UI shows translated
  names from the locale files, never `name` or `description`.
- **UserPermission:** `id`, `userId` -> User (cascade on delete),
  `permissionId` -> Permission (cascade on delete), `createdAt`, `updatedAt`;
  unique on (`userId`, `permissionId`); index on `userId`.
- **Effective permissions:** ADMIN = every catalog key; otherwise exactly the
  user's `UserPermission` rows. A non-admin with no rows has no permissions.
- **Role defaults helper:** returns the default keys for SUPERVISOR or STAFF.
  Used by "Reset to role defaults" now and by feature 6 at user creation.
- **Save action** `updateUserPermissions(prevState, formData)`:
  - Input: `userId` (string) and zero or more `permissions` values, validated
    with Zod against the catalog keys.
  - The actor always comes from `requireSession()`, never from the form.
  - New list = (target's current keys the actor may not change) plus
    (submitted keys the actor may change). Removed and added rows are written
    in one transaction.
  - Result: `{ success: true }` or
    `{ success: false, error: "forbidden" | "not_found" | "invalid_input" | "unexpected" }`.
    Only expected cases map to the first three; anything else is logged and
    returns `unexpected`.
  - Changes take effect on the target's next request, because permissions are
    read from the database on every request.
- **Sidebar permission per item:** Invoices `invoices.view`; Salon expenses
  `expenses.view`; Employees `employees.view`; Services `services.view`;
  Reports > Revenue, Expenses, Employee earnings `reports.view`; Reports >
  Employee performance `reports.view` or `reports.view_own_performance`;
  Reports > Settlements `settlements.view`; Settings `settings.view`;
  Dashboard none.
- **URLs:** `/employees`, `/employees/[id]` (Permissions is the default and
  only tab for now), `/forbidden`.

## Testing

- Unit tests (Vitest, next to their source) for the catalog and defaults, the
  migration-to-catalog key match, the authorization helpers, the visible
  navigation function, and the save action, as listed in the build steps.
- No Browser tests command is declared, so browser behaviour is checked by
  hand against a running dev server during `/implement`; the user starts the
  server.
- Final gate: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`,
  `pnpm build`, `pnpm exec prisma migrate status`.

## Notes for the AI

- The migration needs a reachable database (`kosh_DATABASE_URL`); use
  `pnpm exec prisma migrate dev`, never `db push`.
- User creation is feature 6, so trying this by hand needs one Supervisor and
  one Staff row created directly in the database (for example with
  `pnpm exec prisma studio`). Such users start with an empty list; use "Reset
  to role defaults" and Save to give them their defaults.
- Follow the existing patterns: `requireSession()` first in every page and
  action, Zod validation, try/catch around database writes only, the
  `FormMessage` and `useActionState` form pattern from `ProfileForm`, and the
  panel and table styling already used on the dashboard and account pages.
- Send only display data to client components: the form receives the catalog
  groups, the target's current keys, the role defaults, and which keys the
  viewer may change. The sidebar receives visible item keys, not permissions.
- A manager with `permissions.manage` but without `employees.view` can reach a
  Permissions tab only by URL; that is accepted for now.
- The report items' sidebar permissions are the simplest reading of the
  overview; features 16 to 19 may refine them when they build those pages.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13896,"specSha256":"762b44d32830a3aadbe87d59a2ae4de6632ffdab86286999f4dc16d77215150a","branch":"refs/heads/feature/roles-permissions","head":"e7805ad9b2049a703f8f29fc64d9d31cf8a8b6d6","baseRef":"refs/heads/main","baseCommit":"7f149ad16c58f24cd51a7797bd8cbdd2181ad481","sourceTree":"3237ad7691b922f33b421b6b71456e127ccd658a","absentOptional":[]} -->

## Findings

### 3/F-21 [P1] closed - Permission checkboxes may snap back to their page-load values after Save

**File:** components/employees/PermissionsForm.tsx:80
**Found:** 2026-10-01 by /audit independent (scope: current; lens: quality)
**Why it matters:** The checkboxes are controlled (`checked={checked.has(key)}`) inside a `<form action={action}>`. React 19 resets the form when the action finishes by calling the native `form.reset()` after the commit's updates (`recursivelyResetForms` in the bundled react-dom), and a native reset puts each checkbox back to its `defaultChecked`. React sets `defaultChecked` once at mount and does not move it for a controlled checkbox (`updateInput` only writes it when `checked` is null). So after a save the boxes can show the page-load values while the component state and the database hold the new ones. The submitted `FormData` comes from the DOM, so pressing Save again without touching a box would send the old values and silently undo the change on the server. Whether a later re-render (the `revalidatePath` refresh) re-syncs the boxes before the user can act was not determined: no browser or DOM runner was available to this review, and the recorded browser evidence only covers a reloaded page. If confirmed this is P1, because it rewrites authorization data the user did not intend to change.
**Suggested fix:** Confirm first: as an admin, tick one box for a Staff user, press Save, and without reloading check the box still shows ticked, then press Save again and reload. If the boxes revert, remount the form on a successful save (for example a `key` on the form that changes with the saved list) or make the checkboxes uncontrolled with `defaultChecked` taken from the refreshed `current` prop, so the DOM and the stored list agree after every save.
**Resolution:** 2026-10-01 by /implement (spec step 7): confirmed by the user in the browser before the repair (after "Reset to role defaults" and Save the five Staff defaults showed unticked without a reload, and a second Save plus reload left them unticked). The form now submits through `onSubmit` with the action dispatched in a transition, so React performs no form reset. The user repeated the same steps after the repair: the boxes stayed ticked after Save and after a second Save and reload. Severity was left as recorded by the review, which rated a confirmed case P1. Awaiting re-review.
2026-10-01 by /audit independent (target `e7805ad`): closed, and severity corrected from P2 to P1 because the ledger records the user reproducing the silent undo of a saved permission list, which is the case the original entry rated P1. Re-examined `components/employees/PermissionsForm.tsx:59-66`: the form has no `action` prop, `handleSubmit` calls `preventDefault()`, builds `FormData` from the form, and dispatches the `useActionState` action inside `startTransition`. In the bundled react-dom (React 19.2.8) the reset is requested only from `startHostTransition`, the path a form `action` submit takes; `dispatchActionState` does not request it, so no native reset runs and the controlled boxes keep the component state that was just saved. Disabled boxes are still left out of the submitted data and the server keeps their stored values (`actions/permissions.ts:50-52`). The repair introduced no new defect. This review had no browser, so the after-repair behaviour rests on this code reading plus the user's recorded browser check. One accepted trade-off of the spec's step 7 design is listed under the receipt's remaining risk (a click on Save before the page hydrates is a plain GET that saves nothing).

### 3/F-22 [P3] closed - Empty sidebar groups are removed in the client component, which no test covers

**File:** components/layout/SidebarNav.tsx:23
**Found:** 2026-10-01 by /audit independent (scope: current; lens: tests)
**Why it matters:** Build step 3's done-when asks for a unit test showing the visible items "with empty groups removed". `lib/navigation.test.ts` only checks the flat key list from `visibleNavKeys`; the code that drops a group with no visible items sits in the client component `SidebarNav` and is not exercised by any test. A change that left an empty group heading on screen would pass the suite.
**Suggested fix:** Move the group filter into `lib/navigation.ts` as a small pure function (for example `visibleNavGroups(navKeys)`), have `SidebarNav` call it, and assert in `lib/navigation.test.ts` that a default Staff user gets no `system` group and a user with no permissions gets only the ungrouped dashboard item.
**Resolution:** 2026-10-01 by /implement (spec step 8): the filter moved to `visibleNavGroups` in `lib/navigation.ts`, `SidebarNav` calls it, and `lib/navigation.test.ts` covers an ADMIN, a default Staff user, and a user with no permissions. `pnpm test` passes (108 tests). Awaiting re-review.
2026-10-01 by /audit independent (target `e7805ad`): closed. `visibleNavGroups` is a pure function at `lib/navigation.ts:65-70`, `components/layout/SidebarNav.tsx:22` calls it and no longer filters groups itself, and `lib/navigation.test.ts:35-62` asserts the group keys for an ADMIN, that a default Staff user gets no `system` group with exactly their items in the other groups, and that a user with no permissions gets only the ungrouped dashboard item. A change that kept an empty group would now fail the suite. The module still imports only a type from `lib/auth/permissions`, so nothing server-only reaches the client. No new defect.

### 3/F-23 [P3] closed - The save-action test cannot tell whether the writes ran inside the transaction

**File:** actions/permissions.test.ts:63
**Found:** 2026-10-01 by /audit independent (scope: current; lens: tests)
**Why it matters:** The "one transaction" test asserts that `$transaction` was called once with an array of length 2 and, separately, that `deleteMany` and `createMany` were called with the right arguments. The mocked `deleteMany` and `createMany` return `undefined`, so the array is `[undefined, undefined]` whatever the action passes. An action that awaited both writes on their own and then called `$transaction` with any two values would still pass, which is the exact regression (a half-applied permission list) the step's done-when is meant to guard.
**Suggested fix:** Make the two mocks return distinct sentinel values in that test and assert `$transaction` received exactly `[deleteSentinel, createSentinel]`.
**Resolution:** 2026-10-01 by /implement (spec step 8): the two write mocks return distinct values in that test and it asserts `$transaction` received exactly those two, in order. `pnpm test` passes. Awaiting re-review.
2026-10-01 by /audit independent (target `e7805ad`): closed. `actions/permissions.test.ts:59-66` makes `deleteMany` and `createMany` return the distinct values `delete-op` and `create-op` and asserts `$transaction` was called once with exactly `["delete-op", "create-op"]`. An action that awaited the two writes on their own and passed other values to `$transaction` would now fail, and the arguments of both writes are still asserted. The `mockReturnValueOnce` values are consumed in that test and `vi.clearAllMocks()` runs before each test, so they do not leak. No new defect.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** e7805ad9b2049a703f8f29fc64d9d31cf8a8b6d6
**Base commit:** 7f149ad16c58f24cd51a7797bd8cbdd2181ad481
**Base ref:** main
**Spec hash:** 762b44d32830a3aadbe87d59a2ae4de6632ffdab86286999f4dc16d77215150a
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T11:24:45Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T11:33:56Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `7f149ad16c58f24cd51a7797bd8cbdd2181ad481..e7805ad9b2049a703f8f29fc64d9d31cf8a8b6d6` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, merge base, and spec hash match the request; only `review.md` and `findings.md` differ from the target, before and after the review)
- `pnpm test`: pass (13 files, 108 tests)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm build`: pass (`/employees`, `/employees/[id]`, and `/forbidden` compile as dynamic routes)
- `pnpm exec prisma validate`: pass
- `pnpm exec prisma migrate status`: pass (2 migrations found, database schema up to date)
- Locale key comparison (node one-liner): pass (216 keys in each of `locales/en.json` and `locales/ar.json`, none missing; all 33 `permissions.keys.*`, 9 group, and 4 error keys present)
- Search for skipped, focused, or placeholder tests: pass (none found)

## Evidence

- Reviewed the full `7f149ad..e7805ad` delta (commits `3ca5de0` and `e7805ad`, 21 files) plus `lib/auth/current-user.ts`, `lib/auth/session.ts`, `proxy.ts`, and `components/ui/button.tsx` as callers and contracts.
- Server-side trust boundary, `actions/permissions.ts:31-52`: the actor comes only from `requireSession()` (which rejects inactive users and reads the role from the database on each request); input is Zod-validated against the catalog; a caller without `permissions.manage` is refused before the target is looked up; an ADMIN target and the actor's own id are refused; the change set is computed only over `changeableKeys(actor.role, actorPermissions)`, so keys the actor does not hold and `permissions.manage` keep the target's stored value whatever the form sends.
- Writes, `actions/permissions.ts:54-65`: the delete and create run in one `$transaction`; `createMany` uses `skipDuplicates` against the unique (`userId`, `permissionId`) index; a missing catalog row aborts before any write; failures are logged and return `unexpected`.
- Pages: `/employees` requires `employees.view`, `/employees/[id]` requires `permissions.manage`, and `/forbidden` requires a session. The client form receives only display data, and the sidebar receives item keys rather than the permission list.
- Migration `20261001094803_permissions`: tables, unique and `userId` indexes, and cascade foreign keys match `prisma/schema.prisma`; the 33 inserted keys equal the catalog (asserted by `lib/auth/permissions.test.ts:48-58`).
- F-21 repair, `components/employees/PermissionsForm.tsx:59-66`: the form submits through `onSubmit` and dispatches the action in a transition. In the bundled react-dom (React 19.2.8) the form reset is requested only on the form `action` path (`startHostTransition`), not by `dispatchActionState`.
- F-22 repair: `visibleNavGroups` in `lib/navigation.ts:65-70`, used by `SidebarNav.tsx:22`, covered by `lib/navigation.test.ts:35-62`.
- F-23 repair: `actions/permissions.test.ts:59-66` asserts `$transaction` received exactly the delete and create operations.

## Findings

- No new findings in the `7f149ad..e7805ad` delta across the four lenses.
- F-21 [P1] closed (severity corrected from P2, because the ledger records the user reproducing the defect before the repair)
- F-22 [P3] closed
- F-23 [P3] closed
- F-20 [P3] open, carried forward from earlier work and not blocking; its text now lives in `blueprint/history/fixes/repair-review-findings-f-17-to-f-19.md`, outside this delta

## Remaining risk

- No browser or DOM runner was available to this review and Check was not required. The Permissions form's behaviour after Save (F-21) was verified by code reading and the user's browser check recorded in the ledger, not observed by the reviewer.
- The form now has no `action`, so pressing Save before the page hydrates (or with JavaScript off) sends a plain GET to the same URL and stores nothing, with no message. This follows the approved step 7 design and writes no data.
- Locked (disabled) boxes show the form's local state, which equals the stored value at page load. If another manager changes the same user while the page is open, they can be stale until a reload; the server still keeps the stored values.
- The action reads the actor's and target's permissions before the transaction, not inside it. A concurrent change between the read and the write (for example the actor losing `permissions.manage` in that moment) is not re-checked. The window is one request, and the next request is checked again.
- A target user's sidebar is rendered by the shared layout, so after their permissions change it can show old items until a full page load. Pages and actions check permissions on every request, so this is display only.
- `/employees` lists every user without pagination, which fits a single salon; revisit in feature 6 if the list grows.
- The archived spec text behind F-20 was read but not reviewed as part of this delta.
- No verification command was unavailable.
