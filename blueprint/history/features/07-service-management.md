# Feature: Service management

**From build-plan:** feature 7
**Build attempt:** 1
**Branch:** feature/service-management
**Status:** verified

## Verification

Run on `feature/service-management` after the last step, all passing:

- `pnpm exec prisma migrate dev --name services` applied
  `20261004161922_services`. `pnpm exec prisma migrate status` reports the
  schema is up to date, and `pnpm exec prisma validate` passes.
- `pnpm exec tsc --noEmit` (no errors) and `pnpm lint` (no warnings).
- `pnpm test` (21 files, 268 tests; 32 new in `lib/services.test.ts` and
  `actions/services.test.ts`, 1 new in `lib/navigation.test.ts`).
- `pnpm build` (compiled; `/services`, `/services/new`, and `/services/[id]`
  are in the route list).
- Locale key parity: `locales/en.json` and `locales/ar.json` hold the same
  418 keys.

Not run: no browser or dev server was used. The pages, forms, toasts, RTL
layout, and themes are unobserved; the manual check in step 4 did not run.

Differences from the plan below:

- `name_taken` lives in `auth.errors` and `AuthErrorCode`, next to
  `username_taken`, not under `services`, because the shared `FormField`
  renders field errors from `auth.errors`.
- `ServiceFormState` is not generic over the field, because all three actions
  share the same three fields.

## Goal

Give the salon one bilingual service catalog. Users with `services.view` see
every service with its English and Arabic names, default price, and status.
Users with `services.create` add services. Users with `services.edit` change
names, prices, and active status. Invoices (feature 8) will pick from active
services and pre-fill the amount from the default price.

## In scope

- A `Service` model and migration: `nameEn`, `nameAr`, `defaultPrice`,
  `isActive`.
- `/services`: the catalog table, visible with `services.view`.
- `/services/new`: the create form, with `services.create`.
- `/services/[id]`: the edit form plus an activate/deactivate control, with
  `services.edit`.
- Server Actions for create, update, and set-active. Each action checks the
  permission and validates input with Zod on the server, and writes its audit
  entry in the same transaction as the change.
- The sidebar "Services" item links to `/services`.
- English and Arabic text for every new string, RTL-safe layout, and both
  themes.

## Out of scope

- Hard delete. A service is deactivated, never deleted, because invoices will
  reference it and are never deleted. `services.delete` stays unused. This
  follows the precedent for `employees.delete` in feature 6.
- Invoices, the service picker, and per-service revenue (features 8 and 16).
- Service categories, durations, images, sort order, and tax. None of these
  are in the plan.
- Seeding the catalog. See Open questions. Until that is answered, an admin
  enters the services through `/services/new`.

## Build loop

`workflow.stepReview` is `feature`, so implement every step, then present one
review packet for the whole feature. `workflow.checkpointCommits` is
`disabled`, so there are no step commits. `/complete` creates the single
feature commit.

## Build steps

- [x] 1. **Schema, migration, and rules.** Add the `Service` model (see Data /
  contracts) and run `pnpm exec prisma migrate dev --name services`. Add
  `lib/services.ts`, with no database import, containing `serviceIdSchema`,
  `serviceSchema` (both names and the price), and the price normalizer. Add
  `service.created`, `service.updated`, `service.activated`, and
  `service.deactivated` to `AUDIT_ACTIONS`, and add `Service` to
  `AUDIT_ENTITIES`. Add their EN/AR labels under `audit.actions`,
  `audit.entities`, and `audit.fields` (`nameEn`, `nameAr`, `defaultPrice`).
  Add `lib/services.test.ts`.
  _Done when_ `pnpm exec prisma validate` passes and
  `pnpm exec prisma migrate status` reports the schema is up to date. Unit
  tests must also cover the trimmed names; the empty, too-long, and multi-line
  names; and the prices `0`, `50`, `50.5`, `50.555`, `-1`, `abc`,
  Arabic-Indic `٥٠٫٥`, and the column maximum. `pnpm test` passes.
  If the database cannot be reached, generate the migration with
  `prisma migrate dev --create-only` only when that works, and otherwise
  record the blocker. Never use `db push`.

