'use server';

import { z } from 'zod';
import postgres from 'postgres';
import { env } from '@/config/env';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const sql = postgres(env.databaseUrl, { ssl: "verify-full" });

const FormSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  serviceId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export const createInvoice = async(formData: FormData) => {
  const {
    staffId, 
    serviceId,
    amount,
    status
  } = CreateInvoice.parse({
    staffId: formData.get('staffId'),
    serviceId: formData.get('serviceId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  })

  const date = new Date().toISOString();

  await sql`
    INSERT INTO invoices (user_id, service_id, amount, status, created_at)
    VALUES (${staffId}, ${serviceId}, ${amount}, ${status}, ${date})
  `;

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}
