Build Plan
List the features that make up Kosh CRM in rough build order.
Each item is one real product slice. Scaffolding and visual prototyping are treated as pre-build work, not features.

Run /feature to spec the next unchecked item, or /feature 2 to pick a specific feature.

Keep completed items checked and append new features as the project grows.
Do not renumber completed features; archived feature specs will refer to their IDs.

Your features
- [ ] 1. Authentication & sessions - Secure login, logout, password management, sessions, inactive-account protection, and authentication state.

- [ ] 2. Roles & permissions - Implement ADMIN, SUPERVISOR, and STAFF roles with granular permission management and server-side authorization.

- [ ] 3. Employee management - Create, edit, activate/deactivate, view, and manage employee accounts, profiles, images, roles, and account details.

- [ ] 4. Service management - Manage salon services with English/Arabic names, default prices, active status, and service categories.

- [ ] 5. Invoice & transaction management - Create, view, edit, search, filter, pay, and cancel invoices while associating each transaction with an employee and service.

- [ ] 6. Salon expense management - Record and manage salon expenses such as rent, utilities, supplies, maintenance, marketing, and other business costs.

- [ ] 7. Employee expense management - Record employee deductions such as cash advances, withdrawals, personal expenses, and other amounts deducted from employee earnings.

- [ ] 8. Employee revenue & share calculation - Calculate employee paid revenue, apply the globally configured share percentage, and calculate employee earnings.

- [ ] 9. Monthly employee settlements - Generate monthly settlements showing revenue, share percentage, earnings, expenses, final payout, approval status, and payment status.

- [ ] 10. Historical settlement protection - Preserve the exact share percentage and financial values used when a settlement was calculated so future global setting changes do not alter historical records.

- [ ] 11. Admin dashboard - Build the main salon dashboard with revenue, bills, pending amounts, salon expenses, staff count, employee payouts, latest invoices, and revenue charts.

- [ ] 12. Staff personal dashboard - Build a staff-focused dashboard showing personal revenue, paid/unpaid bills, share percentage, earnings, expenses, and current/final payout.

- [ ] 13. Revenue reports - Provide daily, weekly, monthly, yearly, and custom-range revenue reports with paid/unpaid breakdowns and revenue by employee and service.

- [ ] 14. Expense reports - Provide salon and employee expense reports with categories, date ranges, totals, and financial summaries.

- [ ] 15. Employee performance reports - Show employee services, invoices, revenue, earnings, expenses, payout, trends, and service performance.

- [ ] 16. Settlement reports - Provide monthly settlement reports with employee earnings, expenses, share percentages, approvals, and paid status.

- [ ] 17. Salon settings - Manage salon name, license number, address, phone, email, logo, tax ID, currency, tax rate, and global employee share percentage.

- [ ] 18. Security settings - Add password changes, login notification preferences, session/security controls, and other account security options.

- [ ] 19. Notification settings - Configure login notifications, daily reports, weekly/monthly reports, and employee settlement notifications.

- [ ] 20. Audit logging - Record important authentication, user, permission, invoice, expense, percentage, settlement, and financial changes with the responsible user and timestamps.

- [ ] 21. English & Arabic localization - Add complete English and Arabic translations for the CRM, including all navigation, forms, tables, messages, reports, and settings.

- [ ] 22. RTL support - Make the entire application correctly switch between LTR English and RTL Arabic layouts, including navigation, forms, tables, charts, dialogs, and responsive layouts.

- [ ] 23. Theme system - Support Light, Dark, and System themes with the Kosh visual style and persist each user's preference.

- [ ] 24. Responsive CRM experience - Ensure dashboards, tables, forms, reports, navigation, and financial workflows work across desktop, tablet, and mobile.

- [ ] 25. Financial validation & business rules - Validate revenue, share percentage, employee expenses, final payout, invoice status, tax, and settlement calculations with automated tests.

- [ ] 26. Production deployment & database operations - Prepare PostgreSQL, Prisma migrations, environment variables, storage, backups, monitoring, and Vercel production deployment.

- [ ] 27. Production security & permission testing - Test role boundaries, permission escalation, inactive accounts, unauthorized financial actions, session security, and sensitive data access.

- [ ] 28. Production readiness & QA - Complete end-to-end testing, error handling, loading/empty states, accessibility checks, performance checks, and final production verification.

Future features
These should remain outside V1 until the core CRM is stable:

Customer management - Customer profiles, contact information, visit history, invoices, and service history.

Appointments & calendar - Manage customer appointments, employee schedules, availability, and daily salon calendars.

Inventory management - Track salon products, stock levels, purchases, usage, and inventory expenses.

POS & product sales - Sell salon products alongside services and include them in financial reporting.

Tips & additional employee earnings - Track tips and other employee income separately from the standard service-share calculation.

Receipt & invoice printing - Support printable receipts, invoice PDFs, thermal printers, salon branding, and configurable invoice layouts.

Automated notifications - Send email, WhatsApp, or SMS notifications for reports, appointments, settlements, and other events.

Multi-branch support - Support multiple Kosh salon locations with branch-specific employees, services, transactions, expenses, and reporting.

Customer loyalty & memberships - Add loyalty points, memberships, discounts, packages, and customer rewards.

Online booking - Allow customers to book services and select employees through an online booking interface.

Advanced analytics - Add deeper business analytics, service trends, employee trends, profitability analysis, and customizable reports.

Mobile/PWA experience - Provide an installable mobile-friendly Kosh CRM experience for staff and management.
