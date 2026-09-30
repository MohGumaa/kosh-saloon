# Kosh CRM

Salon management and financial CRM for **Kosh Salon**. It tracks employees,
services, invoices, salon and employee expenses, employee earnings, monthly
settlements, reports, permissions, and settings. The app supports English and
Arabic (with full RTL) and light, dark, and system themes.

> **Status:** early development. Feature 1 (app shell and foundation) is done.
> Everything else listed below is planned for V1 and is built one feature at a
> time.

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
| Hosting | [Vercel](https://vercel.com) |

Planned: Zod for input validation and Recharts for dashboard and report charts.

## Features

### Available now

- App shell with a sidebar on desktop and a drawer on mobile
- English and Arabic, with the full layout switching to RTL
- Light, Dark, and System themes with no flash on load
- The Kosh design tokens mapped onto shadcn/ui
- A Prisma and PostgreSQL connection

### Planned for V1

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

   Copy `.env.example` to `.env` and fill in your database connection string:

   ```env
   kosh_DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
   ```

   The `kosh_` prefix matches what the Vercel Prisma Postgres integration
   injects. Never commit `.env`.

4. **Start the development server**

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
| `pnpm exec tsc --noEmit` | Type-check the project |
| `pnpm exec prisma generate` | Generate the Prisma client (also runs on install) |
| `pnpm exec prisma validate` | Validate the Prisma schema |
| `pnpm exec prisma migrate dev` | Create and apply migrations locally |
| `pnpm exec prisma migrate deploy` | Apply migrations in production |

## Project Structure

```text
actions/        Server Actions (for example, setting the locale)
app/            Next.js App Router routes and layouts
  (app)/        The authenticated app shell (dashboard and other pages)
components/
  layout/       Sidebar, header, and the language and theme switchers
  ui/           shadcn/ui components
i18n/           next-intl request config and the list of locales
lib/            The Prisma client, navigation config, and utilities
locales/        Translation files (en.json, ar.json)
prisma/         The Prisma schema
prototypes/     Static HTML mockups used as the design reference
blueprint/      Project plans, specs, and feature history
```

## Deployment

The app is built to deploy on **Vercel** with a cloud PostgreSQL database.
Prisma migrations run on deploy (`pnpm exec prisma migrate deploy`), and the
environment variables are set in the Vercel project settings.
