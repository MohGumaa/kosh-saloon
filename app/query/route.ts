import { env } from '@/config/env';
import postgres from 'postgres';

const sql = postgres(env.databaseUrl,  { ssl: 'verify-full' });

// async function listInvoices() {
// 	const data = await sql`
//     SELECT invoices.amount, customers.name
//     FROM invoices
//     JOIN customers ON invoices.customer_id = customers.id
//     WHERE invoices.amount = 666;
//   `;

// 	return data;
// }

async function listInvoices() {
  const data = await sql`
    SELECT
      i.id,
      i.amount,
      i.status,
      i.notes,
      i.created_at,
      u.name AS staff_name,
      s.name_en AS service_name
    FROM invoices i
    JOIN users u ON i.staff_id = u.id
    JOIN services s ON i.service_id = s.id
    ORDER BY i.created_at DESC;
  `;

  return data;
}

export async function GET() {
  // return Response.json({
  //   message:
  //     'Uncomment this file and remove this line. You can delete this file when you are finished.',
  // });
  try {
  	return Response.json(await listInvoices());
  } catch (error) {
  	return Response.json({ error }, { status: 500 });
  }
}
