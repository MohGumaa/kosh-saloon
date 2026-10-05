# Kosh CRM - Project Overview

<!-- blueprint:source-hash fecffb1092b42729f055039b2b9f8cd0d9be18090b343ac27552ae8af43e57da -->

> Salon management and financial CRM for Kosh Salon: employees, services,
> invoices, expenses, employee earnings, monthly settlements, reports,
> permissions, and settings, in English and Arabic.

## Problem

Kosh Salon has no central system for daily operations and money. The CRM must
answer: how much the salon made, what is paid vs unpaid, how much each employee
generated and earns, what each employee took as advances, what each employee is
owed at month end, what the salon spent, which services and employees bring the
most revenue, and who changed a financial record.

## Users

Three roles. Roles give default permissions; an Admin can grant or remove
individual permissions for Supervisor and Staff users.

| Role | Access |
| --- | --- |
| **ADMIN** | All permissions, always: users, roles, permissions, services, invoices, all expenses, settlements, all reports, settings (incl. global and per-employee share %, currency, tax), audit logs. |
| **SUPERVISOR** | Default: `employees.view`, `services.view`, `invoices.{view,create,edit,change_status}`, `expenses.{view,create}`, `employee_expenses.{view,create}`, `reports.{view,view_all_employees}`, `settlements.{view,create}`. Approving or paying settlements, settings, and permission management must be granted explicitly. Never admin accounts or role management by default. |
| **STAFF** | Default: `services.view`, `invoices.create` and `invoices.view` (own only), `reports.view_own_performance`, `settlements.view` (own only). Creates invoices only for themselves, as Paid or Unpaid; cannot edit, change status, or cancel afterwards. No salon-wide financials or other employees' data. |

## Usage model

- **Tenancy:** one salon (Kosh). Multi-branch is explicitly a future feature.
- **Trust:** every sensitive operation is authorized on the server; hiding a
  button is not security. No sensitive data in client code.
- **Auth:** hashed passwords (never plaintext), secure sessions and cookies,
  protected routes, inactive accounts blocked, rate limiting where necessary.
- **Financial integrity:** invoices are cancelled, never deleted. Paid
  settlements are locked; corrections are signed adjustments applied to the
  next settlement.
- **Audit:** important financial, security, and user changes are logged with
  the acting user, old/new value, and timestamp, from feature 4 onward.
- **Email (V1):** only password reset and login notifications.
- **Secrets:** never committed to Git.

## Core business rules

- Share percentage is a global setting (`employeeSharePercentage`), default
  **50%**, never hard-coded. A change applies to new calculations only.
- An ADMIN may set an optional per-employee share % (0-100). The effective
  `sharePercentage` is the employee's own value when set, otherwise the global
  one. Example: an employee who takes their cut in cash at service time and
  invoices only the salon's portion is set to 0%, so nothing is owed at month
  end. Changes are audited and apply to new calculations only.
- `paidRevenue` = sum of the employee's **PAID** invoices in the period.
  UNPAID invoices show in performance reports only; CANCELLED count nowhere.
- `employeeShare` = `paidRevenue * sharePercentage / 100` (effective %)
- `finalAmount` = `employeeShare - employeeExpenses + adjustments`
- Salon expenses feed salon reports only; they never reduce employee payout.
- **No tax math in V1:** the tax rate and tax ID are stored for future receipts;
  they do not affect invoice amounts, revenue, or payouts.
- Each settlement stores the `sharePercentage` used, so historical settlements
  never change (September at 50% stays 50% after a switch to 60%).
- Settlement flow: `DRAFT` (recalculable) -> `CALCULATED` (frozen for review;
  recalculating returns to DRAFT) -> `APPROVED` (`settlements.approve`) ->
  `PAID` (`settlements.mark_paid`, locked).
- Invoice amount is pre-filled from the service default price and editable at
  creation. Invoice numbers are sequential and unique: `INV-000001`.
