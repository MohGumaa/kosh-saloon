# Security and permissions

What each role may do in Kosh CRM, where the server enforces it, which tests
prove it, and the manual checks to run against a production-like deployment.
Hiding a button is never the protection: every page and Server Action checks the
session and permission on the server.

## Roles

| Role | Permissions |
| --- | --- |
| ADMIN | Every key, always (no stored rows). Only role that may assign roles, set an employee's own share %, or open the audit log. |
| SUPERVISOR | Stored list, by default: `employees.view`, `services.view`, `invoices.{view,create,edit,change_status}`, `expenses.{view,create}`, `employee_expenses.{view,create}`, `reports.{view,view_all_employees}`, `settlements.{view,create}`. |
| STAFF | Stored list, by default: `services.view`, `invoices.{view,create}`, `reports.view_own_performance`, `settlements.view`. |

An Admin can grant or remove any key for a Supervisor or Staff user. A user
holding `permissions.manage` can change only keys they hold themselves, never
`permissions.manage`, and only for Supervisor and Staff users other than
themselves.

### Staff limits that grants cannot lift

Whatever keys a Staff user holds, they:

- see and create only their own invoices, and never edit, change status, or
  cancel one;
- never see the salon dashboard, revenue report, or expense report;
- see only their own performance and their own settlements;
- never create, recalculate, approve, pay, or adjust a settlement.

### Explicit grants that are honored as given

Salon expenses, employee expenses, employee accounts, services, and settings
have no own-only scope. If an Admin grants a Staff user one of those keys (for
example `expenses.view` or `employee_expenses.view`), that user sees or changes
every record in that area. This is deliberate (features 06, 09, 10): the Admin's
grant is the decision. Do not grant those keys to Staff unless that is intended.

## Server Action guards

Every exported action calls `requireSession()` before any database access,
except the public sign-in flows (`login`, `requestPasswordReset`,
`resetPassword`) and three session-optional actions (`logout`,
`saveThemePreference`, `setLocale`) that write nothing signed out. The signed-out
sweep in `actions/security.test.ts` discovers every action automatically.

"Staff-never" means refused for STAFF even when holding the key.

| Action | Guard | Tests |
| --- | --- | --- |
| `createInvoice` | `invoices.create`; Staff always invoice themselves, Paid or Unpaid only | `actions/invoices.test.ts` |
| `updateInvoice`, `setInvoiceStatus` | `invoices.edit` / `invoices.change_status`; Staff-never | `actions/invoices.test.ts` |
| `generateSettlements`, `recalculateSettlement`, `markSettlementCalculated` | `settlements.create`; Staff-never | `actions/settlements.test.ts` |
| `approveSettlement` | `settlements.approve`; Staff-never | `actions/settlements.test.ts` |
| `markSettlementPaid`, `createSettlementAdjustment` | `settlements.mark_paid`; Staff-never | `actions/settlements.test.ts` |
| `createExpense`, `updateExpense`, `deleteExpense` | `expenses.create` / `edit` / `delete` | `actions/expenses.test.ts` |
| `createEmployeeExpense`, `updateEmployeeExpense`, `deleteEmployeeExpense` | `employee_expenses.create` / `edit` / `delete` | `actions/employee-expenses.test.ts` |
| `updateSalonInformation`, `updateFinancialSettings`, `updateNotificationSettings`, `updateSalonLogo`, `removeSalonLogo` | `settings.edit` | `actions/settings.test.ts` |
| `setEmployeeShare` | ADMIN only | `actions/employees.test.ts` |
| `createEmployee` | `employees.create`; a non-admin always creates STAFF | `actions/employees.test.ts` |
| `updateEmployee`, `updateEmployeeImage`, `removeEmployeeImage` | `employees.edit`; non-admins reach only other Staff; role change ADMIN-only, never their own | `actions/employees.test.ts` |
| `setEmployeeActive` | `employees.activate`; never their own account | `actions/employees.test.ts` |
| `setEmployeePassword` | `employees.edit`; never their own account | `actions/employees.test.ts` |
| `updateUserPermissions` | rules above; never an ADMIN or themself | `actions/permissions.test.ts` |
| `createService`, `updateService`, `setServiceActive` | `services.create` / `services.edit` | `actions/services.test.ts` |
| `updateProfile` | session; own name and phone only, other fields ignored | `actions/account.test.ts` |
| `changePassword`, `signOutOtherSessions` | session; own account only | `actions/auth.test.ts` |

The role matrix in `lib/security-matrix.test.ts` checks every pure access gate
(dashboard, reports, invoices, settlements, employee accounts, permission
management, navigation) for ADMIN, a default Supervisor, a default Staff user,
a Staff user granted every key, and a Supervisor with no keys.

## Pages

Pages check the same rules: `requirePermission` redirects to `/forbidden`, and a
record outside the viewer's scope returns not found. Staff opening another
employee's invoice (`/transactions/[id]`) or settlement (`/settlements/[id]`) get
not found. `/audit-log` is ADMIN-only. `/api/health` is public and returns only
`ok` or `unavailable`.

## Sessions and accounts

- Passwords are scrypt hashes. Session and reset tokens are random; only their
  SHA-256 hash is stored.
- The session cookie is `httpOnly`, `sameSite=lax`, `secure` in production, and
  expires after 7 days.
- An expired session, or any session of an inactive user, is deleted and
  rejected on its next request. Deactivating a user deletes their sessions and
  reset tokens at once. An inactive user cannot sign in.
- Changing a password ends the user's other sessions; a password reset ends all
  of them.
- Permissions are read per request, so a removed permission applies on the
  user's next request.
- Sign-in and password reset are rate limited and never reveal whether an
  account exists. Redirects after sign-in accept only local paths.
- `proxy.ts` only sends visitors without a session cookie to `/login`; pages and
  actions still validate the session (`proxy.test.ts`).
- Password hashes and tokens are read only in `lib/auth/session.ts`,
  `actions/auth.ts`, and `actions/employees.ts`. Every page and loader query on
  users uses an explicit `select`, and no query loads a related user with
  `include`, so these fields never reach a page or client component (reviewed
  for feature 28).

## Manual checks

Run against a production-like deployment with three accounts: an ADMIN, a
default SUPERVISOR, and a default STAFF user, plus at least one invoice and one
settlement belonging to another employee. Record the date, environment, and
result of each check.

| # | As | Do | Expect | Result |
| --- | --- | --- | --- | --- |
| 1 | Signed out | Open `/dashboard` | Redirected to `/login?next=%2Fdashboard` | |
| 2 | STAFF | Open `/transactions/<another employee's invoice id>` | Not found | |
| 3 | STAFF | Open `/settlements/<another employee's settlement id>` | Not found | |
| 4 | STAFF | Open `/reports/revenue`, `/settings`, `/audit-log`, `/employees` | Access denied page | |
| 5 | SUPERVISOR | Open `/settings` and `/audit-log` | Access denied page | |
| 6 | SUPERVISOR | Open a CALCULATED settlement | No approve or pay action | |
| 7 | ADMIN + STAFF | Sign in as STAFF in one browser; as ADMIN, deactivate that user; reload the STAFF browser | STAFF lands on `/login` | |
| 8 | Deactivated STAFF | Sign in with the correct password | Refused as inactive, no session | |
| 9 | Any | Inspect the session cookie in browser dev tools | `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS | |
