# Feature: Salon settings

**From build-plan:** feature 5
**Build attempt:** 1
**Branch:** feature/salon-settings
**Status:** verified

## Verification

Run on `feature/salon-settings` after the last step, all passing:

- `pnpm exec prisma validate` and `pnpm exec prisma migrate status` (4
  migrations, database up to date)
- `pnpm exec tsc --noEmit`
- `pnpm lint` (no errors, no warnings)
- `pnpm test` (17 files, 173 tests)
- `pnpm build` (`/settings` is in the route list)

Not observed: every running-app check named in steps 3 to 6. No dev server was
started and no browser tool was available, so saving a form, the audit log
entry, the read-only and denied views, Arabic and RTL, both themes, and mobile
width are covered only by the action tests and the build. No
`BLOB_READ_WRITE_TOKEN` is set in `.env`, so no real logo upload was made; the
logo actions are covered by tests with `@vercel/blob` mocked.

## Goal

Give Kosh Salon one place to manage its own details and its global financial
settings: salon name, license number, address, phone, email, tax ID, logo,
currency, tax rate, and the global employee share percentage. The values are
stored in a single `SalonSettings` row, edited at `/settings`, authorized on the
server, and every change is written to the audit log. Later features (11 to 13)
read the share percentage from here instead of hard-coding 50.

## In scope

- `SalonSettings` model (single row) and its migration.
- A server-side reader, `getSalonSettings()`, that later features reuse.
- `/settings` page with two tabs: **Information** (`/settings`) and
  **Financial** (`/settings?tab=financial`).