- Financial calculations must have automated tests.
- Worked example: paid AED 5,000, 50% -> earnings AED 2,500, expenses AED 300 ->
  final AED 2,200.

## Features

V1, in build-plan order. The core flow (staff invoice -> paid revenue ->
deductions -> monthly settlement -> approval -> payment) is the headline;
features 8 and 10 to 13 carry it. From feature 1 on, every feature ships with
EN/AR text, RTL-safe layout, and theme support; features 22 to 24 are completion
passes.

1. **App shell & foundation** - Prisma + PostgreSQL, shadcn/ui, env vars, layout with sidebar and header, EN/AR + RTL foundation, Light/Dark/System foundation.
2. **Authentication & sessions** - login, logout, password change, password reset by email, login notification emails, sessions, inactive-account block.
3. **Roles & permissions** - three roles, default permissions per role, granular grants, server-side enforcement.
4. **Audit logging** - the audit log every later feature writes to, plus an admin view.
5. **Salon settings** - salon info, logo, currency, tax rate, global share %.
6. **Employee management** - create, edit, activate/deactivate, and view employees, images, roles.
7. **Service management** - EN/AR names, default price, active status.
8. **Invoice & transaction management** - create, view, edit, search, filter, pay, cancel invoices.
9. **Salon expense management** - rent, utilities, supplies, maintenance, marketing, other.
10. **Employee expense management** - advances, withdrawals, personal purchases, other deductions.
11. **Employee revenue & share calculation** - paid revenue x effective share % (optional Admin-set per-employee %, else global) = earnings.
12. **Monthly employee settlements** - revenue, share %, earnings, expenses, adjustments, payout, approval and payment status.
13. **Historical settlement protection** - freeze values, lock paid settlements, corrections via next-month adjustments.
14. **Admin dashboard** - revenue, bills, pending, expenses, staff count, payouts, latest invoices, revenue chart.
15. **Staff personal dashboard** - own revenue, paid/unpaid, share %, earnings, expenses, payout.
16. **Revenue reports** - daily/weekly/monthly/yearly/custom; paid/unpaid; by employee and service.
17. **Expense reports** - salon and employee expenses by category, date range, totals.
18. **Employee performance reports** - services, invoices, revenue, earnings, expenses, payout, trends.
19. **Settlement reports** - monthly settlements with earnings, expenses, share %, approvals, paid status.
20. **Security settings** - settings tab with password change (from 2), login notification preference, session controls.
21. **Notification settings** - settings tab for login notification preferences.
22. **English & Arabic translation completion** - review and fill all translations.
23. **RTL review** - verify and fix LTR/RTL layouts everywhere.
24. **Theme polish** - full Kosh style for all themes, per-user preference.
25. **Responsive CRM experience** - desktop, tablet, mobile.
26. **Financial validation & business rules** - automated tests for revenue, share, expenses, adjustments, payout, status, settlements.
27. **Production deployment & database operations** - PostgreSQL, migrations, env vars, storage, backups, monitoring, Vercel.
28. **Production security & permission testing** - role boundaries, escalation, inactive accounts, unauthorized financial actions.
29. **Production readiness & QA** - E2E, error/loading/empty states, accessibility, performance, final verification.

Out of V1 (future): customers, appointments/calendar, inventory, POS/product
sales, tips, receipt/PDF printing, invoice tax calculation, scheduled report and
settlement emails, WhatsApp/SMS, multi-branch, loyalty/memberships/gift cards,
online booking, advanced analytics, PWA.

## Data model

PostgreSQL via Prisma. Money fields use `Decimal`. All models have `id`
(string/cuid) and, unless noted, `createdAt` / `updatedAt` (DateTime).

### User (employees are users)

