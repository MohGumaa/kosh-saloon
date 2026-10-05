# Kosh CRM — Project Plan

## 1. Project Overview

Kosh CRM is a salon management and financial CRM for managing employees, services, invoices, salon expenses, employee expenses, employee earnings, monthly settlements, reports, permissions, and salon settings.

The system will support:

- Employee management
- Role-based access
- Custom permissions
- Service management
- Invoice/bill management
- Employee revenue tracking
- Employee commission/share percentage
- Employee expenses and deductions
- Monthly employee settlements
- Salon expenses
- Financial reports
- Employee performance reports
- Dashboard analytics
- Salon settings
- English and Arabic
- RTL support
- Light, Dark, and System themes
- Audit logs
- Secure authentication

The application will be hosted on Vercel and use a cloud PostgreSQL database.

---

# 2. Problem

Kosh Salon currently needs a centralized system to manage its daily salon operations and financial information.

The CRM should make it easy to answer:

- How much money did the salon make?
- How much was paid?
- How much is still unpaid?
- How many bills were created?
- How much did each employee generate?
- How much does each employee earn?
- What percentage does each employee receive?
- How much did each employee take as an advance or expense?
- How much should each employee receive at the end of the month?
- How much did the salon spend?
- Which services generate the most revenue?
- Which employees generated the most revenue?
- What are the latest transactions?
- What happened to a financial record and who changed it?

---

# 3. Users

The system has three main roles:

- ADMIN
- SUPERVISOR
- STAFF

---

# 4. Admin

Admin has full access to the CRM.

Admin can:

- Create users
- Edit users
- Delete/deactivate users
- Activate users
- Change name
- Change username
- Change email
- Change password
- Change role
- Upload profile image
- Manage permissions
- Manage employees
- Manage services
- Manage invoices
- Manage salon expenses
- Manage employee expenses
- Manage employee settlements
- View all reports
- Manage system settings
- Change global employee share percentage
- Change currency
- Change tax rate
- Manage notifications
- View audit logs

---

# 5. Supervisor

Supervisor manages day-to-day salon operations.

Supervisor can have permission-controlled access to:

- Employees
- Staff accounts
- Services
- Invoices
- Salon expenses
- Employee expenses
- Employee performance
- Reports
- Employee settlements

Supervisor should not automatically have access to:

- Admin accounts
- Role management
- Global permissions
- Security settings
- Global financial settings

These should be controlled through permissions.

---

# 6. Staff

Staff represents individual salon employees.

Staff can:

- Login
- Logout
- View their own dashboard
- View their account
- View available services
- Create invoices for themselves
- View their own invoices
- View their own revenue
- View their own performance
- View their own expenses/deductions
- View their own employee earnings
- View their own monthly settlement

Staff should not normally be able to:

- View other employees' private information
- View other employees' earnings
- Manage users
- Change global settings
- Manage permissions
- View salon-wide financial information

---

# 7. Authentication

The CRM requires secure authentication.

Each user has:

- id
- name
- username
- email
- phone (optional)
- password
- profile image
- role
- active/inactive status
- language preference
- theme preference
- created date
- updated date
- last login date

Authentication features:

- Login
- Logout
- Change password
- Password reset by email
- Secure sessions
- Protected routes
- Active/inactive accounts
- Login notification emails
- Server-side authorization

Email in V1 is limited to password reset and login notifications. Scheduled
report emails and settlement notifications are future features.

Passwords must never be stored as plain text.

---

# 8. Roles

Roles:

```text
ADMIN
SUPERVISOR
STAFF
```

Roles provide default access.

Permissions provide additional control.

# 9. Permissions

The system should support granular permissions.

Example permissions:

employees.view
employees.create
employees.edit
employees.delete
employees.activate

services.view
services.create
services.edit
services.delete

invoices.view
invoices.create
invoices.edit
invoices.delete
invoices.change_status

expenses.view
expenses.create
expenses.edit
expenses.delete

