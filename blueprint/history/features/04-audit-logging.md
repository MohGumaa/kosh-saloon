# Feature: Audit logging

**From build-plan:** feature 4
**Build attempt:** 1
**Branch:** feature/audit-logging
**Status:** verified

## Goal

Give every later feature one way to record "who changed what, and when", and
give the admin a page to read that record. This feature adds the `AuditLog`
table, one helper that writes an entry in the same transaction as the change it
describes, entries for the changes that already exist (sign-in, sign-out,
password change, password reset, profile update, permission update), and an
admin-only audit log page.

Invoice, expense, share percentage, settlement, and other financial entries are
written by the features that build those changes (5 to 13), using this helper.

## In scope

- **`AuditLog` table.** Append-only: rows are only ever inserted. Fields as in
  the project overview: acting user, action, entity, entity id, old value, new
  value, created time. No `updatedAt`.
- **One write helper.** `recordAudit(entry, client?)` in `lib/audit.ts`. It
  returns the Prisma create operation without awaiting it, so a caller can put
  it in a `db.$transaction([...])` array next to the change, or pass an
  interactive transaction client. The change and its audit entry are saved
  together or not at all.
- **Typed action catalog.** Feature 4 defines these actions; later features add
  theirs to the same catalog:
  - `auth.login` - a successful sign-in
  - `auth.logout` - a sign-out by the user
  - `auth.password_changed` - password changed while signed in
  - `auth.password_reset` - password set through an emailed reset link
  - `user.profile_updated` - a user changed their own name or phone
  - `permissions.updated` - a user's permission list was changed
- **Entries for existing changes.**

  | Action | Acting user | Entity / id | Old value | New value |
  | --- | --- | --- | --- | --- |
  | `auth.login` | the account | `User` / its id | none | none |
  | `auth.logout` | the session user | `User` / its id | none | none |
  | `auth.password_changed` | the session user | `User` / its id | none | none |
  | `auth.password_reset` | the account | `User` / its id | none | none |
  | `user.profile_updated` | the session user | `User` / its id | changed fields only, before | changed fields only, after |
  | `permissions.updated` | the session user | `User` / target id | `{ permissions: [...] }` before | `{ permissions: [...] }` after |

  - A profile save or permission save that changes nothing writes no entry.
  - Permission lists are stored in catalog order (`PERMISSION_KEYS` order).
  - A removed phone is stored as `null`.
- **No secrets in the log.** Passwords, password hashes, session tokens, and
  reset tokens are never written to `oldValue` or `newValue`.
- **Admin audit log page.** `/audit-log`, ADMIN role only. Newest first, 50
  entries per page, with previous and next links. Columns: time, user, action,
  affected record, changes.
- **Sidebar item.** "Audit Log" in the System group, shown only to an ADMIN.
- **English and Arabic text**, RTL-safe layout, and light and dark themes for
  everything above.

### States on the audit log page

- **Happy:** a table of entries, newest first, with the page number and
  previous/next links.
- **Empty:** "No activity recorded yet." in place of the table.
- **Invalid page number:** a missing, non-numeric, or below-1 `?page` shows
  page 1; a page past the end shows the last page.
- **Denied:** a signed-out visitor goes to `/login`; a signed-in Supervisor or
  Staff user goes to `/forbidden`. No audit data is queried for them.
- **Unexpected error:** the existing `app/(app)/error.tsx` boundary.
- **Loading:** the page is server-rendered like `/employees`; no separate
  loading screen is added.

## Out of scope

- Entries for invoices, expenses, salon settings, share percentage, employee
  create/edit/activate, services, and settlements. Each of those features
  writes its own entries.
- Failed sign-in attempts and password reset requests (see Decisions).
- Storing IP address or device with an entry. The overview's `AuditLog` has no
  such field.
- Search, filters (by user, action, or date), sorting, and export on the audit
  log page (see Decisions).
- A grantable `audit` permission. The overview gives audit logs to ADMIN only;
  the permission catalog from feature 3 stays unchanged.
- Editing, deleting, or expiring audit entries; database triggers that block
  updates. Append-only is enforced by the app having no update or delete path.
- A per-record history view (for example on an employee or invoice page).

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: build all steps in order, run each step's checks as you go, then
present one review packet for the whole feature. Do not commit between steps.
`/complete` creates the final feature commit.

## Build steps

- [x] **1. `AuditLog` model, migration, and write helper.**
  Add the model to `prisma/schema.prisma` and the back-relation on `User`.
  Create the migration with `pnpm exec prisma migrate dev --name audit_log`.
  Add `lib/audit.ts` with the action catalog, the entity list, the
  `AuditEntry` type, and `recordAudit`. Add `lib/audit.test.ts`.
  **Done when:** `pnpm exec prisma validate` and
  `pnpm exec prisma migrate status` report the schema valid and migrations in
  sync; `pnpm test` passes with tests showing `recordAudit` calls
  `auditLog.create` on the given client with exactly the entry's fields, omits
  `oldValue`/`newValue` when not given, and returns the create operation
  itself. If the database in `.env` cannot be reached, stop and report it; do
  not hand-write the migration.

- [x] **2. Audit entries from authentication actions.**
  In `actions/auth.ts`: `login` saves `lastLoginAt` and the `auth.login` entry
  in one transaction, before `createSession`; `changePassword` and
  `resetPassword` add their entry to their existing transaction array; `logout`
  reads the current session and, when there is one, writes `auth.logout` before
  deleting the session. A failed logout entry is logged with `console.error`
  and never stops the sign-out. Update `actions/auth.test.ts`.
  **Done when:** `pnpm test` passes with tests showing each of the four actions
  writes one entry with the right acting user, action, entity, and entity id;
  a wrong password, inactive account, rate-limited attempt, invalid reset
  token, and wrong current password write no entry; logout still deletes the
  session and redirects when the audit write throws; no entry contains a
  password, hash, or token.

- [x] **3. Audit entries from profile and permission updates.**
  `updateProfile` (`actions/account.ts`) reads the stored name and phone,
  and when something differs saves the update and a `user.profile_updated`
  entry in one transaction with only the changed fields. `updateUserPermissions`
  (`actions/permissions.ts`) adds a `permissions.updated` entry to its existing
  transaction with the full list before and after. Update both test files.
  **Done when:** `pnpm test` passes with tests showing: a name change records
  only `name` before and after; an unchanged profile save writes no entry and
  still returns success; a permission change records before and after lists in
  catalog order in the same `$transaction` call as the two permission writes; a
  no-change, forbidden, not-found, or invalid permission save writes no entry.

