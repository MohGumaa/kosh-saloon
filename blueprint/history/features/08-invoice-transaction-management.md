# Feature: Invoice & transaction management

**From build-plan:** feature 8
**Build attempt:** 1
**Branch:** feature/invoice-transaction-management
**Status:** verified

## Verification

Run on `feature/invoice-transaction-management` after the last step, all passing:

- `pnpm exec prisma migrate dev --name invoices` applied
  `20261004180505_invoices`. `pnpm exec prisma migrate status` reports the
  schema is up to date, and `pnpm exec prisma validate` passes.
- `pnpm exec tsc --noEmit` (no errors) and `pnpm lint` (no warnings).
- `pnpm test` (341 tests; new in `lib/invoices.test.ts` and
  `actions/invoices.test.ts`, plus one in `lib/navigation.test.ts`).
- `pnpm build` (compiled; `/transactions`, `/transactions/new`, and
  `/transactions/[id]` are in the route list).
- Locale key parity: `locales/en.json` and `locales/ar.json` hold the same
  512 keys.

Not run: no browser or dev server was used. The pages, forms, filters, toasts,
RTL layout, and themes are unobserved; the manual check in step 5 did not run.

Differences from the plan above:

- `lib/invoices.ts` also exports `invoiceWhere` (the list query, tested),
  `invoiceListHref` (filter-keeping page links), and `canChangeStatus`.
- `components/invoices/InvoiceStatusBadge.tsx` holds the status pill shared by
  the list and detail pages.
- A `P2002` on create is retried without reading its target: `invoiceNumber`
  is the only unique field an invoice create can collide on.
- The status radios cannot carry `aria-invalid`, so the create form moves
  focus to the first radio itself when the status is the only invalid field.
- A cancelled invoice keeps the status panel, with a final-status note, for
  users who can change status; other viewers see the cancelled note above the
  details. This keeps the status form mounted so its toast shows (F-35).
- Step 6 repairs review findings F-34 and F-35 from the first independent
  review (receipt at `79dbd3e`).
- Open questions 1 to 5 were built with their stated defaults.

## Goal

Let the salon record each service it sells as an invoice. Each invoice belongs
to one employee and one service. Staff create invoices for themselves as Paid
or Unpaid and see only their own. Admins and Supervisors with permission create
invoices for any active employee, see every invoice, search and filter them,
edit them, mark them paid or unpaid, and cancel them. Invoices are never
deleted. Features 11 to 19 will read revenue from these rows.

## In scope

- An `InvoiceStatus` enum and an `Invoice` model and migration, with relations
  to `User` (employee and creator) and `Service`.
- Sequential, unique invoice numbers: `INV-000001`.
- `/transactions`: the invoice list. It has a search box and filters for
  employee, service, status, date range, and amount, and it is paginated.
- `/transactions/new`: the create form. The amount is pre-filled from the
  service's default price and can be changed.
- `/transactions/[id]`: the invoice detail. It also holds the edit form and
  the status controls (mark paid, mark unpaid, and cancel) for users who are
  allowed to use them.
- Server Actions for create, update, and status change. Each one checks the
  permission and the Staff scope on the server, validates its input with Zod,
  and writes its audit entry in the same transaction as the change.
- The sidebar "Invoices" item links to `/transactions`.
- English and Arabic text for every new string, an RTL-safe layout, and both
  themes.

## Out of scope

- Hard delete. `invoices.delete` stays unused, as `services.delete` and
  `employees.delete` do. Cancelling is the only way to remove an invoice from
  revenue.
- Revenue, share, and earnings totals (feature 11), dashboards (14 and 15),
  and reports (16 to 19). The list shows no totals.
- The Invoices tab on `/employees/[id]`. This belongs to the employee
  performance work.
- Tax math (the plan sets no tax in V1), the REFUNDED status, customers,
  multiple services per invoice, discounts, and printing or PDF. These are
  future features.
- Locking invoices that belong to a paid settlement. This is feature 13.

## Build loop