- [x] 2. **Server Actions.** Add `actions/services.ts` with `createService`,
  `updateService`, and `setServiceActive`, following the
  `actions/employees.ts` shape: `requireSession`, then `hasPermission`, then
  `safeParse`, then the write and `recordAudit` in one transaction, then
  `revalidatePath("/services")`. Duplicate names return field errors (see
  Data / contracts). A missing service returns `not_found`.
  Add `actions/services.test.ts`, mocking `db` and the session the way
  `actions/employees.test.ts` does.
  _Done when_ the tests prove each of these cases, and `pnpm test` passes:
  - A user without the permission gets `forbidden`, with no write and no
    audit row.
  - Invalid input gets field errors and the submitted values back.
  - A duplicate English or Arabic name gets `name_taken` on that field. This
    includes the case where the unique index rejects the write after a race
    (`P2002`).
  - An update that changes nothing writes no audit row.
  - An update writes only the changed fields to the audit row.
  - Activate and deactivate record the matching action.
  - An unknown id gets `not_found`.
  - A thrown database error gets `unexpected`.

- [x] 3. **Catalog page and navigation.** Add `app/(app)/services/page.tsx`,
  guarded by `requirePermission("services.view")`. The table has these
  columns: English name, Arabic name, default price (formatted with the salon
  currency), and status. A "New service" link appears only with
  `services.create`. The English name links to `/services/[id]` only with
  `services.edit`; otherwise it is plain text. Rows are sorted active first,
  then by English name. If the catalog is empty, the page shows an empty
  state: with `services.create`, a prompt to add a service; without it, a
  short note. Set `href: "/services"` on the nav item in `lib/navigation.ts`.
  _Done when_ `pnpm exec tsc --noEmit` and `pnpm build` pass and `/services`
  appears in the route list. The existing `lib/navigation.test.ts` must still
  pass, with an assertion added that the services item has its href.

- [x] 4. **Create and edit pages.** Add `components/services/ServiceFields.tsx`
  (the inputs both forms share), `ServiceCreateForm.tsx`, `ServiceEditForm.tsx`,
  and `ServiceStatusForm.tsx`. Add `app/(app)/services/new/page.tsx`
  (`services.create`) and `app/(app)/services/[id]/page.tsx` (`services.edit`;
  call `notFound()` for an unknown id). Reuse `FormField`, `FormMessage`,
  `useFocusOnError`, and `useSuccessToast`. After a create succeeds, navigate
  to `/services` and show a success toast.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
  `pnpm build` pass, and `locales/en.json` and `locales/ar.json` hold the same
  key set. If a dev server and database are available, also check by hand:
  create a service, then edit it, then deactivate it, then activate it again,
  then see the change in `/audit-log`. Do this in English and in Arabic.

## Files / areas

- `prisma/schema.prisma` and a new `prisma/migrations/<timestamp>_services/`
- `lib/services.ts` and `lib/services.test.ts` (new)
- `lib/audit.ts`: the new actions and entity
- `actions/services.ts` and `actions/services.test.ts` (new)
- `app/(app)/services/page.tsx`, `app/(app)/services/new/page.tsx`, and
  `app/(app)/services/[id]/page.tsx` (new)
- `components/services/` (new)
- `lib/navigation.ts` and `lib/navigation.test.ts`
- `locales/en.json` and `locales/ar.json`: a new `services` namespace, plus
  the audit labels

Patterns to follow: `actions/employees.ts` (form state, `readForm`, the
uniqueness race in `writeUnlessTaken`, and transactions);
`lib/settings-validation.ts` (`percentageSchema`, which accepts Arabic-Indic
digits); `app/(app)/employees/*` (page layout, table, and links); and
`components/employees/EmployeeStatusForm.tsx`.

## Data / contracts

