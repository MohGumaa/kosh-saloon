import postgres from "postgres";
import { env } from "@/config/env";
import { InvoicesTable, LatestInvoiceRaw, Revenue } from "@/types";
import { formatCurrency } from "./utils";

const sql = postgres(env.databaseUrl, { ssl: "verify-full" });

const ITEMS_PER_PAGE = 6;

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
// Fetch filtered invoices with pagination
// ---------------------------------------
export const fetchFilteredInvoices = async (
  query: string,
  currentPage: number,
) => {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  if (!(await tableExists("invoices"))) {
    console.warn('Table "invoices" does not exist.');
    return [];
  }

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT 
        invoices.id,
        invoices.amount,
        invoices.created_at,
        invoices.status,
        services.name_ar,
        services.name_en,
        users.name, 
        users.image_url
      FROM invoices
      JOIN users ON invoices.user_id = users.id
      JOIN services ON invoices.service_id = services.id
      WHERE
        users.name ILIKE ${`%${query}%`} OR
        services.name_ar ILIKE ${`%${query}%`} OR
        services.name_en ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`} OR
        invoices.created_at::text ILIKE ${`%${query}%`}
      ORDER BY invoices.created_at DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
    // return await sql<any[]>`SELECT * FROM invoices`;
  } catch (error) {
    console.error('Database Error (fetchFilteredInvoices):', error);
    throw new Error('Failed to fetch invoices.');
  }
};

// ---------------------------------------
// Fetch total pages for invoices
// ---------------------------------------
export const fetchInvoicesPages = async (query: string): Promise<number> => {
  if (!(await tableExists("invoices"))) {
    console.warn('Table "invoices" does not exist.');
    return 0;
  }

  try {
    const data = await sql<{ count: number }[]>`
      SELECT COUNT(*) as count
      FROM invoices
      JOIN users ON invoices.user_id = users.id
      JOIN services ON invoices.service_id = services.id
      WHERE
        users.name ILIKE ${`%${query}%`} OR
        services.name_ar ILIKE ${`%${query}%`} OR
        services.name_en ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.created_at::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
    `;

    const totalPages = Math.ceil(Number(data[0]?.count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error (fetchInvoicesPages):', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
};

// ---------------------------------------
// Fetch monthly revenue safely
// ---------------------------------------
export async function fetchRevenue(): Promise<Revenue[]> {
  if (!(await tableExists("monthly_revenue"))) {
    console.warn('Table "monthly_revenue" does not exist.');
    return [];
  }

  try {
    // console.log("Fetch revenue data...")
    // await new Promise(reslove => setTimeout(reslove, 3000))
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