employee_expenses.view
employee_expenses.create
employee_expenses.edit
employee_expenses.delete

reports.view
reports.view_all_employees
reports.view_own_performance

settlements.view
settlements.create
settlements.approve
settlements.mark_paid

settings.view
settings.edit
settings.security

permissions.manage

Permissions must be checked on the server.

Hiding a button is not enough to provide security.

Default permissions per role (an Admin can grant or remove individual
permissions for Supervisor and Staff users):

ADMIN: all permissions, always.

SUPERVISOR: employees.view, services.view, invoices.view, invoices.create,
invoices.edit, invoices.change_status, expenses.view, expenses.create,
employee_expenses.view, employee_expenses.create, reports.view,
reports.view_all_employees, settlements.view, settlements.create.
settlements.approve, settlements.mark_paid, and settings or permission
management must be granted explicitly by an Admin.

STAFF: services.view, invoices.create (own only), invoices.view (own only),
reports.view_own_performance, settlements.view (own only).

# 10. Employees

Employee management page:

/ employees

Employee list should contain:

Profile image

Name

Username

Email

Role

Status

Revenue

Actions

Employee profile:

/ employees/[id]

Tabs:

Overview
Invoices
Performance
Expenses
Account
Permissions

Employee profile information:

Name

Username

Email

Phone

Image

Role

Status

Created date

Last login

Revenue

Earnings

Expenses

Final payout

# 11. Services

Services currently used by Kosh:

Hair Color
صبغة

Beard
دقن

Hair Align
قطعية

Haircut with beard and hair color
حلاقة شعر مع دقن و صبغة

Haircut with beard
حلاقة شعر مع دقن

Haircut
حلاقة شعر

The duplicated Beard service should normally be stored only once unless Kosh intentionally needs two separate Beard services.

Each service contains:

id
name_en
name_ar
default_price
is_active
created_at
updated_at

Admin can:

Create service

Edit service

Activate service

Deactivate service

Set default price

Delete service where appropriate

# 12. Transactions / Invoices

Transactions are the main billing system.

Each invoice contains:

id
invoice_number
employee_id
service_id
amount
status
created_by
created_at
updated_at

Invoice statuses:

PAID
UNPAID
CANCELLED

Future status:

REFUNDED

Invoices are never permanently deleted. Cancelling sets the status to
CANCELLED. Cancelled invoices do not count toward any revenue.

Invoice numbers are sequential and unique, formatted like INV-000001.

# 13. Create Invoice

Staff creates an invoice for themselves.

The amount is pre-filled from the service's default price and can be changed
when the invoice is created.

Staff choose Paid or Unpaid when creating the invoice. After creation, Staff
cannot edit the invoice, change its status, or cancel it. Only Admin and
Supervisor users with the matching permission can do that.

Example:

Employee
Asim

Service
Haircut

Amount
AED 50

Status
Paid

Staff cannot select another employee.

Admin and Supervisor can create invoices for employees when they have permission.

# 14. Invoice List

Invoice list should contain:

Invoice number

Employee

Service

Amount

Status

Date

Created by

Actions

Actions:

View

Edit

Cancel

Change status

Filters:

Employee

Service

Status

Date range

Amount

Search

Financial records should preferably use cancellation/soft deletion rather than permanent deletion.

# 15. Employee Share Percentage

Kosh employees receive a percentage of their generated revenue.

The default share percentage is:

50%

However, 50% must NOT be hard-coded.

The system must have a global setting:

employee_share_percentage

Example:

Employee Share Percentage
50%

The percentage can be changed globally by an authorized Admin.

# 16. Employee Share Calculation

Employee share:

employee_share =
eligible_paid_revenue \* share_percentage / 100

Example:

Revenue:
AED 5,000

Share:
50%

Employee Share:
AED 2,500

# 17. Employee Expenses

Employees can have deductions/expenses.

Examples:

Cash advance

Advance salary

Employee withdrawal

Personal purchase

Other deduction

