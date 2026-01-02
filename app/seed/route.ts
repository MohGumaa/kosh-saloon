import bcrypt from 'bcrypt';
import postgres from 'postgres';
import {
  users,
  services,
  invoices,
  weeklyRevenue,
  monthlyRevenue,
} from '@/lib/placeholder-data';
import { env } from '@/config/env';

// const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
const sql = postgres(env.databaseUrl,  { ssl: 'verify-full' });

await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

// ========== SEED USERS ==========
async function seedUsers() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'STAFF'
    );
  `;

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return sql`
        INSERT INTO users (id, name, email, password, role)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword}, ${user.role})
        ON CONFLICT (id) DO NOTHING;
      `;
    }),
  );

  return insertedUsers;
}

// ========== SEED SERVICES ==========
async function seedServices() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name_en VARCHAR(255) NOT NULL,
      name_ar VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_by_id UUID NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const insertedServices = await Promise.all(
    services.map(
      (service) => sql`
        INSERT INTO services (id, name_en, name_ar, is_active, created_by_id)
        VALUES (${service.id}, ${service.nameEN}, ${service.nameAR}, ${service.isActive}, ${service.createdById})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  return insertedServices;
}

// ========== SEED INVOICES ==========
async function seedInvoices() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      service_id UUID NOT NULL,
      staff_id UUID NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'COMPLETED',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (staff_id) REFERENCES users(id)
    );
  `;

  const insertedInvoices = await Promise.all(
    invoices.map(
      (invoice) => sql`
        INSERT INTO invoices (id, service_id, staff_id, price, status, notes, created_at)
        VALUES (${invoice.id}, ${invoice.serviceId}, ${invoice.staffId}, ${invoice.price}, 'COMPLETED', ${invoice.notes}, ${invoice.date})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  return insertedInvoices;
}

// ========== SEED WEEKLY REVENUE ==========
async function seedWeeklyRevenue() {
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_revenue (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      week VARCHAR(2) NOT NULL,
      year INT NOT NULL,
      month VARCHAR(3) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      revenue DECIMAL(10, 2) NOT NULL,
      UNIQUE(week, year, month)
    );
  `;

  const insertedWeeklyRevenue = await Promise.all(
    weeklyRevenue.map(
      (rev) => sql`
        INSERT INTO weekly_revenue (week, year, month, start_date, end_date, revenue)
        VALUES (${rev.week}, ${rev.year}, ${rev.month}, ${rev.startDate}, ${rev.endDate}, ${rev.revenue})
        ON CONFLICT (week, year, month) DO NOTHING;
      `,
    ),
  );

  return insertedWeeklyRevenue;
}

// ========== SEED MONTHLY REVENUE ==========
async function seedMonthlyRevenue() {
  await sql`
    CREATE TABLE IF NOT EXISTS monthly_revenue (
      month VARCHAR(3) NOT NULL UNIQUE,
      revenue DECIMAL(10, 2) NOT NULL
    );
  `;

  const insertedRevenue = await Promise.all(
    monthlyRevenue.map(
      (rev) => sql`
        INSERT INTO monthly_revenue (month, revenue)
        VALUES (${rev.month}, ${rev.revenue})
        ON CONFLICT (month) DO NOTHING;
      `,
    ),
  );

  return insertedRevenue;
}

// ========== SEED STAFF SERVICES ==========
async function seedStaffServices() {
  // Optional: Create staff_services junction table if needed
  // For now, we'll skip this as it's not in the current structure
  return Promise.resolve([]);
}

// ========== MAIN SEED FUNCTION ==========
export async function GET() {
  try {
    console.log('Starting database seed...');

    const result = await sql.begin(async (sql) => {
      await seedUsers();
      await seedServices();
      await seedInvoices();
      await seedWeeklyRevenue();
      await seedMonthlyRevenue();
      await seedStaffServices();
    });

    console.log('Database seeded successfully');

    return Response.json(
      {
        message: 'Database seeded successfully',
        data: {
          users: users.length,
          services: services.length,
          invoices: invoices.length,
          weeklyRevenue: weeklyRevenue.length,
          monthlyRevenue: monthlyRevenue.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Database seed error:', error);
    return Response.json(
      {
        error: 'Failed to seed database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ========== OPTIONAL: RESET DATABASE ==========
export async function DELETE() {
  try {
    console.log('Dropping all tables...');

    await sql`DROP TABLE IF EXISTS staff_services CASCADE`;
    await sql`DROP TABLE IF EXISTS invoices CASCADE`;
    await sql`DROP TABLE IF EXISTS services CASCADE`;
    await sql`DROP TABLE IF EXISTS customers CASCADE`;
    await sql`DROP TABLE IF EXISTS monthly_revenue CASCADE`;
    await sql`DROP TABLE IF EXISTS weekly_revenue CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;

    console.log('All tables dropped successfully');

    return Response.json(
      { message: 'All tables dropped successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Database drop error:', error);
    return Response.json(
      {
        error: 'Failed to drop tables',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}