- `name` (string), `username` (string, unique), `email` (string, unique)
- `phone` (string?)
- `passwordHash` (string)
- `image` (string?, object-storage URL/key)
- `role` (enum `Role`: ADMIN | SUPERVISOR | STAFF; no Role table)
- `sharePercentage` (Decimal?, 0-100; null = use the global setting; ADMIN-set, audited)
- `isActive` (boolean)
- `language` (enum: EN | AR), `theme` (enum: LIGHT | DARK | SYSTEM)
- `lastLoginAt` (DateTime?)
- has many Invoice (as employee and as creator), EmployeeExpense,
  EmployeeSettlement, SettlementAdjustment, UserPermission, Session, AuditLog

### Session (no updatedAt)

- `tokenHash` (string, unique; the raw token lives only in the secure cookie)
- `userId` -> User, `expiresAt` (DateTime, 7 days), `createdAt`

### Permission / UserPermission

- Permission: `key` (string, unique, e.g. `invoices.change_status`), `name`, `description`
- UserPermission: `userId` -> User, `permissionId` -> Permission (unique pair)
- Keys: `employees.{view,create,edit,delete,activate}`,
  `services.{view,create,edit,delete}`,
  `invoices.{view,create,edit,delete,change_status}`,
  `expenses.{view,create,edit,delete}`,
  `employee_expenses.{view,create,edit,delete}`,
  `reports.{view,view_all_employees,view_own_performance}`,
  `settlements.{view,create,approve,mark_paid}`,
  `settings.{view,edit,security}`, `permissions.manage`

### Service

- `nameEn` (string), `nameAr` (string)
- `defaultPrice` (Decimal), `isActive` (boolean)
- has many Invoice
- Seed data: Hair Color / صبغة, Beard / دقن, Hair Align / قطعية, Haircut / حلاقة
  شعر, Haircut with beard / حلاقة شعر مع دقن, Haircut with beard and hair color /
  حلاقة شعر مع دقن و صبغة (Beard stored once).

### Invoice

- `invoiceNumber` (string, unique, `INV-000001` sequence)
- `employeeId` -> User, `serviceId` -> Service, `createdById` -> User
- `amount` (Decimal, defaults from `Service.defaultPrice`)
- `status` (enum: PAID | UNPAID | CANCELLED; REFUNDED is future)
- Never hard-deleted; cancel instead.

### SalonExpense

- `title` (string), `description` (string?), `category` (enum: RENT |
  ELECTRICITY | WATER | INTERNET | SUPPLIES | EQUIPMENT | MAINTENANCE |
  MARKETING | OTHER), `amount` (Decimal), `date` (Date), `createdById` -> User

### EmployeeExpense

- `employeeId` -> User, `amount` (Decimal), `category` (enum: CASH_ADVANCE |
  ADVANCE_SALARY | WITHDRAWAL | PERSONAL_PURCHASE | OTHER),
  `description` (string?), `date` (Date), `createdById` -> User

### EmployeeSettlement (locks shapes features 12, 13, 15, 19 depend on)

- `employeeId` -> User, `periodStart` / `periodEnd` (Date)
- `totalRevenue`, `sharePercentage`, `employeeShare`, `totalExpenses`,
  `totalAdjustments`, `finalAmount` (all Decimal, frozen at calculation)
- `status` (enum: DRAFT | CALCULATED | APPROVED | PAID)
- `approvedById` -> User?, `approvedAt` (DateTime?), `paidAt` (DateTime?)
- Locked once PAID.

### SettlementAdjustment (no updatedAt)

- `employeeId` -> User, `amount` (Decimal, signed: + adds, - deducts), `reason` (string)
- `sourceSettlementId` -> EmployeeSettlement (the paid one being corrected)
- `appliedSettlementId` -> EmployeeSettlement? (set when included in a later settlement)
- `createdById` -> User, `createdAt`

### SalonSettings (single row)

- `name`, `licenseNumber`, `address`, `phone`, `email`, `taxId` (strings),
  `logo` (string?, storage URL/key)
- `currency` (string, e.g. AED), `taxRate` (Decimal, stored only in V1),
  `employeeSharePercentage` (Decimal, default 50)

### AuditLog (append-only, no updatedAt)

- `userId` -> User, `action` (string), `entity` (string), `entityId` (string)
- `oldValue` / `newValue` (Json?), `createdAt`

## Tech stack

- **Next.js (App Router)** - Server Components, Server Actions for mutations, Route Handlers where needed
- **TypeScript** - strict
- **Tailwind CSS v4 + shadcn/ui** - styling and components
- **Recharts** - dashboard and report charts
- **Prisma Postgres (Vercel integration) + Prisma** - database and ORM via the pg driver adapter; migrations managed
- **Built-in auth** - no auth library: scrypt password hashes, database-backed sessions (random cookie token, hash stored, 7-day expiry)
- **Zod** - input validation
- **next-intl** - translations from `locales/en.json`, `locales/ar.json`; locale kept in a cookie
- **next-themes** - Light/Dark/System switching
- **Vercel Blob** - profile images, salon logo (DB stores URL/key)
- **Resend** - password reset and login notification emails
- **Vercel** - hosting; no reliance on local filesystem storage
- **pnpm** - package manager

## Monetization

Not applicable: an internal tool for Kosh Salon.

## UI/UX

Modern, professional, clean, dark-mode-first, Kosh blue primary, rounded cards,
clear financial numbers, simple tables, high contrast. Existing Kosh screenshots
are the primary visual reference. Dark: navy background, dark cards, light text.
Light: light background, white cards, dark text. Arabic is first-class with full
RTL (sidebar, nav, forms, tables, modals, dropdowns, breadcrumbs, icons, charts,
cards). `EN | AR` switcher; language and theme saved per user. Desktop: sidebar +
content; mobile: header + drawer; tables scroll or become cards; forms stack.

Sidebar (items hidden or disabled by permission): Dashboard; Transactions
(Invoices, Salon Expenses); Employees; Services; Reports (Revenue, Expenses,
Employee Performance, Employee Earnings, Settlements); Settings.

- `/login` - sign in
- `/dashboard` - admin full, supervisor by permission, staff personal
- `/transactions`, `/transactions/new`, `/transactions/[id]` - invoice list (filters: employee, service, status, date range, amount, search), create, detail
- `/employees` - list (image, name, username, email, role, status, revenue)
- `/employees/[id]` - tabs: Overview, Invoices, Performance, Expenses, Account, Permissions
- `/services` - service catalog
- `/expenses` - salon expenses
- `/reports`, `/reports/revenue`, `/reports/expenses`, `/reports/employees`, `/reports/settlements`
- `/settings` - tabs: Information, Financial, Security, Notifications (System, Backup, Printing are future)

## Deployment

- **Host:** Vercel. **Database:** Prisma Postgres (Vercel integration). **Storage:** Vercel Blob. **Email:** Resend.
- **Build/start:** `pnpm build` / `pnpm start`; Prisma migrations run on deploy.
- **Env vars:** `kosh_DATABASE_URL` (prefix injected by the integration),
  `APP_URL` (email link base), `EMAIL_API_KEY`, `EMAIL_FROM`,
  `BLOB_READ_WRITE_TOKEN`; seeding only: `SEED_ADMIN_{NAME,USERNAME,EMAIL,PASSWORD}`.
  No auth secret (sessions are database-backed). `.env.example` lists all.
- No cron jobs in V1 (scheduled emails are future).
- Backups and error monitoring are part of feature 27.

> TODO: health path and domain.

## Open questions

> Minor gaps; none block Feature 1.

- The "Employee Earnings" and "Services" report pages named in plan §29 have no
  dedicated build-plan feature; they are assumed covered by features 16, 18, and 19.
- Session/security controls in feature 20 are not detailed (for example, sign
  out other sessions). Define them in that feature's spec.
