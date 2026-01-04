import postgres from "postgres";
import { env } from "@/config/env";
import { LatestInvoiceRaw, Revenue } from "@/types";
import { formatCurrency } from "./utils";

const sql = postgres(env.databaseUrl,  { ssl: 'verify-full' });

// We need to update to check if table exist
export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue[]>`SELECT * FROM monthly_revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, users.name, users.image_url, users.email, invoices.id
      FROM invoices
      JOIN users ON invoices.user_id = users.id
      ORDER BY invoices.created_at DESC
      LIMIT 6`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}
