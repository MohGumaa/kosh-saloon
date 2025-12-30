<div align="center">
  <br />
    <a href="#" target="_blank">
      <img src="" alt="Project Banner">
    </a>
  <br />

  <div>
    <img src="https://img.shields.io/badge/-Next_JS-black?style=for-the-badge&logoColor=white&logo=nextdotjs&color=000000" alt="nextdotjs" />
    <img src="https://img.shields.io/badge/-TypeScript-black?style=for-the-badge&logoColor=white&logo=typescript&color=3178C6" alt="typescript" />
    <img src="https://img.shields.io/badge/-Tailwind_CSS-black?style=for-the-badge&logoColor=white&logo=tailwindcss&color=06B6D4" alt="tailwindcss" />
    <img src="https://img.shields.io/badge/shadcn/ui-000000?style=for-the-badge&logo=shadcn/ui&logoColor=white" alt="shadcn" />
    <img src="https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black" alt="firebase" />
  </div>

  <h3 align="center">Kosh Gents Saloon - Financial Dashboard</h3>

</div>

## <a name="introduction">🤖 Introduction</a>

A comprehensive financial management system for CMC Salon with role-based access control, staff management, transaction tracking, and commission calculations.

## <a name="tech-stack">⚙️ Tech Stack</a>

- Next.js
- Typescript
- TailwindCSS
- ShadCN
- SQL

## <a name="features">🔋 Features</a>

### Admin Features

👉 **Dashboard Overview**: Real-time statistics including total revenue, monthly revenue, active staff, and pending commissions

- **Staff Management**: Add, edit, and manage staff members with custom commission rates
- **Financial Overview**: Track performance by staff member with revenue and commission breakdowns
- **Transaction Management**: Record and manage all salon transactions
- **Commission Control**: Mark commissions as paid and track pending payments

### Staff Features

- **Personal Dashboard**: View individual earnings, monthly performance, and transaction count
- **Transaction History**: Access complete history of personal transactions
- **Commission Tracking**: Monitor earned and pending commissions with detailed breakdowns
- **Real-time Stats**: Track total earnings, monthly income, and commission rates

## Technology Stack

- **Framework**: Next.js 16 with React 19.2
- **Database**: Neon Postgres
- **Authentication**: Custom auth with bcrypt password hashing and HTTP-only cookies
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS v4
- **TypeScript**: Full type safety throughout the application

## Database Schema

- **users**: Authentication and role management (admin/staff)
- **staff**: Staff member details and commission rates
- **services**: Salon service catalog with pricing
- **transactions**: Income tracking with payment methods
- **commissions**: Automatic commission calculations and payment tracking

## Getting Started

1. **Run Database Scripts**: The SQL scripts in the `/scripts` folder will automatically create and seed your database with:

   - Default admin account (email: admin@cmcsalon.com, password: admin123)
   - Sample salon services
   - All necessary tables and indexes

2. **Access the Application**:

   - Visit `/login` to sign in
   - Admin users see full dashboard with staff management
   - Staff users see personal performance dashboard

3. **Default Login**:
   - Email: `admin@cmcsalon.com`
   - Password: `admin123`
   - **Important**: Change this password immediately in production

## Security Features

- Bcrypt password hashing (10 rounds)
- HTTP-only session cookies
- Role-based access control (RBAC)
- Protected API routes with authentication middleware
- Parameterized SQL queries to prevent injection
- Secure session management with 7-day expiration

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Admin Only

- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/staff` - List all staff
- `POST /api/admin/staff` - Create staff member
- `PUT /api/admin/staff/[id]` - Update staff member
- `DELETE /api/admin/staff/[id]` - Deactivate staff member
- `GET /api/admin/transactions` - All transactions
- `GET /api/admin/performance` - Staff performance data
- `POST /api/commissions/[id]/pay` - Mark commission as paid

### Staff

- `GET /api/staff/stats` - Personal statistics
- `GET /api/staff/transactions` - Personal transactions
- `GET /api/staff/commissions` - Personal commissions

### Shared

- `GET /api/services` - List active services
- `POST /api/transactions` - Create new transaction (admin only)

## Commission Calculation

Commissions are automatically calculated when transactions are created:

1. Transaction amount × Staff commission rate = Commission amount
2. Commission record created with "pending" status
3. Admin can mark commissions as "paid" from the dashboard
4. Both admin and staff can track commission status in real-time

## Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Production Deployment

This application is optimized for deployment on Vercel with:

- Automatic Neon Postgres integration
- Environment variable management
- Edge runtime compatibility
- Optimized build process

## Support

For issues or questions, please contact your administrator.

## <a name="quick-start">🤸 Quick Start</a>

Follow these steps to set up the project locally on your machine.

**Prerequisites**

Make sure you have the following installed on your machine:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en)
- [npm](https://www.npmjs.com/) (Node Package Manager)

**Cloning the Repository**

```bash
git clone https://git.jubna.me/Kosh Gents Saloon/Kosh Gents Saloon-frontend
cd Kosh Gents Saloon-frontend
```

**Installation**

Install the project dependencies using npm:

```bash
pnpm i
```

**Set Up Environment Variables**

Create a new file named `.env.local` in the root of your project and add the following content:

```env
NEXT_PUBLIC_ENDPOINT=
PROJECT_ID=
API_KEY=
DATABASE_ID=
NEXT_PUBLIC_BUCKET_ID=

NEXT_PUBLIC_ADMIN_PASSKEY=111111
```

**Running the Project**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the project.