```prisma
/// A catalog entry. Never deleted: deactivate instead.
model Service {
  id           String   @id @default(cuid())
  nameEn       String   @unique
  nameAr       String   @unique
  defaultPrice Decimal  @db.Decimal(10, 2)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Feature 8 adds the `Invoice` relation.

**Validation** (`lib/services.ts`, run again on the server):

- `nameEn` and `nameAr`: required, trimmed, 1 to 100 characters, and must
  match `SINGLE_LINE_TEXT`. There is no script check: an Arabic name in the
  English field is accepted.
- `defaultPrice`: accept Arabic-Indic digits and `٫`, as `percentageSchema`
  does. The pattern is `^\d{1,8}(\.\d{1,2})?$`, which fits
  `Decimal(10, 2)`. The value must be greater than 0. It is returned in its
  shortest form, so `"50.50"` becomes `"50.5"`. It is passed to Prisma as a
  string; never pass a JavaScript float.
- `id`: `z.string().min(1).max(100)`, as `employeeIdSchema` does.

**Uniqueness:** `nameEn` is unique case-insensitively (Prisma
`mode: "insensitive"`), and `nameAr` is unique on the exact trimmed value.
Both rules count inactive services too. The server checks before writing. The
`@unique` indexes catch races, and a `P2002` is mapped back to the field.
Field error codes are `required`, `invalid_input`, and `name_taken`. Add
`name_taken` to the services translations.

**Action results:** These actions use the `EmployeeFormState` shape, under the
name `ServiceFormState<Field>`. Error codes are `forbidden`, `not_found`,
`invalid_input`, and `unexpected`, with translations under
`services.errors`. A failed result returns the submitted `values`.
`createService` returns `{ success: true, id }`.

**Form fields:** `nameEn`, `nameAr`, and `defaultPrice`, plus a hidden `id`
on update. `setServiceActive` reads `id` and `active` (`"true"` or
`"false"`), the same way `setEmployeeActive` does.

**Authorization:** The trusted actor is always `requireSession().user`.

| Page or action | Permission |
| --- | --- |
| `/services` | `services.view` |
| `/services/new` and `createService` | `services.create` |
| `/services/[id]`, `updateService`, and `setServiceActive` | `services.edit` |

A page without its permission redirects to `/forbidden`. An action without its
permission returns `forbidden`. An ADMIN holds every permission.

**Audit entries:**

| Action | Entry |
| --- | --- |
| Create | `service.created` with `newValue` `{ nameEn, nameAr, defaultPrice }` |
| Update | `service.updated` with only the changed fields, old and new |
| Activate | `service.activated` |
| Deactivate | `service.deactivated` |

Every entry uses entity `Service`. Prices are logged as strings. Decimals are
compared with `.equals()`, so a stored `50` and a submitted `"50.00"` count as
unchanged.

**Display:** Format prices with `Intl.NumberFormat(locale, { style:
"currency", currency })`, where the currency comes from `getSalonSettings()`.
Put prices in `dir="ltr"` spans. Give the `nameAr` input and cell
`dir="rtl"`. Give the `nameEn` input and cell `dir="auto"`. Give the price
input `dir="ltr"`, `inputMode="decimal"`, and `maxLength={11}`. Names render
as React text only; never use `dangerouslySetInnerHTML`. Status uses the
employees badge styles.

## Testing

- Unit tests (Vitest), in `lib/services.test.ts` and
  `actions/services.test.ts`, as listed in steps 1 and 2.
- Regression: the existing `lib/navigation.test.ts` and `lib/audit.test.ts`
  must still pass.
- No browser harness exists, so no browser tests. Any manual dev-server check
  is reported as run or not run. A visual or database check that did not run
  is never claimed.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for any App Router API you are unsure
  of. Read in particular how dynamic `params` work in this Next version
  before writing `[id]/page.tsx`.
- Every form needs these behaviors:
  - Each field has a label associated with its input.
  - A field error is announced through `FormField`.
  - On failure, focus moves to the first error or to the form message
    (`useFocusOnError`).
  - Errors clear when the form is submitted again.
  - The submit button is disabled while pending and shows pending text.
  - Success shows a toast.
- STAFF has `services.view` by default and sees the same catalog. Prices and
  names are not sensitive, so the catalog has no per-user scoping.
- Deactivating changes no other data. Feature 8 decides that inactive
  services cannot be picked for new invoices.
- Keep the routes as `/services/[id]`; do not add a separate `/edit` segment.

## Open questions

- **Seed catalog prices.** The plan lists six services, with Beard stored
  once: Hair Color / صبغة, Beard / دقن, Hair Align / قطعية, Haircut / حلاقة
  شعر, Haircut with beard / حلاقة شعر مع دقن, and Haircut with beard and hair
  color / حلاقة شعر مع دقن و صبغة. The plan gives no default prices, and none
  are invented here. If you provide the prices, a final step will add an
  idempotent upsert, keyed on `nameEn`, to `prisma/seed.ts`. Otherwise
  seeding stays out of scope, and an admin creates the services from the UI.
  This does not block steps 1 to 4.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13379,"specSha256":"2f52a2af520c3c70a6c8f786a3cada4cdca6a685077602af97f4c4208699f7e6","branch":"refs/heads/feature/service-management","head":"40fe099664382d07875aafcd490b4fb20b093ea4","baseRef":"refs/heads/main","baseCommit":"777f4dee41f08b183e2c3a08b9c0bc7d236a4d30","sourceTree":"def75039a46ba0b600afd0e20d975654b981f938","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 40fe099664382d07875aafcd490b4fb20b093ea4
**Base commit:** 777f4dee41f08b183e2c3a08b9c0bc7d236a4d30
**Base ref:** main
**Spec hash:** 2f52a2af520c3c70a6c8f786a3cada4cdca6a685077602af97f4c4208699f7e6
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T16:35:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T16:43:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`: pass (equals target commit)
- `git merge-base main HEAD`: pass (equals base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals spec hash)
- `git status --short`: pass (only `blueprint/context/review.md` differs)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass
- `pnpm test`: pass (21 files, 268 tests)
- `pnpm exec prisma validate`: pass
- `pnpm build`: pass (`/services`, `/services/new`, `/services/[id]` in the route list)
- Locale key parity script (node): pass (418 keys in each locale, no differences)
- `pnpm exec prisma migrate status`: unavailable (not run; needs the remote database)