- [x] **4. Admin audit log page and sidebar item.**
  Add `adminOnly` to `NavItem`, give `visibleNavKeys` the user's role, and add
  the `auditLog` item (`/audit-log`) to the System group. Add
  `app/(app)/audit-log/page.tsx`: require a session, redirect a non-ADMIN to
  `/forbidden` before any query, count entries, resolve the page, load 50
  entries with the acting user's name and username, and resolve the names of
  `User` entities in one query. Add the pure helpers `resolvePage` and
  `auditChanges` to `lib/audit.ts`. Add the `audit` and `nav.auditLog` keys to
  both locale files. Confirm `proxy.ts` treats `/audit-log` as a protected
  route like the other `(app)` pages.
  **Done when:** `pnpm test` passes with tests for `resolvePage` (missing,
  non-numeric, zero, negative, past the end, zero entries), `auditChanges`
  (strings, arrays, `null`, added and removed fields, both values empty), the
  admin-only nav item (ADMIN sees it; a Supervisor holding every permission
  does not), and every catalog action and entity having a label in both
  `locales/en.json` and `locales/ar.json`; `pnpm exec tsc --noEmit`,
  `pnpm lint`, and `pnpm build` pass; in the running app an ADMIN sees entries
  from steps 2 and 3 at `/audit-log` in English and Arabic, and a Staff user
  opening `/audit-log` lands on `/forbidden`.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_audit_log/` - new model
- `lib/audit.ts`, `lib/audit.test.ts` - new: catalog, `recordAudit`,
  `resolvePage`, `auditChanges`
- `actions/auth.ts`, `actions/auth.test.ts` - entries for sign-in, sign-out,
  password change, password reset
- `actions/account.ts`, `actions/account.test.ts` - profile entry
- `actions/permissions.ts`, `actions/permissions.test.ts` - permission entry
- `lib/navigation.ts`, `lib/navigation.test.ts`, `app/(app)/layout.tsx` -
  admin-only nav item; the layout passes `user.role` to `visibleNavKeys`
- `app/(app)/audit-log/page.tsx` - new admin page (Server Component)
- `locales/en.json`, `locales/ar.json` - `nav.auditLog`, `audit.*`
- `proxy.ts` - only if its protected-route list needs the new path

## Data / contracts

```prisma
/// Append-only: rows are inserted and never updated or deleted.
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  action    String
  entity    String
  entityId  String
  oldValue  Json?
  newValue  Json?
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([userId])
}
```

- **`onDelete: Restrict` (decided here).** The overview makes `userId` a
  required link to `User`, and an audit entry must outlive the change it
  describes. A user who has acted in the system therefore cannot be
  hard-deleted; feature 6 deactivates such a user instead.
- `entityId` is a plain string, not a foreign key, so it can point at any model.
- `action` is one of the catalog strings; `entity` is a Prisma model name
  (`"User"` in this feature).
- `oldValue` / `newValue` are a flat JSON object of field name to value, or
  database `NULL` when there is nothing to record. Omit the property in the
  Prisma `data` to store `NULL`.

```ts
// lib/audit.ts
export const AUDIT_ACTIONS = [
  "auth.login", "auth.logout", "auth.password_changed", "auth.password_reset",
  "user.profile_updated", "permissions.updated",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = ["User"] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export interface AuditEntry {
  userId: string;          // the acting user, always from the server session or the verified account
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  oldValue?: Prisma.InputJsonObject;
  newValue?: Prisma.InputJsonObject;
}

/** Not `async`: returns the Prisma operation so it can go in a `$transaction` array. */
export function recordAudit(entry: AuditEntry, client: Pick<typeof db, "auditLog"> = db);

export const AUDIT_PAGE_SIZE = 50;
export function resolvePage(raw: string | string[] | undefined, totalPages: number): number;

export interface AuditChange { field: string; before: string | null; after: string | null }
export function auditChanges(oldValue: unknown, newValue: unknown): AuditChange[];
```

- **Trusted actor.** `userId` comes only from `requireSession()` /
  `getCurrentSession()`, or, for `auth.login` and `auth.password_reset`, from
  the account the server just verified by password or reset token. Never from
  form data.
- **Page query.** `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`,
  `skip: (page - 1) * 50`, `take: 50`. URL shape: `/audit-log?page=N`, with
  page 1 linked as `/audit-log`.
- **`auditChanges`.** One item per field present in either value, old value's
  fields first. A string is shown as is; an array is joined with `", "`;
  `null` or a missing field is `null`; anything else is `JSON.stringify`.
  Returns `[]` when both values are empty.
- **Translation keys.** `nav.auditLog`; `audit.title`, `audit.description`,
  `audit.empty`, `audit.columns.{time,user,action,record,changes}`,
  `audit.actions.<group>.<name>` (nested like `permissions.keys`),
  `audit.entities.User`, `audit.fields.{name,phone,permissions}`,
  `audit.viewChanges`, `audit.noChanges`, `audit.before`, `audit.after`,
  `audit.pagination.{label,previous,next,page}`.

## Testing

Test command: `pnpm test` (Vitest, `node` environment, `vi.mock` for Prisma and
auth). No `Verify` command and no `Browser tests` command exist, so the page
itself is checked in the running app in step 4, not by an automated browser
test.

- `lib/audit.test.ts` - `recordAudit`, `resolvePage`, `auditChanges`, and the
  locale-label check for every action and entity.
- `actions/auth.test.ts`, `actions/account.test.ts`,
  `actions/permissions.test.ts` - entries written on success, nothing written
  on each failure path, transaction contents, no secrets.
- `lib/navigation.test.ts` - the admin-only item, plus the existing cases with
  the new role argument.

Each action test's `db` mock needs `auditLog: { create: vi.fn() }`. The
existing permission test that asserts the exact `$transaction` array must
expect the audit operation as its third element.

## Notes for the AI

- `recordAudit` must not be `async`. An `async` wrapper turns the Prisma
  operation into a plain promise, and `db.$transaction([...])` rejects it.
- Keep the existing `db.$transaction([...])` array style in the actions; do not
  convert them to interactive transactions.
- `login`: put `db.user.update({ lastLoginAt })` and the audit entry in one
  transaction, then call `createSession`. Keep the rate-limit, dummy-password,
  and inactive-account order exactly as it is.
- `logout`: `getCurrentSession()` first, then a `try/catch` around the audit
  write, then `deleteCurrentSession()` and the redirect, unchanged.
- `updateProfile`: compare against the stored row, not the session user (the
  session has no phone). The parsed phone may be `null`; store it as `null` in
  the entry.
- On the page, do the role check before any `db` call:
  `const { user } = await requireSession(); if (user.role !== "ADMIN") redirect("/forbidden");`
- Render every logged value as React text. No `dangerouslySetInnerHTML`. Names
  and other free text get `dir="auto"`; usernames, ids, and permission keys get
  `dir="ltr"`, as on `/employees`.
- Follow the `/employees` table markup: `scope="col"` headers, `text-start`,
  `overflow-x-auto` wrapper with `min-w-0` on the card. Use `LocalDateTime`
  with `timeStyle="short"` for the time.
- The changes cell uses a native `<details>` with `audit.viewChanges` as its
  summary, so the page needs no client component. Show `audit.noChanges` when
  `auditChanges` returns `[]`. Label a field with `audit.fields.<field>` when
  `t.has()` finds it, otherwise show the raw field name.
- For a `User` entity, show the user's name; if that user no longer exists,
  show the id.
- Pagination is a `<nav aria-label>` with links; on the first or last page the
  unavailable direction is plain text with `aria-disabled="true"`, not a link.
  Use logical spacing utilities so it mirrors in Arabic.
- Sidebar icon: `ScrollText` from `lucide-react`.
- Add every new key to both locale files with the same key set.

## Decisions (approved at spec review)

1. **Failed sign-ins are not logged.** A failed attempt for an unknown
   username has no acting user, which the `AuditLog` model requires, and the
   existing rate limiter already handles guessing.
2. **No filters on the audit log page, only paging.** Filtering by user,
   action, or date range is not in the plan line.
3. **Users with audit history cannot be hard-deleted** (`onDelete: Restrict`).
   This shapes feature 6: an employee who has ever signed in can be
   deactivated but not deleted.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16325,"specSha256":"2f97854138b25d34105125918bd03d008724726980966593f449d3a633dd1cec","branch":"refs/heads/feature/audit-logging","head":"10cb700d48a9f32dc0571c4461e68ed5e262d537","baseRef":"refs/heads/main","baseCommit":"28f1a22940e6f909a7f001cd50748f0f0e788f35","sourceTree":"1b47e2b6b5142c695d5bf0fa226410c20f9a2b6e","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 10cb700d48a9f32dc0571c4461e68ed5e262d537
**Base commit:** 28f1a22940e6f909a7f001cd50748f0f0e788f35
**Base ref:** main
**Spec hash:** 2f97854138b25d34105125918bd03d008724726980966593f449d3a633dd1cec
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T13:15:20Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T13:21:35Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `28f1a22940e6f909a7f001cd50748f0f0e788f35..10cb700d48a9f32dc0571c4461e68ed5e262d537` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main <target>`, `git status --porcelain --untracked-files=all`, SHA-256 of `blueprint/context/current-feature.md`: pass (HEAD equals the target, `main` still gives the recorded merge base, the spec hash matches, only `blueprint/context/review.md` differed from the target before this review wrote the ledger)
- `pnpm exec prisma validate`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (14 files, 128 tests)
- `pnpm build`: pass (`/audit-log` built as a dynamic route)
- `pnpm exec prisma migrate status`: unavailable (not run; it connects to the hosted database, which this review did not have approval to reach)
- Browser tests: unavailable (no `Browser tests` command is declared in `AGENTS.md`)

## Evidence

- Delta reviewed in full: 17 files, `28f1a22..10cb700` (actions, `lib/audit.ts`, `lib/navigation.ts`, the audit log page, the layout, both locale files, the Prisma schema and migration, the spec, and all five test files), plus the callers and helpers they touch (`lib/auth/current-user.ts`, `lib/auth/session.ts`, `lib/auth/validation.ts`, `lib/db.ts`, `proxy.ts`, `components/layout/SidebarNav.tsx`, `components/layout/LocalDateTime.tsx`, `app/(app)/employees/page.tsx`).
- Security: `app/(app)/audit-log/page.tsx:24-25` calls `requireSession()` and redirects a non-ADMIN to `/forbidden` before the first `db` call on line 27. Every `recordAudit` call takes `userId` from the session or from the account the server just verified, never from form data. No entry carries `oldValue` or `newValue` for the four auth actions, and the auth tests assert the exact entry fields. Logged values are rendered as React text; the delta has no `dangerouslySetInnerHTML`.
- Transactions: login, password change, password reset, profile update, and permission update each put the audit insert in the same `db.$transaction([...])` array as the change. Logout writes its entry inside a `try/catch` and still deletes the session when the write fails (`actions/auth.ts:177-190`).
- Migration: `prisma/migrations/20261001130146_audit_log/migration.sql` matches the `AuditLog` model by inspection (columns, both indexes, `ON DELETE RESTRICT`). No code path deletes a `User` row.
- Performance: the page runs one count, one 50-row query ordered by `createdAt` then `id`, and one name lookup for the `User` ids on that page. No per-row queries.
- Tests: no skipped, focused, or placeholder tests in the test files. Both locale files hold the same key set, and every catalog action and entity has a label in each.
- Scans of the added lines found no `any` type, no lint or type suppression, and no em dash, ellipsis, or invisible format character.

## Findings

- F-21 [P3] open: audit before and after values are read outside the transaction that writes them (`actions/permissions.ts:41`, `actions/account.ts:43`). Does not block.
- No P0, P1, or P2 findings.
- F-20 [P3] open is carried forward from earlier work. It is outside this delta and was not re-examined. Does not block.

## Remaining risk

- `pnpm exec prisma migrate status` was not run, so this review did not confirm that the database in `.env` has the `audit_log` migration applied. Sign-in now writes to `AuditLog` in its transaction, so a database without that migration would refuse every sign-in. Run `pnpm exec prisma migrate status` locally and `pnpm exec prisma migrate deploy` before the production app starts.
- No browser check was run: Check was not required and no `Browser tests` command exists. The ADMIN gate, paging, the empty state, Arabic and RTL layout, and the dark theme on `/audit-log` were reviewed by reading the code and by the build only. The page has no unit test, as the coding standards exempt UI.
- The audit log has no expiry and the page counts all rows on each load with offset paging. This is fine at the current size and is in line with the spec; it is not measured.