Example:

Employee:
Asim

Category:
Cash Advance

Amount:
AED 300

Date:
15 September

Description:
Cash advance

Employee expenses affect the employee's final payout.

# 18. Salon Expenses

    Salon expenses are separate from employee expenses.

Salon expenses can include:

Rent

Electricity

Water

Internet

Supplies

Equipment

Maintenance

Marketing

Other

Salon expenses affect salon financial reports.

They do not automatically reduce an employee's payout.

# 19. Employee Earnings Formula

    The basic calculation is:

# Total Employee Revenue

Sum of eligible paid invoices

Then:

# Employee Share

Total Employee Revenue × Share Percentage / 100

Then:

# Final Employee Payout

Employee Share - Employee Expenses + Adjustments

Adjustments are signed corrections carried over from earlier paid settlements
(see section 57). They are zero in most months.

Example:

Revenue:
AED 5,000

Employee Share:
50%

Employee Earnings:
AED 2,500

Employee Expenses:
AED 300

Final Payout:
AED 2,200

# 20. Paid vs Unpaid Revenue

    Only paid invoices should normally contribute to employee settlement.

Example:

Paid Revenue:
AED 5,000

Unpaid Revenue:
AED 500

Generated Revenue:
AED 5,500

Performance reports can show both.

Settlement calculation should normally use:

AED 5,000

because this is collected revenue.

# 21. Monthly Employee Settlement

    At the end of each month, the system calculates an employee settlement.

Example:

Employee:
Asim

Period:
September 2026

Paid Revenue:
AED 5,000

Share Percentage:
50%

Employee Earnings:
AED 2,500

Employee Expenses:
AED 300

Final Amount:
AED 2,200

Settlement statuses:

DRAFT - created for the period; figures can be recalculated freely.
CALCULATED - figures computed and frozen, ready for review. Recalculating moves it back to DRAFT.
APPROVED - approved by a user with settlements.approve.
PAID - marked paid by a user with settlements.mark_paid; locked.

# 22. Historical Share Percentage

    The global employee share percentage can change.

Example:

September:
50%

October:
60%

September must remain calculated using 50%.

Therefore the settlement must store:

share_percentage

Example:

September

Revenue:
AED 5,000

Share:
50%

Employee Earnings:
AED 2,500

Changing the global percentage later must not change historical settlements.

# 23. Employee Performance

    Staff should have a performance page.

Metrics:

Total services

Total invoices

Paid invoices

Unpaid invoices

Generated revenue

Paid revenue

Average invoice

Share percentage

Employee earnings

Employee expenses

Final payout

Charts:

Revenue over time

Services over time

Revenue by service

Paid vs unpaid

Monthly earnings

# 24. Staff Dashboard

    Staff dashboard should focus only on their own performance.

Example:

Welcome, Asim

This Month

Revenue Generated
AED 5,000

Paid Revenue
AED 4,800

Unpaid
AED 200

Share
50%

Employee Earnings
AED 2,400

Expenses
AED 300

Final Amount
AED 2,100

# 25. Admin Dashboard

    Admin dashboard should contain:

Paid Revenue
Total Bills
Pending Revenue
Salon Expenses
Number of Staff
Employee Share Percentage

Additional cards:

Today's Revenue
Weekly Revenue
Monthly Revenue
Average Bill
Total Services
Employee Payouts

# 26. Revenue Chart

    Dashboard should contain a revenue chart.

Periods:

Today
Last 7 Days
This Week
This Month
Previous Month
Last 12 Months
Custom Range

Charts can show:

Revenue

Paid revenue

Unpaid revenue

Expenses

Employee payouts

Net amount

# 27. Latest Bills

    Dashboard should show latest invoices.

Example:

AED 30 Musab Haircut with beard
AED 10 Asim Beard
AED 30 Di Maria Haircut with beard
AED 50 Asim Haircut

Clicking an invoice opens its details.

# 28. Employee Earnings Overview

    Admin/Supervisor report:

Employee | Revenue | Share % | Earnings | Expenses | Final Payout

Example:

Asim AED 5,000 50% AED 2,500 AED 300 AED 2,200
Musab AED 4,200 50% AED 2,100 AED 150 AED 1,950
Di Maria AED 3,800 50% AED 1,900 AED 200 AED 1,700

# 29. Reports

    Reports section:

Reports

Revenue
Salon Expenses
Employee Performance
Employee Earnings
Employee Expenses
Services
Monthly Settlements

# 30. Revenue Reports

    Revenue reports should show:

Gross revenue

Paid revenue

Unpaid revenue

Revenue by day

Revenue by week

Revenue by month

Revenue by service

Revenue by employee

# 31. Expense Reports

    Expense reports should show:

Total salon expenses

Expenses by category

Expenses by employee

Expenses by date

Employee deductions

# 32. Employee Reports

    Employee reports should show:

Services performed

Number of invoices

Revenue

Paid revenue

Unpaid revenue

Share percentage

Employee earnings

Expenses

Final payout

# 33. Settings

    Settings should be divided into tabs.

Information
Financial
Security
Notifications
System
Backup
Printing

# 34. Information Settings

    Information tab:

Salon Name
License Number
Address
Phone
Email
Tax ID
Logo

# 35. Financial Settings

    Financial settings:

Currency
Tax Rate
Employee Share Percentage

The employee share percentage is global.

Example:

Employee Share:
50%

When changed, it applies to new calculations.

Historical settlements must not change.

The tax rate and tax ID are stored for future receipts and invoices. In V1,
tax is not applied to invoice amounts, revenue, or payouts.

# 36. Security Settings

    Security tab:

Current Password
New Password
Confirm New Password

Security options:

Login notification by email

# 37. Notification Settings

    Notification settings:

Login notifications

Future (not V1): daily report, weekly report, and monthly settlement
notification emails.

# 38. Future Settings

    Future tabs/features:

System
Backup
Printing

System settings may include:

Date format

Timezone

Number format

Language

Backup may include:

Database backup

Export

Restore

Printing may include:

Invoice design

Receipt size

Logo

Footer

Printer settings

# 39. Internationalization

    The system must support:

English
Arabic

Language selector:

EN | AR

The user's selected language should be stored.

# 40. Arabic RTL

    Arabic must use proper RTL layout.

When Arabic is selected:

direction: rtl

The following must adapt:

Sidebar

Navigation

Forms

Tables

Modals

Dropdowns

Breadcrumbs

Buttons

Icons

Charts

Dashboard cards

Arabic is a first-class language, not an afterthought.

# 41. Translation Files

    Use translation files.

Example:

/locales/en.json
/locales/ar.json

English:

{
"dashboard": "Dashboard",
"employees": "Employees",
"services": "Services",
"transactions": "Transactions",
"reports": "Reports",
"settings": "Settings"
}

Arabic:

{
"dashboard": "لوحة التحكم",
"employees": "الموظفون",
"services": "الخدمات",
"transactions": "المعاملات",
"reports": "التقارير",
"settings": "الإعدادات"
}

Avoid hard-coded UI text inside components.

# 42. Theme

    The system must support:

Light
Dark
System

Dark mode should follow the current Kosh screenshots.

Dark theme:

Dark navy background

Dark cards

Kosh blue primary color

Light text

Light theme:

Light background

White cards

Dark text

Kosh blue primary color

System theme follows the operating system.

Theme preference should be saved per user.

# 43. UI Design

    The current screenshots are the primary visual reference.

Design direction:

Modern

Professional

Clean

Dark-mode-first

Blue primary color

Rounded cards

Clear financial numbers

Simple tables

Responsive

High contrast

Minimal unnecessary decoration

# 44. Navigation

    Recommended sidebar:

Dashboard

Transactions
Invoices
Salon Expenses

Employees

Services

Reports
Revenue
Expenses
Employee Performance
Employee Earnings
Settlements

