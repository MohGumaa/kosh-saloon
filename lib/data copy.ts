import postgres from "postgres";
import { env } from "@/config/env";
import { LatestInvoiceRaw, Revenue } from "@/types";
import { formatCurrency } from "./utils";

const sql = postgres(env.databaseUrl,  { ssl: 'verify-full' });

// We need to update to check if table exist
// export async function fetchRevenue() {
//   try {
//     // Artificially delay a response for demo purposes.
//     // Don't do this in production :)

//     // console.log('Fetching revenue data...');
//     // await new Promise((resolve) => setTimeout(resolve, 3000));

//     const data = await sql<Revenue[]>`SELECT * FROM monthly_revenue`;

//     // console.log('Data fetch completed after 3 seconds.');

//     return data;
//   } catch (error) {
//     console.error('Database Error:', error);
//     throw new Error('Failed to fetch revenue data.');
//   }
// }

// export async function fetchLatestInvoices() {
//   try {
//     const data = await sql<LatestInvoiceRaw[]>`
//       SELECT invoices.amount, users.name, users.image_url, users.email, invoices.id
//       FROM invoices
//       JOIN users ON invoices.user_id = users.id
//       ORDER BY invoices.created_at DESC
//       LIMIT 6`;

//     const latestInvoices = data.map((invoice) => ({
//       ...invoice,
//       amount: formatCurrency(invoice.amount),
//     }));
//     return latestInvoices;
//   } catch (error) {
//     console.error('Database Error:', error);
//     throw new Error('Failed to fetch the latest invoices.');
//   }
// }

// export async function fetchCardData() {
//   try {
//     // You can probably combine these into a single SQL query
//     // However, we are intentionally splitting them to demonstrate
//     // how to initialize multiple queries in parallel with JS.
//     const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
//     const usersCountPromise = sql`SELECT COUNT(*) FROM users WHERE role IN ('STAFF', 'SUPERVISOR')`;
//     const invoiceStatusPromise = sql`SELECT
//          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
//          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
//          FROM invoices`;

//     const data = await Promise.all([
//       invoiceCountPromise,
//       usersCountPromise,
//       invoiceStatusPromise,
//     ]);

//     const numberOfInvoices = Number(data[0][0].count ?? '0');
//     const numberOfUsers = Number(data[1][0].count ?? '0');
//     const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
//     const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

//     return {
//       numberOfUsers,
//       numberOfInvoices,
//       totalPaidInvoices,
//       totalPendingInvoices,
//     };
//   } catch (error) {
//     console.error('Database Error:', error);
//     throw new Error('Failed to fetch card data.');
//   }
// }

// ---------------------------------------
// Safe fetch for monthly revenue
// ---------------------------------------
// export async function fetchRevenue(): Promise<Revenue[]> {
//   try {
//     const tableExists = await sql<{ exists: boolean }[]>`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_name = 'monthly_revenue'
//       ) AS exists
//     `;

//     if (!tableExists[0].exists) {
//       console.warn('Table "monthly_revenue" does not exist.');
//       return [];
//     }

//     const data = await sql<Revenue[]>`SELECT * FROM monthly_revenue`;
//     return data;
//   } catch (error) {
//     console.error("Database Error (fetchRevenue):", error);
//     return [];
//   }
// }

// ---------------------------------------
// Safe fetch for latest invoices
// ---------------------------------------
// export async function fetchLatestInvoices(): Promise<LatestInvoiceRaw[]> {
//   try {
//     const tableExists = await sql<{ exists: boolean }[]>`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_name = 'invoices'
//       ) AS exists
//     `;

//     if (!tableExists[0].exists) {
//       console.warn('Table "invoices" does not exist.');
//       return [];
//     }

//     const data = await sql<LatestInvoiceRaw[]>`
//       SELECT invoices.amount, users.name, users.image_url, users.email, invoices.id
//       FROM invoices
//       JOIN users ON invoices.user_id = users.id
//       ORDER BY invoices.created_at DESC
//       LIMIT 6
//     `;

//     return data.map((invoice) => ({
//       ...invoice,
//       amount: formatCurrency(invoice.amount),
//     }));
//   } catch (error) {
//     console.error("Database Error (fetchLatestInvoices):", error);
//     return [];
//   }
// }

// ---------------------------------------
// Safe fetch for card data
// ---------------------------------------
// export async function fetchCardData() {
//   try {
//     // Check if tables exist first
//     const invoicesTable = await sql<{ exists: boolean }[]>`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_name = 'invoices'
//       ) AS exists
//     `;

//     const usersTable = await sql<{ exists: boolean }[]>`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_name = 'users'
//       ) AS exists
//     `;

//     if (!invoicesTable[0].exists || !usersTable[0].exists) {
//       console.warn("Required tables do not exist.");
//       return {
//         numberOfUsers: 0,
//         numberOfInvoices: 0,
//         totalPaidInvoices: formatCurrency(0),
//         totalPendingInvoices: formatCurrency(0),
//       };
//     }

//     // Fetch data in parallel
//     const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
//     const usersCountPromise = sql`SELECT COUNT(*) FROM users WHERE role IN ('STAFF', 'SUPERVISOR')`;
//     const invoiceStatusPromise = sql`
//       SELECT
//         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
//         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
//       FROM invoices
//     `;

//     const data = await Promise.all([
//       invoiceCountPromise,
//       usersCountPromise,
//       invoiceStatusPromise,
//     ]);

//     const numberOfInvoices = Number(data[0][0].count ?? 0);
//     const numberOfUsers = Number(data[1][0].count ?? 0);
//     const totalPaidInvoices = formatCurrency(Number(data[2][0].paid ?? 0));
//     const totalPendingInvoices = formatCurrency(Number(data[2][0].pending ?? 0));

//     return {
//       numberOfUsers,
//       numberOfInvoices,
//       totalPaidInvoices,
//       totalPendingInvoices,
//     };
//   } catch (error) {
//     console.error("Database Error (fetchCardData):", error);
//     return {
//       numberOfUsers: 0,
//       numberOfInvoices: 0,
//       totalPaidInvoices: formatCurrency(0),
//       totalPendingInvoices: formatCurrency(0),
//     };
//   }
// }