`workflow.stepReview` is `feature`, so implement every step and then present
one review packet for the whole feature. `workflow.checkpointCommits` is
`disabled`, so there are no step commits. `/complete` creates the single
feature commit.

## Build steps

- [x] 1. **Schema, migration, and rules.** Add the `InvoiceStatus` enum and the
  `Invoice` model, plus the back-relations on `User` and `Service` (see Data /
  contracts). Run `pnpm exec prisma migrate dev --name invoices`. Add
  `lib/invoices.ts` with no database import. It holds `invoiceIdSchema`,
  `invoiceSchema`, `formatInvoiceNumber`, `nextInvoiceNumber`,
  `parseInvoiceFilters`, `salonDayRange`, and the scope helpers
  `isOwnScope` and `canManageInvoices`. Reuse `priceSchema` from
  `lib/services.ts` for the amount. Add the five invoice audit actions and
  the `Invoice` entity to `lib/audit.ts`, and add their EN/AR labels under
  `audit.actions`, `audit.entities`, and `audit.fields`. Add
  `lib/invoices.test.ts`.
  _Done when_ `pnpm exec prisma validate` passes and
  `pnpm exec prisma migrate status` reports the schema is up to date. The unit
  tests must cover these cases, and `pnpm test` must pass:
  - Number formatting: `null` gives `INV-000001`, and `INV-000041` gives
    `INV-000042`. Going past `INV-999999` throws.
  - Statuses: `PAID` and `UNPAID` are accepted on create. `CANCELLED`, an
    empty value, and an unknown value are rejected.
  - Amounts: the `priceSchema` cases, including Arabic-Indic digits.
  - Each filter: a valid value and an invalid one, which is dropped. This
    includes a `from` date after `to`, which drops both dates.
  - `salonDayRange("2026-10-04", "2026-10-04")` gives
    `2026-10-03T20:00:00.000Z` up to, but not including,
    `2026-10-04T20:00:00.000Z` for `Asia/Dubai`.
  - The scope helpers, for each role.

  If the database cannot be reached, generate the migration with
  `prisma migrate dev --create-only` only when that works. Otherwise record
  the blocker. Never use `db push`.

- [x] 2. **Server Actions.** Add `actions/invoices.ts` with `createInvoice`,
  `updateInvoice`, and `setInvoiceStatus`, following the
  `actions/services.ts` shape: `requireSession`, then the permission and
  scope check, then `safeParse`, then the write and `recordAudit` in one
  interactive transaction, then `revalidatePath`. Read every stored "before"
  value inside that transaction. Add `actions/invoices.test.ts`. Give the
  transaction callback a separate `tx` mock and assert the writes run on it
  (this closes F-28 for the new file).
  _Done when_ the tests prove each of these cases, and `pnpm test` passes:
  - Without the permission, the result is `forbidden`, with no write and no
    audit row.
  - A STAFF actor's submitted `employeeId` is ignored, and the invoice is
    created for the actor.
  - A STAFF actor gets `forbidden` from update and status change, even when
    they hold `invoices.edit` or `invoices.change_status`.
  - Invalid input returns field errors and the submitted values.
  - An inactive or unknown service or employee returns `not_available` on
    that field when it is newly chosen. An unchanged one is accepted on
    update.
  - The invoice number is the next number. A `P2002` on `invoiceNumber`
    retries up to three times and then returns `unexpected`.
  - An update that changes nothing writes no audit row. An update logs only
    the changed fields.
  - Each allowed status change writes the matching audit action. A change to
    the current status writes nothing.
  - Any write to a cancelled invoice returns `cancelled`. An unknown id
    returns `not_found`. A thrown database error returns `unexpected`.

- [x] 3. **List page and navigation.** Add `app/(app)/transactions/page.tsx`,
  guarded by `requirePermission("invoices.view")`. Add the filter form as a
  plain GET form, so the filters live in the URL (see Data / contracts). Add
  the table, the two empty states, and pagination links that keep the
  filters. Add a "New invoice" link only with `invoices.create`. Set
  `href: "/transactions"` on the `invoices` nav item.
  _Done when_ `pnpm exec tsc --noEmit` and `pnpm build` pass and
  `/transactions` is in the route list. `lib/navigation.test.ts` must assert
  the new href.

