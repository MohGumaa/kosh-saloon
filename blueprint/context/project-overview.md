# Kosh CRM - Project Overview

<!-- blueprint:source-hash c61fca3df057c8c9320b234ee3a86487a1d0c5116213e4c65920021e0628f76a -->

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

Three roles. Roles give default access; per-user granular permissions add control.

| Role | Access |
| --- | --- |
| **ADMIN** | Everything: users, roles, permissions, services, invoices, all expenses, settlements, all reports, settings (incl. global share %, currency, tax), notifications, audit logs. |
| **SUPERVISOR** | Day-to-day operations, permission-controlled: employees, staff accounts, services, invoices, expenses, performance, reports, settlements. Not by default: admin accounts, role management, global permissions, security settings, global financial settings. |
| **STAFF** | Own data only: login/logout, own dashboard and account, view services, create invoices for themselves (cannot pick another employee), own invoices, revenue, performance, deductions, earnings, and monthly settlement. No salon-wide financials, no other employees' data. |

## Usage model

- **Tenancy:** one salon (Kosh). Multi-branch is explicitly a future feature.
- **Trust:** every sensitive operation is authorized on the server; hiding a
  button is not security. No sensitive data in client code.
- **Auth:** hashed passwords (never plaintext), secure sessions and cookies,
  protected routes, inactive accounts blocked, rate limiting where necessary.
- **Financial integrity:** financial records are cancelled or soft-deleted, not
  silently deleted. Paid settlements are locked; corrections go through an
  adjustment/audit mechanism.
- **Audit:** important financial, security, and user changes are logged with
  the acting user, old/new value, and timestamp.
- **Secrets:** never committed to Git.

## Core business rules

- Share percentage is a global setting (`employee_share_percentage`), default
  **50%**, never hard-coded. A change applies to new calculations only.
- `paid_revenue` = sum of eligible **PAID** invoices for the employee in the period.
- `employee_share` = `paid_revenue * share_percentage / 100`
- `final_amount` = `employee_share - employee_expenses`
- Unpaid invoices appear in performance reports (generated revenue) but do not
  normally count toward payout.
- Salon expenses feed salon reports only; they never reduce employee payout.
- Each settlement stores the `share_percentage` used, so historical settlements
  never change (September at 50% stays 50% after a switch to 60%).
- Settlement flow: `DRAFT -> CALCULATED -> APPROVED -> PAID`.
- Financial calculations must have automated tests.
- Worked example: paid AED 5,000, 50% -> earnings AED 2,500, expenses AED 300 ->
  final AED 2,200.

## Features

V1, in build-plan order. The core flow (staff invoice -> paid revenue ->
deductions -> monthly settlement -> approval -> payment) is the headline;
features 5 and 7 to 10 carry it.

1. **Authentication & sessions** - login, logout, password management, sessions, inactive-account block.
2. **Roles & permissions** - ADMIN/SUPERVISOR/STAFF plus granular permissions, enforced server-side.
3. **Employee management** - create, edit, activate/deactivate, and view employee accounts, profiles, images, roles.
4. **Service management** - services with EN/AR names, default price, active status, categories.
5. **Invoice & transaction management** - create, view, edit, search, filter, pay, cancel invoices tied to an employee and service.
6. **Salon expense management** - rent, utilities, supplies, maintenance, marketing, other.
7. **Employee expense management** - advances, withdrawals, personal purchases, other deductions.
8. **Employee revenue & share calculation** - paid revenue x global share % = earnings.
9. **Monthly employee settlements** - revenue, share %, earnings, expenses, final payout, approval and payment status.
10. **Historical settlement protection** - freeze share % and values at calculation time.
11. **Admin dashboard** - revenue, bills, pending, expenses, staff count, payouts, latest invoices, revenue chart.
12. **Staff personal dashboard** - own revenue, paid/unpaid, share %, earnings, expenses, payout.
13. **Revenue reports** - daily/weekly/monthly/yearly/custom; paid/unpaid; by employee and service.
14. **Expense reports** - salon and employee expenses by category, date range, totals.
15. **Employee performance reports** - services, invoices, revenue, earnings, expenses, payout, trends.
16. **Settlement reports** - monthly settlements with earnings, expenses, share %, approvals, paid status.
17. **Salon settings** - salon info, logo, currency, tax rate, global share %.
18. **Security settings** - password change, login notification preference, session/security controls.
19. **Notification settings** - login notifications, daily/weekly/monthly reports, settlement notifications.
20. **Audit logging** - log auth, user, permission, invoice, expense, percentage, settlement changes.
21. **English & Arabic localization** - full translations for all UI.
22. **RTL support** - correct LTR/RTL switching across layout, forms, tables, charts, dialogs.
23. **Theme system** - Light/Dark/System with Kosh style, saved per user.
24. **Responsive CRM experience** - desktop, tablet, mobile.
25. **Financial validation & business rules** - automated tests for revenue, share, expenses, payout, status, tax, settlements.
26. **Production deployment & database operations** - PostgreSQL, migrations, env vars, storage, backups, monitoring, Vercel.
27. **Production security & permission testing** - role boundaries, escalation, inactive accounts, unauthorized financial actions.
28. **Production readiness & QA** - E2E, error/loading/empty states, accessibility, performance, final verification.