- Information form: salon name, license number, address, phone, email, tax ID.
- Logo: upload, replace, and remove, stored in Vercel Blob (decided in this
  spec's review; the database stores the public URL).
- Financial form: currency, tax rate, employee share percentage.
- Authorization: `settings.view` opens the page, `settings.edit` saves. A user
  with only `settings.view` sees the values read-only.
- Audit entry for every saved change, in the same transaction as the change.
- The sidebar Settings item links to `/settings`.
- English and Arabic text, RTL-safe layout, light and dark themes.

## Out of scope

- Security and Notifications tabs (features 20 and 21) and the future System,
  Backup, and Printing tabs. Only the two tabs above are rendered.
- Using the settings elsewhere: showing the salon name or logo in the sidebar,
  login page, or emails; formatting amounts with the currency; applying the
  share percentage (feature 11); freezing it on settlements (features 12, 13).
- Any tax calculation. The tax rate and tax ID are stored only.
- Converting existing amounts when the currency changes. It is a label.
- Employee profile images (feature 6 reuses the same storage).
- New permission keys. `settings.security` stays unused until feature 20.
- Image cropping, resizing, or multiple logo variants.

## Build loop

`workflow.stepReview` is `feature` and `workflow.checkpointCommits` is
`disabled`: implement the steps in order without pausing, run each step's check
before moving on, then present one review packet after the last step. No
checkpoint commits. `/complete` creates the final feature commit.

## Build steps

- [x] **1. Model, migration, and reader.** Add `SalonSettings` to
  `prisma/schema.prisma` as defined under Data / contracts and create the
  migration with `pnpm exec prisma migrate dev --name salon_settings`. Add
  `lib/settings.ts` with `SETTINGS_ID` and `getSalonSettings(client = db)`: it
  returns the row and, when the row is missing, creates it with the schema
  defaults using an upsert so two concurrent first reads cannot fail. Add
  `lib/settings.test.ts` (mocked `db`).
  **Done when:** `pnpm exec prisma validate` and `pnpm exec prisma migrate
  status` are clean, `pnpm exec tsc --noEmit` passes, and the tests show the
  reader returns an existing row without writing and creates the row when none
  exists.

- [x] **2. Validation.** Add `lib/settings-validation.ts` with
  `salonInformationSchema`, `financialSettingsSchema`, `LOGO_MAX_BYTES`, and
  `detectImageType(bytes)`, following the rules under Data / contracts. Reuse
  the digit and space normalization that `lib/auth/validation.ts` applies to
  phone numbers by exporting it from there, not by copying it. Add
  `lib/settings-validation.test.ts`.
  **Done when:** `pnpm test` passes with cases for: name required and trimmed;
  optional fields accepting empty input as `""`; email lowercased and an invalid
  email rejected; phone with Arabic-Indic digits normalized; currency
  uppercased and an unknown code rejected; tax rate and share percentage
  accepting `0`, `100`, `12.5`, and Arabic-Indic digits, and rejecting `-1`,
  `100.01`, `12.345`, and non-numeric text; `detectImageType` recognizing PNG,
  JPEG, and WebP and returning `null` for SVG, empty, and truncated input.

- [x] **3. Settings page and Information form.** Add
  `app/(app)/settings/page.tsx` guarded by `requirePermission("settings.view")`,
  with the two-tab navigation in the style of `app/(app)/account/page.tsx`. Add
  `actions/settings.ts` with `updateSalonInformation` and
  `components/settings/InformationForm.tsx`. Add `"settings.updated"` to
  `AUDIT_ACTIONS` and `"SalonSettings"` to `AUDIT_ENTITIES` in `lib/audit.ts`.
  Add `href: "/settings"` to the settings item in `lib/navigation.ts`. Add all
  `settings.*` and new `audit.*` keys to both locale files. Add
  `actions/settings.test.ts`.
  **Done when:** `pnpm test`, `pnpm lint`, and `pnpm exec tsc --noEmit` pass,
  with action tests proving: a user without `settings.edit` gets `forbidden`
  and nothing is written; invalid input returns field errors and the submitted
  values; an unchanged submit writes no update and no audit entry; a changed
  submit writes the update and one audit entry holding only the changed fields,
  inside one transaction; a database error returns `unexpected`. In the running
  app, an Admin saves the Information tab, sees the success toast, and the
  change appears in `/audit-log`.

- [x] **4. Financial form.** Add `updateFinancialSettings` to
  `actions/settings.ts` and `components/settings/FinancialForm.tsx`, shown on
  `/settings?tab=financial`. Show the hints from Data / contracts under the tax
  rate and share percentage fields.
  **Done when:** `pnpm test` passes with the same five action cases as step 3
  for the financial action, plus: submitting `50.0` when `50` is stored counts
  as unchanged, and a changed share percentage is audited with the old and new
  values as decimal strings. In the running app, changing the share percentage
  from 50 to 60 shows in `/audit-log` as before 50, after 60.

- [x] **5. Logo.** Add `@vercel/blob` with pnpm and `BLOB_READ_WRITE_TOKEN` to
  `.env.example`. Add `updateSalonLogo` and `removeSalonLogo` to
  `actions/settings.ts` and `components/settings/LogoForm.tsx` on the
  Information tab (current logo or a placeholder, file input, Upload, Remove).
  Raise the Server Action body limit in `next.config.ts` so a 1 MB file fits
  (the default limit is 1 MB for the whole request) and allow the Blob host for
  `next/image`. **Check first:** confirm the exact config key for the body limit
  and the `images.remotePatterns` shape against the installed Next.js 16.3.8
  docs in `node_modules/next/dist/docs` or its types, and confirm the
  `@vercel/blob` `put` and `del` signatures from the installed package.
  **Done when:** `pnpm test` passes with cases proving: `forbidden` without
  `settings.edit` and no upload; a missing file, a file over `LOGO_MAX_BYTES`,
  and a file whose bytes are not PNG, JPEG, or WebP are each rejected before
  any upload; a missing `BLOB_READ_WRITE_TOKEN` returns `storage_unavailable`;
  a successful upload stores the returned URL, writes one audit entry, and then
  deletes the previous blob; a database failure after upload deletes the new
  blob and returns `unexpected`; remove sets `logo` to null, audits it, and
  deletes the blob. With a real Blob token in `.env`, an Admin uploads, replaces,
  and removes a logo in the running app. Without a token, say so in the review
  packet and do not claim live upload evidence.

- [x] **6. Final pass.** Check the page in English and Arabic (RTL), in light
  and dark themes, at desktop and mobile widths, and as a user holding only
  `settings.view` (read-only, no save or upload controls) and as a user holding
  neither permission (redirected to `/forbidden`, Settings hidden in the
  sidebar).
  **Done when:** `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and
  `pnpm build` all pass, and the review packet states which of the manual
  checks above were actually observed.

## Files / areas

New:

- `prisma/migrations/<timestamp>_salon_settings/migration.sql`
- `lib/settings.ts`, `lib/settings.test.ts`
- `lib/settings-validation.ts`, `lib/settings-validation.test.ts`
- `actions/settings.ts`, `actions/settings.test.ts`
- `app/(app)/settings/page.tsx`
- `components/settings/InformationForm.tsx`, `FinancialForm.tsx`, `LogoForm.tsx`

Changed:

- `prisma/schema.prisma` - the new model
- `lib/audit.ts` - one action, one entity
- `lib/auth/validation.ts` - export the digit and space normalization
- `lib/navigation.ts` (and `lib/navigation.test.ts` if it asserts on links)
- `locales/en.json`, `locales/ar.json` - same key set in both
- `next.config.ts` - Server Action body limit, Blob image host
- `.env.example`, `package.json`, `pnpm-lock.yaml`
- `components/auth/useFocusOnError.ts` - only if its parameter type must widen
  to accept the settings form state; behavior stays the same
- `AGENTS.md` Commands - one line naming `BLOB_READ_WRITE_TOKEN`

Reused as is: `requirePermission`, `hasPermission`, `requireSession`,
`recordAudit`, `FormField`, `FormMessage`, `useSuccessToast`, `Button`, the
`Panel` and tab markup pattern from the account page.

## Data / contracts

### Model

```prisma
/// Single row with id "salon", created with these defaults on first read.
model SalonSettings {
  id                      String   @id @default("salon")
  name                    String   @default("Kosh Salon")
  licenseNumber           String   @default("")
  address                 String   @default("")
  phone                   String   @default("")
  email                   String   @default("")
  taxId                   String   @default("")
  logo                    String?
  currency                String   @default("AED")
  taxRate                 Decimal  @default(0) @db.Decimal(5, 2)
  employeeSharePercentage Decimal  @default(50) @db.Decimal(5, 2)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

The fixed id replaces the usual cuid because there is exactly one row. Optional
text fields store `""` when empty, never null; only `logo` is nullable.

### Validation (server, Zod; the client only mirrors `required` and `maxLength`)

| Field | Rule |
| --- | --- |
| `name` | required, trimmed, 1 to 100 chars, no control characters |
| `licenseNumber` | optional, trimmed, max 50 |
| `address` | optional, trimmed, max 200, single line |
| `phone` | optional, same normalization and character set as the profile phone, max 30 |
| `email` | optional; when present, a valid email, trimmed and lowercased, max 254 |
| `taxId` | optional, trimmed, max 50 |
| `currency` | 3 letters, uppercased, must be in `Intl.supportedValuesOf("currency")` |
| `taxRate` | 0 to 100 inclusive, at most 2 decimal places |
| `employeeSharePercentage` | 0 to 100 inclusive, at most 2 decimal places |

Number inputs accept Arabic-Indic digits and the Arabic decimal separator, which
are normalized before parsing. They are text inputs with `inputMode="decimal"`
and `dir="ltr"`. The page passes Decimal values to client components as strings.

### Logo

- Accepted: PNG, JPEG, WebP. Max `LOGO_MAX_BYTES` = 1 MB. SVG is rejected
  because it can carry script.
- The type is decided by `detectImageType` from the file's leading bytes, never
  from the client-sent MIME type or file name. The upload uses that detected
  content type and a server-chosen path (`salon/logo.<ext>` with a random
  suffix); no client-supplied name or URL is ever stored.
- Order on upload: authorize, validate, upload the new blob, then in one
  transaction update `logo` and write the audit entry, then delete the old blob.
  If the transaction fails, delete the new blob. Blob deletion is best effort:
  a failure is logged with `console.error` and does not fail the action.
- The stored value is the public Blob URL. It is rendered with `next/image`.

### Server Actions (`actions/settings.ts`)

All four start with `requireSession()`, then check
`hasPermission(user, "settings.edit")` before reading form data into a write.
The acting user id comes from the session only.

```ts
type SettingsErrorCode =
  | "forbidden" | "invalid_input" | "unexpected"
  | "file_required" | "file_too_large" | "file_type" | "storage_unavailable";

type SettingsFormState<Field extends string> =
  | { success: true }
  | {
      success: false;
      error: SettingsErrorCode;                                  // settings.errors.*
      fieldErrors?: Partial<Record<Field, "required" | "invalid_input">>; // auth.errors.*
      values?: Record<Field, string>;                            // echoed back on failure
    }
  | null;
```

- `updateSalonInformation(prev, formData)` - the six information fields.
- `updateFinancialSettings(prev, formData)` - the three financial fields.
- `updateSalonLogo(prev, formData)` - one `logo` file.
- `removeSalonLogo(prev, formData)` - no fields.

Each successful action calls `revalidatePath("/settings")`.

### Write and audit

Each save runs in one interactive `db.$transaction`: read the row with
`getSalonSettings(tx)`, compute the changed fields, and only when something
changed, update the row and call `recordAudit(..., tx)`. Decimals are compared
with `Decimal.equals`, so `50.0` equals `50`. Two people saving at once: the
last write wins; there is no optimistic locking.

Audit entry: `action: "settings.updated"`, `entity: "SalonSettings"`,
`entityId: "salon"`, `oldValue` and `newValue` holding only the changed fields.
Decimals are stored as plain decimal strings (`"50"`, `"52.5"`). Keys are the
model field names, except `name` and `phone`, which are recorded as `salonName`
and `salonPhone` because `audit.fields.name` and `audit.fields.phone` already
mean a user's full name and phone. Add `audit.actions.settings.updated`,
`audit.entities.SalonSettings`, and an `audit.fields.*` label for every key in
both locales.

### Page and states

- **Denied:** no `settings.view` redirects to `/forbidden` (existing
  `requirePermission`). An action without `settings.edit` returns `forbidden`,
  shown as a form-level error.
- **Read-only:** with `settings.view` but not `settings.edit`, inputs are
  `readOnly`, there are no submit, upload, or remove controls, and a short note
  explains why.
- **First visit:** the row is created with the defaults; there is no separate
  empty state. With no logo, a placeholder and "No logo uploaded" text show.
- **Pending:** the submit button is disabled and shows the saving label.
- **Invalid:** field errors are linked by `aria-describedby` (existing
  `FormField`), focus moves to the first invalid field, and the submitted values
  are kept. A form-level error uses `FormMessage` (`role="alert"`) and receives
  focus. Errors clear on the next successful submit.
- **Success:** a toast through `useSuccessToast`.
- **Unexpected:** actions return `unexpected` and log with `console.error`; a
  failed page load falls to the existing `app/(app)/error.tsx`.
- **Hints:** share percentage: "Applies to new calculations only. Existing
  settlements keep the percentage they were calculated with." Tax rate: "Stored
  for future receipts. It is not applied to invoices, revenue, or payouts."
  Currency: "Three-letter code, for example AED."
- **Text direction:** salon name and address use `dir="auto"`; license number,
  phone, email, tax ID, currency, and the two numbers use `dir="ltr"`. Stored
  text is rendered through React only, never as HTML.

## Testing

Vitest is configured, so logic steps ship tests in the same diff.

- `lib/settings.test.ts` - reader returns or creates the row.
- `lib/settings-validation.test.ts` - both schemas and `detectImageType`.
- `actions/settings.test.ts` - authorization, validation, no-op, audit, and
  failure paths for all four actions, with `db`, the session, `@vercel/blob`,
  and `next/cache` mocked as in `actions/account.test.ts`.
- `i18n/locales.test.ts` and `lib/navigation.test.ts` must still pass.

Not unit tested: the page and form components. They are verified in the running
app and by `pnpm build`. No Browser tests command is declared, so none is added.
No `Verify` command exists; the final gate is lint, typecheck, test, and build
run separately. No baseline run was made while writing this spec.

## Notes for the AI

- Decisions recorded here, made for this spec: storage provider is Vercel Blob
  (user-approved); tabs use `?tab=` like the account page; `settings.edit`
  covers both tabs including the financial one (the plan says global financial
  settings are controlled through permissions); the single row uses a fixed id.
- Proposed values the plans do not state, open to change in review: the text
  length limits, the 1 MB logo limit and the three accepted image types, the
  default salon name "Kosh Salon", default currency "AED", and default tax
  rate 0. The default share percentage of 50 comes from the plan.
- Do not read `employeeSharePercentage` anywhere except the settings page in
  this feature. Do not add a currency or percentage formatter yet.
- Do not edit `blueprint/context/project-overview.md` or the plans. The
  overview's storage-provider TODO is answered by this spec.
- Follow `actions/account.ts` and `components/account/ProfileForm.tsx` for
  shape and style, including the remount-by-key pattern for Base UI inputs.
- Check that the transaction client type is accepted by `recordAudit`'s
  `client` parameter and by `getSalonSettings`; adjust the parameter types, not
  the call pattern, if it is not.
- No em dashes, en dashes, or ellipsis characters in code comments or docs.
  Existing locale strings use an ellipsis character in "Saving"; match the
  neighbouring strings there.
- No AI attribution in commits.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":18513,"specSha256":"216c739a0fe7a86400066bb876cdb1337c04d0eee50b80a3a86b38ce920da7d4","branch":"refs/heads/feature/salon-settings","head":"afc00a069e0b061e09f46a6d259cbbd35760e030","baseRef":"refs/heads/main","baseCommit":"6564056fc8697e7cbd05551661d23f8d01a3033c","sourceTree":"210a30f8824ac0d04723c761bb4394f8eaae3905","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** afc00a069e0b061e09f46a6d259cbbd35760e030
**Base commit:** 6564056fc8697e7cbd05551661d23f8d01a3033c
**Base ref:** main
**Spec hash:** 216c739a0fe7a86400066bb876cdb1337c04d0eee50b80a3a86b38ce920da7d4
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-01T14:00:12Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-01T14:08:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `6564056fc8697e7cbd05551661d23f8d01a3033c..afc00a069e0b061e09f46a6d259cbbd35760e030` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD equals the target, merge base equals the base, spec hash matches, only `blueprint/context/review.md` differed before this pass)
- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass (no errors, no warnings)
- `pnpm test`: pass (17 files, 173 tests)
- `pnpm exec prisma validate`: pass
- `pnpm build`: pass (`/settings` is in the route list)
- `pnpm exec prisma migrate status`: unavailable (not run; it needs the remote database and this pass was limited to local signals)
- Targeted searches (invisible and banned characters in the changed files, skipped or focused tests, uses of `employeeSharePercentage` and `getSalonSettings`, duplicated panel markup): pass, except the results recorded as F-22 and F-25

## Evidence

- Read every changed file in `6564056..afc00a0` except the lockfile body: `actions/settings.ts`, `lib/settings.ts`, `lib/settings-validation.ts`, `app/(app)/settings/page.tsx`, the three `components/settings/` forms, the three test files, both locale diffs, `next.config.ts`, `lib/audit.ts`, `lib/auth/validation.ts`, `lib/navigation.ts`, `components/auth/useFocusOnError.ts`, the schema and migration, `.env.example`, `AGENTS.md`, `package.json`. The lockfile was checked for the added package list only.
- Followed these unchanged files to verify behavior: `lib/auth/authorize.ts`, `components/auth/FormField.tsx`, `FormMessage.tsx`, `useSuccessToast.ts`, `proxy.ts`, `app/(app)/audit-log/page.tsx`, `app/(app)/account/page.tsx`.
- Security: all four actions call `requireSession()` and then `hasPermission(user, "settings.edit")` before any write or upload; the acting user id comes from the session; only the listed form fields are read; the logo type comes from the file's leading bytes and the stored path and content type are chosen on the server; the page is guarded by `requirePermission("settings.view")`. The `"use server"` file exports only the four actions and types.
- Write and audit: update and audit entry run in one interactive transaction, only changed fields are written and logged, decimals are compared with `Decimal.equals`, and the migration matches the schema model in the spec.
- Installed contracts checked: `experimental.serverActions.bodySizeLimit` and the `remotePatterns` wildcard rules in `node_modules/next/dist/docs`, and the `put` and `del` signatures in `node_modules/@vercel/blob/dist`.
- Byte dump of `lib/auth/validation.ts:57` confirmed raw U+200C and U+200D (F-22).
- Tests: no skipped, focused, or placeholder tests; the action tests cover authorization, validation, no-op, audit content, and failure paths for all four actions with `db`, the session, `@vercel/blob`, and `next/cache` mocked.

## Findings

- F-22 [P3] open - raw invisible joiners in `SINGLE_LINE_TEXT` (regression of the closed F-18)
- F-23 [P3] open - stale error and missing focus in the logo panel
- F-24 [P3] open - image optimizer accepts any Vercel Blob store
- F-25 [P3] open - `Panel` copied from the account page
- F-26 [P3] unverified - overlapping saves can log a stale "before" value and orphan a logo blob
- No P0 or P1 finding is open or fixed. F-20 and F-21 (P3, open, from earlier work) concern files outside this delta and were not re-examined.

## Remaining risk

- `pnpm exec prisma migrate status` was not run in this pass, so migration sync with the database rests on the builder's recorded run.
- No running-app or browser evidence: saving each form, the audit log entry, the read-only and denied views, Arabic and RTL, both themes, and mobile width were not observed by the builder or by this review. No Browser tests command is declared.
- No real Vercel Blob upload was made (`BLOB_READ_WRITE_TOKEN` is not set); upload, replace, remove, and the `next/image` rendering of a stored logo are covered only by mocked tests and the build.
- No dependency or security scanner command is declared; `@vercel/blob` 2.8.0 and its transitive packages were not scanned for known vulnerabilities.
- F-26 was derived from the code and not reproduced against a real database.
