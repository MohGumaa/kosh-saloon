# Kosh CRM

Salon management and financial CRM for **Kosh Salon**. It tracks employees,
services, invoices, salon and employee expenses, employee earnings, monthly
settlements, reports, permissions, and settings. The app supports English and
Arabic (with full RTL) and light, dark, and system themes.

> **Status:** the V1 features below are built. Work remaining before launch:
> production deployment, security and permission testing, and final QA.

## Overview

Kosh Salon has no central system for its daily operations or its money. Kosh CRM
is built to answer these questions:

- How much did the salon make, and how much of it is paid vs unpaid?
- How much revenue did each employee generate, and how much do they earn?
- What did each employee take as advances, and what are they owed at month end?
- What did the salon spend?
- Which services and employees bring in the most revenue?
- Who changed a financial record, and when?

The core flow is: **staff invoice → paid revenue → deductions → monthly
settlement → approval → payment**.

## Technology Stack

| Area | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict) and [React 19](https://react.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| UI components | [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com), [Lucide](https://lucide.dev) icons |
| Database | PostgreSQL ([Prisma Postgres](https://www.prisma.io/postgres) on Vercel) |
| ORM | [Prisma 7](https://www.prisma.io) with the `pg` driver adapter |
| Internationalization | [next-intl](https://next-intl.dev), cookie-based locale (no URL prefix), EN and AR |
| Theming | [next-themes](https://github.com/pacocoursey/next-themes) (Light, Dark, System; dark by default) |
| Fonts | Inter (Latin) and Tajawal (Arabic) through `next/font` |
| Package manager | [pnpm](https://pnpm.io) |
| Validation | [Zod](https://zod.dev) |
| Charts | [Recharts](https://recharts.org) |
| Storage and email | [Vercel Blob](https://vercel.com/docs/vercel-blob) (images), [Resend](https://resend.com) (email) |
| Tests | [Vitest](https://vitest.dev) |
| Hosting | [Vercel](https://vercel.com) |

## Features

- **App shell:** a sidebar on desktop and a drawer on mobile. English and
  Arabic, with the full layout switching to RTL. Light, Dark, and System themes
- **Authentication:** login, logout, password change and reset, login
  notification emails, and blocking inactive accounts
- **Roles and permissions:** Admin, Supervisor, and Staff roles, with granular
  per-user grants enforced on the server
- **Audit logging:** records who changed a financial, security, or user record,
  with the old and new values
- **Salon settings:** salon info, logo, currency, tax rate, and the global
  employee share percentage
- **Employees and services:** manage employees, and services with EN and AR
  names and default prices
- **Invoices:** create, search, filter, pay, and cancel. Invoices are cancelled,
  never deleted, and numbered in sequence (`INV-000001`)
- **Expenses:** salon expenses (rent, utilities, supplies, and so on) and
  employee expenses (advances, withdrawals, and other deductions)
- **Earnings and settlements:** employee share calculation and monthly
  settlements with a `DRAFT → CALCULATED → APPROVED → PAID` flow. Paid
  settlements are locked, and corrections carry over as adjustments
- **Dashboards and reports:** an admin dashboard, a personal staff dashboard,
  and revenue, expense, employee performance, and settlement reports
- **Responsive:** works on desktop, tablet, and mobile

### Business rules

- `employeeShare = paidRevenue × sharePercentage / 100` (the default share is
  50%, set in the settings)
- `finalAmount = employeeShare − employeeExpenses + adjustments`
- Only **paid** invoices count toward earnings. Salon expenses never reduce an
  employee's payout.
- Each settlement stores the share percentage it used, so changing the setting
  never rewrites past settlements.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20 or later
- [pnpm](https://pnpm.io) 10 (`corepack enable` sets up the version pinned in
  `package.json`)
- A PostgreSQL database, for example Prisma Postgres through Vercel

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/MohGumaa/kosh-saloon.git
   cd kosh-saloon
   ```

2. **Install dependencies.** This also generates the Prisma client.

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env` and fill it in. Locally, only the database
   connection string is needed:

   ```env
   kosh_DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
   ```

   The `kosh_` prefix matches what the Vercel Prisma Postgres integration
   injects. Without `EMAIL_API_KEY`, development prints emails to the console.
   Without `BLOB_READ_WRITE_TOKEN`, image uploads report that storage is not
   configured. Never commit `.env`.

4. **Create the database and the first admin**

   ```bash
   pnpm exec prisma migrate dev
   pnpm exec prisma db seed
   ```

   The seed reads `SEED_ADMIN_*` from `.env` and does nothing when an admin
   already exists.

5. **Start the development server**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run the unit tests (Vitest) |
| `pnpm exec tsc --noEmit` | Type-check the project |
| `pnpm exec prisma generate` | Generate the Prisma client (also runs on install) |
| `pnpm exec prisma validate` | Validate the Prisma schema |
| `pnpm exec prisma migrate dev` | Create and apply migrations locally |
| `pnpm exec prisma migrate deploy` | Apply migrations in production |
| `pnpm exec prisma migrate status` | Check that migrations and the database agree |
| `pnpm exec prisma db seed` | Create the first admin (only when none exists) |

## Project Structure

```text
actions/        Server Actions (auth, invoices, expenses, settlements, settings, ...)
app/            Next.js App Router routes and layouts
  (app)/        The authenticated app (dashboards, records, reports, settings)
  (auth)/       Login, forgot password, and reset password
  api/health/   Public database health check for uptime monitoring
components/
  layout/       Sidebar, header, and the language and theme switchers
  ui/           shadcn/ui components
docs/           Operations runbook
i18n/           next-intl request config and the list of locales
lib/            Business rules, data access, auth, and utilities (with tests)
locales/        Translation files (en.json, ar.json)
prisma/         The Prisma schema, migrations, and admin seed
prototypes/     Static HTML mockups used as the design reference
blueprint/      Project plans, specs, and feature history
instrumentation.ts  Server error logging and the production env check
vercel.json     Vercel build command (applies migrations on production deploys)
```

## Deployment

The app deploys on **Vercel** with Prisma Postgres, Vercel Blob, and Resend.
Production deployments apply pending Prisma migrations before building. Preview
deployments only build.

| Variable | Required in production | Purpose |
| --- | --- | --- |
| `kosh_DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_URL` | Yes | Base URL for links in emails |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Yes | Resend key and sender |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob token for images |
| `SEED_ADMIN_*` | Seeding only | First admin account; remove after seeding |

See [docs/operations.md](docs/operations.md) for setup, first deploy, the
migration policy, backups and restore, monitoring (`/api/health` and runtime
logs), and rollback.