- [x] 4. **Create page.** Add `components/invoices/InvoiceFields.tsx` (the
  employee, service, and amount inputs, which the create and edit forms
  share) and `InvoiceCreateForm.tsx`. Add `app/(app)/transactions/new/page.tsx`,
  guarded by `invoices.create`. Choosing a service fills the amount with that
  service's default price. Once the user edits the amount by hand, the
  amount is not overwritten again until they choose a different service.
  After a create succeeds, navigate to `/transactions/[id]` and show a
  success toast.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` pass.

- [x] 5. **Detail, edit, and status.** Add `app/(app)/transactions/[id]/page.tsx`,
  `InvoiceEditForm.tsx`, and `InvoiceStatusForm.tsx`. The page calls
  `notFound()` for an unknown id or an invoice outside the actor's scope.
  _Done when_ `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and
  `pnpm build` pass, and `locales/en.json` and `locales/ar.json` hold the
  same key set. If a dev server and database are available, also check by
  hand, in English and in Arabic:
  - As an admin: create an invoice, filter for it, edit it, mark it paid,
    cancel it, and see each change in `/audit-log`.
  - As a Staff user: create an invoice and confirm that only your own
    invoices are listed.
- [x] 6. **Repair review findings F-34 and F-35.** In `lib/invoices.ts`, build
  the day after `to` with `Date.UTC` overflow instead of slicing an ISO string,
  so `to=9999-12-31` is a valid filter. Render `InvoiceStatusForm` without a
  `key` and also for a cancelled invoice, so its success toast survives the
  refreshed page; the form closes an open cancel confirmation when the stored
  status changes and shows a final-status note when cancelled.
  _Done when_ a `salonDayRange` test for `9999-12-31` passes, and
  `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and `pnpm build` pass.
  The toast itself needs a browser to observe.

## Files / areas

- `prisma/schema.prisma` and a new `prisma/migrations/<timestamp>_invoices/`
- `lib/invoices.ts` and `lib/invoices.test.ts` (new)
- `lib/audit.ts`: the new actions and entity
- `actions/invoices.ts` and `actions/invoices.test.ts` (new)
- `actions/auth.ts`: add `not_available` to `AuthErrorCode`, next to
  `name_taken`, because `FormField` renders field errors from `auth.errors`
- `app/(app)/transactions/page.tsx`, `new/page.tsx`, and `[id]/page.tsx` (new)
- `components/invoices/` (new)
- `lib/navigation.ts` and `lib/navigation.test.ts`
- `locales/en.json` and `locales/ar.json`: a new `invoices` namespace, the
  `auth.errors.not_available` text, and the audit labels

Patterns to follow:

- `actions/services.ts`: form state, `readForm`, `fieldErrorsOf`, the `P2002`
  handling, and transactions.
- `app/(app)/services/page.tsx` and `app/(app)/audit-log/page.tsx`: the table,
  the empty state, and pagination. Reuse `resolvePage` from `lib/audit.ts`.
- `components/services/*` and `components/employees/EmployeeStatusForm.tsx`:
  the forms.
- `components/layout/LocalDateTime.tsx`: dates.
- `components/layout/Panel.tsx`: the detail layout.

## Data / contracts

```prisma
enum InvoiceStatus {
  PAID
  UNPAID
  CANCELLED
}

/// Never deleted: cancel instead. CANCELLED is final.
model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique
  employeeId    String
  employee      User          @relation("InvoiceEmployee", fields: [employeeId], references: [id], onDelete: Restrict)
  serviceId     String
  service       Service       @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  createdById   String
  createdBy     User          @relation("InvoiceCreator", fields: [createdById], references: [id], onDelete: Restrict)
  amount        Decimal       @db.Decimal(10, 2)
  status        InvoiceStatus
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([createdAt])
  @@index([employeeId, createdAt])
  @@index([serviceId])
}
```

Add these back-relations: on `User`, `invoices Invoice[] @relation("InvoiceEmployee")`
and `createdInvoices Invoice[] @relation("InvoiceCreator")`. On `Service`,
add `invoices Invoice[]`. The invoice date is `createdAt`; the plan defines
no separate date field.

**Invoice number:** inside the create transaction, read the highest
`invoiceNumber` (`orderBy: { invoiceNumber: "desc" }`), then write
`nextInvoiceNumber(highest)`. The `@unique` index catches two creates that run
at the same time. On a `P2002` whose target is `invoiceNumber`, rerun the whole
transaction, up to three attempts in total. Numbers have no gaps, because
invoices are never deleted. Six digits keep the string order equal to the
numeric order. Past `INV-999999`, `nextInvoiceNumber` throws, and the action
returns `unexpected`. The number is never read from form data.

**Validation** (`lib/invoices.ts`, run again on the server):

- `employeeId`, `serviceId`, and `id`: `z.string().min(1).max(100)`.
- `amount`: `priceSchema`. It must be greater than 0 and fit
  `Decimal(10, 2)`, and it reaches Prisma as a string.
- `status` on create: `PAID` or `UNPAID` only. It is required and has no
  default; the user must choose.
- `setInvoiceStatus` reads `id` and `status` (`PAID`, `UNPAID`, or
  `CANCELLED`).

**Choosable records:**

- A newly chosen employee must be an active user. Any role counts, because
  admins and supervisors can also serve customers.
- A newly chosen service must be active.
- On update, the invoice's current employee or service is accepted even when
  it is now inactive.
- Otherwise the field error is `not_available`.

**Status rules:**

| From | Allowed to |
| --- | --- |
| UNPAID | PAID, CANCELLED |
| PAID | UNPAID, CANCELLED |
| CANCELLED | none (final; no edit either) |

Every write first checks that the stored status is not `CANCELLED` inside the
transaction, using `updateMany` with `status: { not: "CANCELLED" }` and
checking that its count is 1. A count of 0 returns `cancelled`.

**Authorization and scope.** The trusted actor is always
`requireSession().user`.

| Page or action | Rule |
| --- | --- |
| `/transactions`, `/transactions/[id]` | `invoices.view`. A STAFF actor sees only rows where `employeeId` is their own id. |
| `/transactions/new`, `createInvoice` | `invoices.create`. For a STAFF actor, the server sets `employeeId` to the actor's id, and the form shows their own name instead of a select. |
| Edit form, `updateInvoice` | `invoices.edit`, and the role is not STAFF |
| Status controls, `setInvoiceStatus` | `invoices.change_status`, and the role is not STAFF |

- `isOwnScope(user)` is `role === "STAFF"`.
- `canManageInvoices(user)` is `role !== "STAFF"`.
- A page without its permission redirects to `/forbidden`.
- An invoice outside the actor's scope returns `notFound()` on a page and
  `not_found` from an action, so its existence is not revealed.
- Edit and status controls are rendered only when the actor is allowed to use
  them and the invoice is not cancelled. The server enforces the same rules.

**Action results:**

- The result type is `InvoiceFormState`, which has the same shape as
  `ServiceFormState`.
- The error codes are `forbidden`, `not_found`, `invalid_input`,
  `cancelled`, and `unexpected`, with text under `invoices.errors`.
- The field error codes are `required`, `invalid_input`, and
  `not_available`.
- A failed result returns the submitted `values`.
- `createInvoice` returns `{ success: true, id }`.

**Audit entries** (entity `Invoice`; amounts are logged as strings; Decimals
are compared with `.equals()`):

| Action | Entry |
| --- | --- |
| Create | `invoice.created`, with `newValue` `{ invoiceNumber, employeeId, serviceId, amount, status }` |
| Update | `invoice.updated`, with only the changed fields of `employeeId`, `serviceId`, and `amount`, old and new |
| Mark paid | `invoice.paid`, with `{ status }` old and new |
| Mark unpaid | `invoice.unpaid`, with `{ status }` old and new |
| Cancel | `invoice.cancelled`, with `{ status }` old and new |

**List URL and filters** (`parseInvoiceFilters`):

`/transactions?q=&employee=&service=&status=&from=&to=&min=&max=&page=`

- `q`: trimmed, 1 to 100 characters, and single-line. It matches, without
  case, against the invoice number, the employee's name or username, and the
  service's `nameEn` or `nameAr` (`contains`).
- `employee` and `service`: an id. `employee` is ignored for a STAFF actor.
- `status`: `PAID`, `UNPAID`, or `CANCELLED`. With no status, every status
  is listed, including cancelled invoices, and each status shows its badge.
- `from` and `to`: `YYYY-MM-DD`, both inclusive, as salon calendar days in
  `SALON_TIME_ZONE` (see Open questions). `salonDayRange` gives
  `createdAt >= start of from` and `< start of the day after to`. Either end
  can be given alone.
- `min` and `max`: amounts with the same digit normalization as `priceSchema`,
  where 0 is allowed. Both ends are inclusive.
- An invalid value is dropped and shows as empty in the form. It never errors.

Rows are sorted `createdAt desc`, then `id desc`, 50 per page. The total count
uses the same `where`. A "Clear filters" link goes to `/transactions`.

**List columns:** invoice number (links to the detail page), employee,
service, amount, status, date, and created by. The plan's View, Edit, Cancel,
and Change status actions live on the detail page, which the number links to.

The filter selects list every user and every service, including inactive
ones, because older invoices can name them. The create and edit selects list
only the choosable records, plus the current one on edit.

**Display:**

- Service names use `nameAr` when the locale is `ar` and `nameEn` otherwise.
- Amounts use `Intl.NumberFormat(locale, { style: "currency", currency })`
  inside `dir="ltr"` spans, with the currency from `getSalonSettings()`.
- Invoice numbers and usernames go in `dir="ltr"`.
- Names use `dir="auto"` and render as React text only. Never use
  `dangerouslySetInnerHTML`.
- Dates use `LocalDateTime`.
- Status badges: PAID uses the active badge style, UNPAID uses an amber or
  warning style, and CANCELLED uses the muted style with a line through the
  amount.

**Empty states:**

- With no invoices at all: with `invoices.create`, a prompt to create one;
  without it, a short note.
- With no matches: "No invoices match these filters", plus the Clear filters
  link.
- On the create page with no active services: a note, plus a link to
  `/services/new` when the user has `services.create`. No form is shown.

## Testing

- Unit tests (Vitest) in `lib/invoices.test.ts` and `actions/invoices.test.ts`,
  as listed in steps 1 and 2.
- Regression: `lib/navigation.test.ts`, `lib/audit.test.ts`,
  `lib/services.test.ts`, and the existing action tests must still pass.
- There is no browser harness, so there are no browser tests. Report any
  manual dev-server check as run or not run. Never claim a visual or database
  check that did not run.
- There is no Verify command. The final gate is `pnpm exec tsc --noEmit`,
  `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm exec prisma validate`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` before writing the pages. Check how
  async `params`/`searchParams` and `PageProps<"/transactions/[id]">` work in
  this Next version, and how to navigate after a successful action.
- `salonDayRange` must not add a dependency. Compute the zone's offset for
  the given day with `Intl.DateTimeFormat(..., { timeZone, timeZoneName:
  "longOffset" })` or an equivalent, and take the time zone as a parameter
  so tests can pass it.
- Every form needs these behaviors:
  - Each field has a label associated with its input.
  - A field error is announced through `FormField`.
  - On failure, focus moves to the first error or to the form message
    (`useFocusOnError`).
  - Errors clear when the form is submitted again.
  - The submit button is disabled while pending and shows pending text.
  - Success shows a toast.
  - The status choice on create is a labelled radio group, not two unlabelled
    buttons.
- Cancel needs a second, explicit confirmation step that works from the
  keyboard (for example, a confirm button that appears after the first click,
  plus a way to back out). Do not use `window.confirm`.
- Use the native `<select>` styling that `EmployeeFields` uses for the role.
  Do not add a component library for the select.
- The client gets the service prices for pre-fill as plain strings from the
  server page. Never pass a `Decimal` to a client component.
- Revalidate `/transactions` and `/transactions/[id]` after each write.
- Keep the route as `/transactions/[id]`; do not add an `/edit` segment.
- Use the pending-label style that the existing locales use. F-30 covers the
  ellipsis question for every form; do not change the pattern here.

## Open questions

These have reviewable defaults and do not block step 1. Say if a default is
wrong before `/implement`.

1. **Salon time zone for date filters.** No time zone exists in the project
   yet. The default is a `SALON_TIME_ZONE = "Asia/Dubai"` constant in
   `lib/invoices.ts`, based on the AED currency. It is a fixed constant, not a
   setting. Monthly settlements (feature 12) will need the same day
   boundaries.
2. **Staff and the edit and status permissions.** The plan says only Admin
   and Supervisor users with the permission can edit, change status, or
   cancel. The default enforces the role as well. If an admin ticks
   `invoices.edit` or `invoices.change_status` for a Staff user, it has no
   effect. The alternative is to honour the permission for Staff, limited to
   their own invoices.
3. **Cancel permission.** The default is that cancelling uses
   `invoices.change_status`, so Supervisors can cancel by default.
   `invoices.delete` stays unused. The alternative is to require
   `invoices.delete` for cancel, which Supervisors lack by default.
4. **Cancel is final.** The default is that a cancelled invoice can never be
   edited or restored. The plan does not mention reversing a cancel.
5. **Zero amounts.** The default reuses `priceSchema`, so an amount must be
   greater than 0. A free service cannot be invoiced.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":22613,"specSha256":"f2f153de5df3ac82a7c6ad49dcea51d5cb9d6bb1b2969d090237923b8d2b2f54","branch":"refs/heads/feature/invoice-transaction-management","head":"2bc9764187f17f52df89cc3cd355bbaedf71a2fd","baseRef":"refs/heads/main","baseCommit":"530708a1cf986b95e90b73f89e6bf618d85de234","sourceTree":"f95dbfa1990b5901ed211b9cd5eac2b44f078318","absentOptional":[]} -->

## Findings

### 8/F-34 [P2] closed - A `to` date of 9999-12-31 crashes the invoice list instead of being dropped

**File:** lib/invoices.ts:172
**Found:** 2026-10-04 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says an invalid filter value "is dropped and shows as empty in the form. It never errors." `parseInvoiceFilters` accepts `to=9999-12-31` (a real calendar day that a native date input allows), and `salonDayRange` then computes the day after it with `nextDay`, which slices `toISOString()` to 10 characters. For year 10000 that string is `+010000-01-01T...`, so the slice is `+010000-01`, the day part is `NaN`, `Date.UTC` returns `NaN`, and `Intl.DateTimeFormat.formatToParts` throws `RangeError: Invalid time value`. Reproduced with the real module: `invoiceWhere(parseInvoiceFilters({ to: "9999-12-31" }), admin)` throws that error. `app/(app)/transactions/page.tsx:44` calls `invoiceWhere` with no guard, so `/transactions?to=9999-12-31` renders the error page for any viewer who enters or follows that URL. No data is touched and only that request fails, so this does not block, but it breaks the stated filter contract.
**Suggested fix:** Bound the accepted years in `isCalendarDate` (for example reject a year above 9998, or require a range such as 2000 to 2999), or build the next day from `getUTCFullYear/Month/Date` instead of slicing the ISO string. Add a `parseInvoiceFilters` or `salonDayRange` test for `9999-12-31`. No current requirement is lost.
**Resolution:** Fixed 2026-10-04 on `feature/invoice-transaction-management` (spec step 6). `startOfDay` takes the days to add and lets `Date.UTC` carry an overflowing day into the next year, so the ISO-string `nextDay` is gone and the day after 9999-12-31 is a valid instant. Covered in `lib/invoices.test.ts` (`salonDayRange("9999-12-31", "9999-12-31")`).
2026-10-04 by /audit independent (target `2bc9764`): re-examined, closed. `startOfDay` (`lib/invoices.ts:168` to `:174`) now builds the day with `Date.UTC(year, month - 1, date + addDays)`, so no ISO string is sliced. For `to=9999-12-31` the day after is 10000-01-01T00:00Z and the Dubai bound is `9999-12-31T20:00:00.000Z`, a normal four-digit-year instant that Prisma and PostgreSQL accept. `lib/invoices.test.ts:168` asserts exactly that and passes in `pnpm test`. Checked the other extreme as well: `isCalendarDate` rejects years 0000 to 0099 (`Date.UTC` maps them to 19xx), and for `from=0100-01-01` the second offset pass formats a wall clock still in year 100, so no new defect was found at the low end. `app/(app)/transactions/page.tsx:44` is unchanged and now gets a valid range.

### 8/F-35 [P2] closed - The success toast for mark paid, mark unpaid, and cancel is likely never shown

**File:** components/invoices/InvoiceStatusForm.tsx:23
**Found:** 2026-10-04 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says "Success shows a toast" for every form. `InvoiceStatusForm` shows its toast from `useSuccessToast(state, ...)`, which runs in an effect after the action's successful state commits in that same component instance. The detail page renders it as `<InvoiceStatusForm key={invoice.status} ...>` (`app/(app)/transactions/[id]/page.tsx:166`), and a cancelled invoice renders no status panel at all (`:163`). `setInvoiceStatus` calls `revalidatePath`, so the action response carries the refreshed page: after mark paid or mark unpaid the key changes and React mounts a new instance whose state is `null`, and after cancel the component is removed. If the action state and the refreshed tree commit in the same transition (the usual App Router behavior), the instance that received the success state never commits it and no toast appears. The existing `EmployeeStatusForm` and `ServiceStatusForm` are not keyed and stay mounted, so they do not have this problem. The cancelled note and the changed badge still show the result, so the user is not left without feedback. Derived from the code; no browser was run, so the missing toast is not observed.
**Suggested fix:** Confirm in a browser first. If confirmed, move the toast up to a component that stays mounted (for example a small client wrapper around the status panel and the cancelled note, keyed by nothing), or drop the `key` and reset `confirming` from the action result instead, and for cancel show the toast before the panel disappears (for example from a parent that stays mounted). No current requirement is lost.
**Resolution:** Fixed 2026-10-04 on `feature/invoice-transaction-management` (spec step 6), without the browser confirmation the finding suggested. The detail page renders `InvoiceStatusForm` without a `key`, and for a cancelled invoice too, so the instance that received the success state stays mounted and shows its toast. The form resets the open cancel confirmation itself when the stored status changes, and shows the cancelled note instead of buttons. Only an observed browser run can confirm the toast.
2026-10-04 by /audit independent (target `2bc9764`): re-examined from the code, closed; the toast was not observed in a browser. `app/(app)/transactions/[id]/page.tsx:166` to `:174` renders `<InvoiceStatusForm id status />` with no `key`, and `showStatusPanel` (`:65`) no longer depends on the status, so after mark paid, mark unpaid, or cancel the panel stays in the same child slot (the `canEdit` panel before it becomes `false` in place) and the instance that received the success state stays mounted; `useSuccessToast` then fires on the new state. `InvoiceStatusForm` resets `confirming` with the documented "adjust state on prop change" pattern (`components/invoices/InvoiceStatusForm.tsx:30` to `:35`) and shows the cancelled note instead of buttons when the status is `CANCELLED` (`:53`), so no write control is offered for a cancelled invoice and the server still refuses one (`actions/invoices.ts:250`). No new defect found in the repair.

## Independent review

# Independent Review

**Status:** passed
**Target commit:** 2bc9764187f17f52df89cc3cd355bbaedf71a2fd
**Base commit:** 530708a1cf986b95e90b73f89e6bf618d85de234
**Base ref:** main
**Spec hash:** f2f153de5df3ac82a7c6ad49dcea51d5cb9d6bb1b2969d090237923b8d2b2f54
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T19:21:28Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T19:30:54Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `530708a1cf986b95e90b73f89e6bf618d85de234..2bc9764187f17f52df89cc3cd355bbaedf71a2fd` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `pnpm exec tsc --noEmit`: pass
- `pnpm lint`: pass (no warnings)
- `pnpm test`: pass (23 files, 341 tests)
- `pnpm exec prisma validate`: pass
- `pnpm exec prisma migrate status`: pass (6 migrations, database schema is up to date)
- `pnpm build`: pass (`/transactions`, `/transactions/new`, `/transactions/[id]` in the route list)
- Locale key parity (`locales/en.json` vs `locales/ar.json`, flattened keys): pass (512 and 512, no differences)

## Evidence

- Preconditions: `git rev-parse HEAD` and `git merge-base main HEAD` equal the recorded target and base; SHA-256 of `blueprint/context/current-feature.md` equals the spec hash (tracked spec, no snapshot); `git status --short` shows only `blueprint/context/findings.md` and `blueprint/context/review.md`, before and after the commands ran.
- Delta reviewed in full: 21 files (schema, migration, `lib/invoices.ts`, `actions/invoices.ts`, three pages, five components, audit, navigation, auth error code, locales, and the tests).
- Authorization: every page calls `requirePermission`; list scope comes from `invoiceWhere` (STAFF forced to own `employeeId`, employee filter dropped); detail page returns `notFound()` outside STAFF scope; `updateInvoice` and `setInvoiceStatus` require the permission and a non-STAFF role (`mayManage`); `createInvoice` overwrites a STAFF actor's `employeeId` with the session id before validation.
- Numbering: highest number read and new row written in one interactive transaction, the `@unique` index catches races, P2002 reruns the whole transaction up to three times, overflow past INV-999999 throws inside the try and returns `unexpected`.
- Cancelled is final: both write actions reject a cancelled read inside the transaction and guard the write with `updateMany ... status: { not: "CANCELLED" }` plus a count check; the UI offers no write control for a cancelled invoice.
- Money: `priceSchema` limits amounts to 8 integer and 2 fraction digits (fits `Decimal(10, 2)`), values reach Prisma and the audit log as strings, stored amounts are compared with `.equals()`, and only strings reach client components.
- Filters and dates: invalid filter values are dropped; `salonDayRange` holds for 9999-12-31 and for the low end of accepted years (0100); DST covered by a London test.
- Accessibility and RTL: labelled inputs and selects, radio group in a fieldset with legend, keyboard cancel confirmation with focus return, logical properties, `dir="ltr"` for numbers and amounts, `dir="auto"` for names, no `dangerouslySetInnerHTML`.
- Tests: `lib/invoices.test.ts` and `actions/invoices.test.ts` cover each Done-when case in steps 1, 2, and 6; the action tests use a separate `tx` mock and assert writes and audit inserts on it.
- F-34 and F-35 re-examined against the target code and closed (F-35 judged from code only; the toast was not observed in a browser).

## Findings

- F-34 [P2] closed (repair verified; 9999-12-31 test passes)
- F-35 [P2] closed (repair verified from code; toast not observed in a browser)
- F-36 [P3] unverified (concurrent status changes or edits can log a stale "before" value)
- F-37 [P3] open (create without `invoices.view` lands on `/forbidden` after success)
- No P0 or P1 finding is open or fixed.

## Remaining risk

- No browser or dev server was used (Check not required): pages, filters, toasts (including the F-35 toast), RTL layout, and both themes are unobserved.
- Concurrency behavior (invoice numbering under more than three simultaneous creates, F-36) is derived from code; no concurrent run against a real database.
- Existing P3 entries in this area remain open by their own status: F-28 (older action tests), F-30 (ellipsis pending labels), F-33 (amount input icon and padding sides in Arabic).