## Evidence

- Reviewed the full `777f4de..40fe099` diff (20 files): `actions/services.ts`, `actions/services.test.ts`, `actions/auth.ts`, the three `app/(app)/services/` pages, `components/services/*`, `lib/services.ts`, `lib/services.test.ts`, `lib/audit.ts`, `lib/navigation.ts`, `lib/navigation.test.ts`, both locales, `prisma/schema.prisma`, and the `20261004161922_services` migration, against the spec and `blueprint/context/coding-standards.md`.
- Authorization: every action calls `requireSession()` and then `hasPermission` with the spec's key (`services.create`, `services.edit`, `services.edit`) before parsing or any database access; pages use `requirePermission` with `services.view`, `services.create`, and `services.edit`; the actor is always the session user.
- Validation: `serviceSchema` and `serviceIdSchema` run on the server; the price regex `^\d{1,8}(\.\d{1,2})?$` fits `Decimal(10, 2)`, rejects zero, and reaches Prisma as a normalized string; Arabic-Indic digits and the Arabic decimal separator are normalized first.
- Uniqueness: pre-write check (English case-insensitive with a JS re-check, Arabic exact, own id excluded on update) plus `P2002` remapping; see F-32 for the case-insensitive race.
- Audit: create and update write the change and the entry inside one interactive transaction, and update reads the stored row inside that transaction, logs only changed fields as strings, and compares prices with `Decimal.equals`; set-active uses the array transaction and skips a no-op.
- UI: names render as React text only, `dir` attributes match the spec, back links and the edit link respect permissions, and `notFound()` handles an unknown id.
- Ledger context: F-28 and F-30 were re-examined and extended to the new service files; no ledger entry was used as the review checklist.

## Findings

- F-32 [P3] open: case-insensitive English name uniqueness has no database index, so a racing case variant is stored.
- F-33 [P3] open: `FormField` icon and text padding resolve against different directions for the service name and price inputs.
- F-28 [P3] open (updated): the service action tests share the same transaction-client mock gap.
- F-30 [P3] open (updated): three new service pending labels end with U+2026.
- No P0 or P1 findings.

## Remaining risk

- `pnpm exec prisma migrate status` was not run (needs the remote database), so migration sync was not re-confirmed by this reviewer.
- No browser or dev server was used: the pages, forms, toasts, RTL layout, both themes, and F-33's overlap are unobserved.
- No action test runs against a real database, so the `mode: "insensitive"` query, the `P2002` mapping, and the transaction boundaries are proven only through mocks (see F-28).