Out of V1 (future): customers, appointments/calendar, inventory, POS/product
sales, tips, receipt/PDF printing, automated email/WhatsApp/SMS, multi-branch,
loyalty/memberships/gift cards, online booking, advanced analytics, PWA.

## Data model

PostgreSQL via Prisma. Money fields use `Decimal`. All models have `id`
(string/cuid) and, unless noted, `createdAt` / `updatedAt` (DateTime).

### User (employees are users)

- `name` (string), `username` (string, unique), `email` (string, unique)
- `passwordHash` (string)
- `image` (string?, object-storage URL/key)
- `role` (enum `Role`: ADMIN | SUPERVISOR | STAFF)
- `isActive` (boolean)
- `language` (enum: EN | AR), `theme` (enum: LIGHT | DARK | SYSTEM)
- `lastLoginAt` (DateTime?)
- has many Invoice (as employee and as creator), EmployeeExpense,
  EmployeeSettlement, UserPermission, AuditLog

> TODO: `phone` appears on the employee profile but not in the User model.

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

- `invoiceNumber` (string, unique)
- `employeeId` -> User, `serviceId` -> Service, `createdById` -> User
- `amount` (Decimal)
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

### EmployeeSettlement (locks shapes features 9, 10, 12, 16 depend on)

- `employeeId` -> User, `periodStart` / `periodEnd` (Date)
- `totalRevenue`, `sharePercentage`, `employeeShare`, `totalExpenses`,
  `finalAmount` (all Decimal, frozen at calculation)
- `status` (enum: DRAFT | CALCULATED | APPROVED | PAID)
- `approvedById` -> User?, `approvedAt` (DateTime?), `paidAt` (DateTime?)
- Locked once PAID.

### SalonSettings (single row)

- `name`, `licenseNumber`, `address`, `phone`, `email`, `taxId` (strings),
  `logo` (string?, storage URL/key)
- `currency` (string, e.g. AED), `taxRate` (Decimal),
  `employeeSharePercentage` (Decimal, default 50)

### AuditLog (append-only, no updatedAt)

- `userId` -> User, `action` (string), `entity` (string), `entityId` (string)
- `oldValue` / `newValue` (Json?), `createdAt`

## Tech stack

- **Next.js (App Router)** - Server Components, Server Actions for mutations, Route Handlers where needed
- **TypeScript** - strict
- **Tailwind CSS v4 + shadcn/ui** - styling and components
- **Recharts** - dashboard and report charts
- **PostgreSQL (cloud) + Prisma** - database and ORM; migrations managed
- **Zod** - input validation
- **Translation files** - `locales/en.json`, `locales/ar.json`
- **External object storage** - profile images, salon logo (DB stores URL/key)
- **Vercel** - hosting; no reliance on local filesystem storage
- **pnpm** - package manager

> TODO: auth library, i18n library, storage provider, and email provider are not chosen.

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

- **Host:** Vercel. **Database:** cloud PostgreSQL. **Storage:** external object storage.
- **Build/start:** `pnpm build` / `pnpm start`; Prisma migrations run on deploy.
- **Env vars (names to finalize):** `DATABASE_URL`, `AUTH_SECRET`,
  `STORAGE_URL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `EMAIL_API_KEY`
- Backups and error monitoring are part of feature 26.

> TODO: database host, storage provider, health path, domain, and any cron for scheduled reports.

## Open questions

> Contradictions and gaps between the plans. Resolve them in the plans, then
> re-run /overview.

- **No foundation step.** Plan §66/§75 starts with setup (Prisma, PostgreSQL,
  shadcn/ui, layout shell, sidebar, theme and language switchers); the build
  plan starts at Authentication, which needs the database.
- **Localization/RTL/theme ordering.** §72 says English/Arabic "from the
  beginning" and §75 puts switchers in the first milestone; the build plan puts
  them at 21 to 23.
- **Ordering dependencies.** Feature 8 needs the global share % (feature 17);
  invoices (5) need audit logging (20) per Phase 5.
- **Invoice status.** §12 uses PAID/UNPAID/CANCELLED; §57 uses ACTIVE/CANCELLED.
- **Service categories.** Build plan feature 4 names categories; the Service model has none.
- **Role model.** §46/§48 list a Role table; §47 stores `role` on User. Modeled as an enum here.
- **Tax.** A tax rate setting exists, and feature 25 validates tax, but no plan says how tax applies to invoices or payouts.
- **Notifications vs future scope.** Features 18/19 include email login notifications and scheduled reports; "Automated notifications" is listed as future.
- **Password reset.** §7 lists it; the V1 scope (§65) lists only password change.
- **Default permissions** per role, and whether STAFF can mark their own invoices paid or edit them, are undefined.
- **Invoice amount** vs service default price (override allowed?) and invoice number format are undefined.
- **Settlements:** difference between DRAFT and CALCULATED, and the adjustment mechanism for paid settlements, are undefined.
- **Overlap:** password change appears in features 1 and 18.
