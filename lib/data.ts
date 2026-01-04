import postgres from "postgres";
import { env } from "@/config/env";
import { LatestInvoiceRaw, Revenue } from "@/types";
import { formatCurrency } from "./utils";

const sql = postgres(env.databaseUrl, { ssl: "verify-full" });

// ---------------------------------------
// Helper: check if table exists
// ---------------------------------------
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = ${tableName}
      ) AS exists
    `;
    return result[0]?.exists ?? false;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

// ---------------------------------------
// Fetch monthly revenue safely
// ---------------------------------------
export async function fetchRevenue(): Promise<Revenue[]> {
  if (!(await tableExists("monthly_revenue"))) {
    console.warn('Table "monthly_revenue" does not exist.');
    return [];
  }

  try {
    return await sql<Revenue[]>`SELECT * FROM monthly_revenue`;
  } catch (error) {
    console.error("Database Error (fetchRevenue):", error);
    return [];
  }
}

// ---------------------------------------
// Fetch latest invoices safely
// ---------------------------------------
export async function fetchLatestInvoices(): Promise<LatestInvoiceRaw[]> {
  if (!(await tableExists("invoices"))) {
    console.warn('Table "invoices" does not exist.');
    return [];
  }

  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.amount, users.name, users.image_url, users.email, invoices.id
      FROM invoices
      JOIN users ON invoices.user_id = users.id
      ORDER BY invoices.created_at DESC
      LIMIT 6
    `;

    // return data.map((invoice) => ({
    //   ...invoice,
    //   amount: formatCurrency(invoice.amount),
    // }));
    return data; // Keep amount as number
  } catch (error) {
    console.error("Database Error (fetchLatestInvoices):", error);
    return [];
  }
}

// ---------------------------------------
// Fetch dashboard card data safely
// ---------------------------------------
export async function fetchCardData() {
  // Default safe values
  const safeResult = {
    numberOfUsers: 0,
    numberOfInvoices: 0,
    totalPaidInvoices: formatCurrency(0),
    totalPendingInvoices: formatCurrency(0),
  };

  // Check required tables
  const invoicesExist = await tableExists("invoices");
  const usersExist = await tableExists("users");

  if (!invoicesExist && !usersExist) {
    console.warn("Tables 'invoices' and 'users' do not exist.");
    return safeResult;
  }

  try {
    const invoiceCountPromise = invoicesExist
      ? sql`SELECT COUNT(*) FROM invoices`
      : Promise.resolve([{ count: "0" }]);

    const usersCountPromise = usersExist
      ? sql`SELECT COUNT(*) FROM users WHERE role IN ('STAFF', 'SUPERVISOR')`
      : Promise.resolve([{ count: "0" }]);

    const invoiceStatusPromise = invoicesExist
      ? sql`
          SELECT
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
          FROM invoices
        `
      : Promise.resolve([{ paid: 0, pending: 0 }]);

    const data = await Promise.all([
      invoiceCountPromise,
      usersCountPromise,
      invoiceStatusPromise,
    ]);

    return {
      numberOfInvoices: Number(data[0][0].count ?? 0),
      numberOfUsers: Number(data[1][0].count ?? 0),
      totalPaidInvoices: formatCurrency(Number(data[2][0].paid ?? 0)),
      totalPendingInvoices: formatCurrency(Number(data[2][0].pending ?? 0)),
    };
  } catch (error) {
    console.error("Database Error (fetchCardData):", error);
    return safeResult;
  }
}