Settings

Navigation items should be hidden or disabled according to permissions.

# 45. Routes

    Main routes:

/login

/dashboard

/transactions
/transactions/new
/transactions/[id]

/employees
/employees/[id]

/services

/expenses

/reports
/reports/revenue
/reports/expenses
/reports/employees
/reports/settlements

/settings

# 46. Database

    The application uses PostgreSQL.

Recommended architecture:

Next.js
|
Prisma
|
PostgreSQL

Core models:

User
Permission
UserPermission

Service

Invoice

SalonExpense
EmployeeExpense

EmployeeSettlement
SettlementAdjustment

SalonSettings

AuditLog

# 47. User Model

    User should contain:

id
name
username
email
phone
password_hash
image
role
is_active
language
theme
created_at
updated_at
last_login_at

# 48. Role Model

    Role is a fixed enum stored on User.role, not a separate table.

Role values:

ADMIN
SUPERVISOR
STAFF

# 49. Permission Model

    Permission:

id
key
name
description

User permissions:

user_id
permission_id

# 50. Service Model

    Service:

id
name_en
name_ar
default_price
is_active
created_at
updated_at

# 51. Invoice Model

    Invoice:

id
invoice_number
employee_id
service_id
amount
status
created_by
created_at
updated_at

# 52. Salon Expense Model

    Salon expense:

id
title
description
category
amount
date
created_by
created_at
updated_at

# 53. Employee Expense Model

    Employee expense:

id
employee_id
amount
category
description
date
created_by
created_at
updated_at

# 54. Employee Settlement Model

    Settlement:

id
employee_id

period_start
period_end

total_revenue

share_percentage
employee_share

total_expenses
total_adjustments
final_amount

status

approved_by
approved_at
paid_at

created_at
updated_at

Settlement adjustment:

id
employee_id
amount (signed: positive adds to payout, negative deducts)
reason
source_settlement_id (the paid settlement being corrected)
applied_settlement_id (the later settlement that includes it; empty until applied)
created_by
created_at

# 55. Salon Settings Model

    Settings:

id
name
license_number
address
phone
email
tax_id
logo

currency
tax_rate
employee_share_percentage

created_at
updated_at

# 56. Audit Log

    Important financial and security actions must be logged.

Audit log:

id
user_id
action
entity
entity_id
old_value
new_value
created_at

Examples:

Admin changed employee role

Admin changed employee share percentage

Admin deactivated employee

Staff created invoice

Supervisor changed invoice status

Admin added employee expense

Admin approved settlement

Admin marked settlement as paid

# 57. Financial Data Integrity

    Financial records should not be silently deleted.

Invoices use the CANCELLED status instead of permanent deletion.

Paid settlements should be locked.

Settlement flow:

DRAFT
↓
CALCULATED
↓
APPROVED
↓
PAID

Once paid, the settlement should not be silently modified.

Corrections to a paid settlement never edit it. An authorized user records a
settlement adjustment (signed amount and reason). The adjustment is added to
the employee's next settlement and written to the audit log.

# 58. Tech Stack

    Frontend:

Next.js
TypeScript
Tailwind CSS
shadcn/ui
Recharts

Backend:

Next.js Server Actions
Next.js Route Handlers
Server Components

Database:

PostgreSQL

ORM:

Prisma

Validation:

Zod

Hosting:

Vercel

Chosen providers and libraries:

Database host: Prisma Postgres through the Vercel integration (Prisma pg driver adapter)

Authentication: built in, no auth library - scrypt password hashes and database-backed sessions (random token in a secure cookie, only its hash stored, 7-day expiry)

Internationalization: next-intl, with the locale stored in a cookie

Themes: next-themes

File storage: Vercel Blob

Email: Resend

# 59. Vercel Architecture

    Production architecture:

Browser
|
v
Vercel
|
v
Next.js Application
|
+-------------------+
| |
Server Actions Route Handlers
| |
+---------+---------+
|
v
Prisma
|
v
PostgreSQL

The application must not rely on local server filesystem storage.

# 60. File Storage

    Profile images and salon logos should use external object storage.

Store:

Employee profile images

Salon logo

Future invoice PDFs

Future reports

Database should store the file URL/key, not the actual file.

# 61. Environment Variables

    Production environment variables:

kosh_DATABASE_URL= (PostgreSQL connection; the kosh_ prefix is injected by the Vercel Prisma Postgres integration)
APP_URL= (absolute base URL for email links)
EMAIL_API_KEY= (Resend API key)
EMAIL_FROM= (email sender)
BLOB_READ_WRITE_TOKEN= (Vercel Blob)

Seeding only (remove after the first admin exists):
SEED_ADMIN_NAME=, SEED_ADMIN_USERNAME=, SEED_ADMIN_EMAIL=, SEED_ADMIN_PASSWORD=

Sessions are stored in the database, so no auth secret is needed.

`.env.example` lists every variable.

Never commit secrets to Git.

# 62. Security

    Security requirements:

Password hashing

Secure sessions

Protected routes

Server-side authorization

Permission validation

Input validation

Secure cookies

Audit logs

Rate limiting where necessary

No plaintext passwords

No sensitive data in client-side code

Important rule:

Client-side UI restrictions are not security.

Every sensitive operation must be validated on the server.

# 63. Dashboard Access

    Admin:

Full dashboard

Supervisor:

Dashboard based on permissions

Staff:

Personal dashboard

Staff should normally only see their own financial data.

# 64. Responsive Design

    The CRM must work on:

Desktop
Laptop
Tablet
Mobile

Desktop:

Sidebar + Main Content

Mobile:

Header
Navigation Drawer
Main Content

Tables should support horizontal scrolling or responsive cards.

Forms should stack on smaller screens.

# 65. V1 Scope

    V1 must include:

Authentication
Login

Logout

Password change

Password reset by email

Login notification emails

Active/inactive users

Sessions

Employees
CRUD

Profile image

Roles

Permissions

Activation/deactivation

Services
CRUD

English/Arabic

Default price

Active/inactive

Transactions
Create invoice

Edit invoice

Paid/unpaid

Employee association

Service association

Search

Filters

Cancel invoice

Employee Earnings
Global share percentage

Employee revenue

Employee earnings

Employee expenses

Final payout

Monthly settlements

Historical share percentage

Salon Expenses
CRUD

Categories

Reports

Dashboard
Revenue

Bills

Pending

Expenses

Staff

Employee earnings

Charts

Latest invoices

Reports
Revenue

Expenses

Employee performance

Employee earnings

Settlements

Settings
Salon information

Currency

Tax

Employee share percentage

Security

Notifications

Localization
English

Arabic

RTL

Themes
Light

Dark

System

Audit
Financial audit logs

Security audit logs

User changes

# 66. Development Phases

    Phase 1 — Foundation
    Create Next.js project

Configure TypeScript

Configure Tailwind

Configure shadcn/ui

Configure Prisma

Connect PostgreSQL

Configure environment variables

Create base layout

Create sidebar

Create header

Create theme system

Create English/Arabic foundation

Create RTL foundation

Deliverable:

Running Kosh CRM shell

Phase 2 — Authentication
Login

Logout

Sessions

Password hashing

Protected routes

Roles

Permissions

Active/inactive accounts

Deliverable:

Secure authentication system

Phase 3 — Employees
Employee list

Employee creation

Employee editing

Employee profile

Profile image

Role management

Permissions

Activation/deactivation

Deliverable:

Complete employee management

Phase 4 — Services
Service list

Add service

Edit service

English name

Arabic name

Default price

Active/inactive

Deliverable:

Central service catalog

Phase 5 — Transactions
Create invoice

Invoice number

Employee selection

Service selection

Amount

Paid/unpaid

Invoice list

Search

Filters

Edit

Cancel

Audit logging

Deliverable:

Complete billing system

Phase 6 — Employee Earnings
Global share percentage

Revenue calculation

Employee earnings

Employee expenses

Final payout

Monthly settlements

Settlement status

Historical share percentage

Deliverable:

Complete employee settlement system

Phase 7 — Salon Expenses
Expense categories

Expense creation

Expense editing

Expense deletion/cancellation

Expense reports

Date filtering

Deliverable:

Salon expense tracking

Phase 8 — Dashboard
Summary cards

Revenue charts

Latest invoices

Employee earnings

Expense overview

Date filtering

Admin dashboard

Staff dashboard

Deliverable:

Complete management dashboard

Phase 9 — Reports
Revenue report

Expense report

Employee performance

Employee earnings

Service performance

Settlement report

Deliverable:

Complete reporting system

Phase 10 — Settings
Salon information

Financial settings

Employee share percentage

Currency

Tax

Security

Notifications

Deliverable:

Configurable CRM

Phase 11 — Localization and UX
English

Arabic

RTL

Light theme

Dark theme

System theme

Mobile responsive

Loading states

Empty states

Error states

Accessibility

Deliverable:

Production-quality multilingual UI

Phase 12 — Production
Vercel deployment

Production database

Object storage

Database migrations

Backups

Security review

Permission testing

Financial calculation testing

Performance testing

Error monitoring

Deliverable:

Production-ready Kosh CRM

# 67. Testing

    Because this application handles money, financial calculations must be tested.

Permission Tests
Staff cannot edit another employee's invoice.

Staff cannot change global share percentage.

Staff cannot manage users.

Supervisor cannot change Admin permissions.

Admin can access everything.

Financial Tests
Revenue = paid invoices

Employee share =
revenue × share percentage / 100

Final payout =
employee share - employee expenses + adjustments

Historical Settlement Test
September = 50%

Global percentage changes to 60%

September settlement remains 50%.

Localization Tests
English = LTR

Arabic = RTL

Theme Tests
Light
Dark
System

Security Tests
Test:

Unauthorized requests

Expired sessions

Inactive accounts

Password handling

Permission escalation

Unauthorized financial changes

# 68. Future Features

    After V1:

Customers

Customer profiles

Customer history

Appointments

Calendar

Employee schedules

Tips

Salaries

POS

Inventory

Product sales

Stock management

WhatsApp notifications

SMS

Email automation

Receipt printing

PDF invoices

Advanced analytics

Multi-branch salons

Customer loyalty

Memberships

Gift cards

Online booking

Customer portal

PWA/mobile application

The most natural next major modules are:

Customers
Appointments
Calendar

# 69. Final Product Architecture

    Kosh CRM
    │
    ├── Authentication
    │
    ├── Dashboard
    │
    ├── Employees
    │ ├── Staff
    │ ├── Supervisors
    │ ├── Admins
    │ └── Permissions
    │
    ├── Services
    │ ├── English
    │ └── Arabic
    │
    ├── Transactions
    │ ├── Invoices
    │ └── Salon Expenses
    │
    ├── Employee Financials
    │ ├── Revenue
    │ ├── Share Percentage
    │ ├── Employee Expenses
    │ ├── Earnings
    │ └── Settlements
    │
    ├── Reports
    │ ├── Revenue
    │ ├── Expenses
    │ ├── Employee Performance
    │ ├── Employee Earnings
    │ └── Settlements
    │
    ├── Settings
    │ ├── Information
    │ ├── Financial
    │ ├── Security
    │ ├── Notifications
    │ ├── System
    │ ├── Backup
    │ └── Printing
    │
    ├── Localization
    │ ├── English
    │ ├── Arabic
    │ └── RTL
    │
    ├── Theme
    │ ├── Light
    │ ├── Dark
    │ └── System
    │
    └── Audit Logs

# 70. Core Business Flow

    The most important workflow is:

Employee logs in
↓
Employee performs service
↓
Employee creates invoice
↓
Invoice is marked Paid
↓
Revenue is recorded
↓
Employee revenue increases
↓
Employee expenses/deductions are recorded
↓
End of month
↓
Settlement is calculated
↓
Global share percentage is applied
↓
Employee expenses are deducted
↓
Final payout is calculated
↓
Admin/Supervisor reviews
↓
Settlement is approved
↓
Employee is paid
↓
Settlement becomes historical record

# 71. Example Calculation

    Employee:
    Asim

Month:
September 2026

Paid Revenue:
AED 5,000

Global Share:
50%

Employee Earnings:
AED 2,500

Employee Expenses:
AED 300

Final Amount:
AED 2,200

Formula:

Employee Earnings =
Paid Revenue × Share Percentage / 100

Final Amount =
Employee Earnings - Employee Expenses + Adjustments

# 72. Important Business Rules

    Employee share percentage must be configurable.

Default employee share percentage is 50%.

Share percentage must not be hard-coded.

Historical settlements store the percentage used at calculation time.

Paid invoices normally contribute to employee settlements.

Unpaid invoices should not normally contribute to employee payout.

Employee expenses reduce employee final payout.

Salon expenses are separate from employee expenses.

Staff normally see only their own financial information.

Admin has full access.

Supervisor access is permission-controlled.

Sensitive operations require server-side authorization.

Paid settlements should be locked from silent modification.

Financial changes should be audited.

English and Arabic must be supported from the beginning.

Arabic must support RTL.

Theme must support Light, Dark, and System.

The application must be responsive.

The application must work correctly on Vercel.

The database must be PostgreSQL.

The database must be accessed through Prisma.

Secrets must never be committed to Git.

# 73. Definition of Done

    Kosh CRM V1 is complete when:

Users can securely login.

Admin can manage all users.

Roles and permissions work.

Staff can create their own invoices.

Services can be managed.

Invoices can be paid/unpaid.

Salon expenses can be tracked.

Employee expenses can be tracked.

Employee revenue is calculated correctly.

Global employee share percentage works.

Historical share percentages are preserved.

Monthly settlements can be generated.

Final employee payout is calculated correctly.

Admin can approve settlements.

Reports show correct financial information.

Dashboard displays useful business metrics.

English works.

Arabic works.

RTL works.

Light mode works.

Dark mode works.

System theme works.

Audit logs record important changes.

Unauthorized actions are rejected server-side.

Application works on mobile and desktop.

Database works in production.

Application deploys successfully to Vercel.

Financial calculations have automated tests.

Production secrets are secured.

Database migrations are managed correctly.

# 74. Recommended Implementation Order

    Build the project in this order:

1. Project setup, database, app shell, and English/Arabic, RTL, and theme foundations
1. Authentication
1. Roles and permissions
1. Audit logs
1. Salon settings (the share percentage is needed before earnings)
1. Employees
1. Services
1. Transactions
1. Salon expenses
1. Employee expenses
1. Employee share calculation
1. Monthly settlements
1. Dashboard
1. Reports
1. Security and notification settings
1. English/Arabic, RTL, and theme completion
1. Testing
1. Production deployment

Every feature ships with English and Arabic text, RTL-safe layout, and audit
logging from the start. The later localization and theme items are review and
completion passes, not first introductions.

Do not start by building every dashboard chart first.

The financial/business logic should be implemented and tested before building advanced analytics.

# 75. First Development Milestone

    The first milestone should produce:

Kosh CRM
│
├── Login
├── Dashboard shell
├── Sidebar
├── Header
├── Theme switcher
├── Language switcher
├── PostgreSQL connection
├── Prisma schema
├── User model
├── Role model
├── Permission model
└── Protected application routes

After that, build:

Employees
↓
Services
↓
Invoices
↓
Employee Expenses
↓
Employee Earnings
↓
Settlements
↓
Reports

This order keeps the project organized and ensures that the financial calculations are built on top of a reliable database and authorization system.
