'use server';

import { z } from 'zod';
import postgres from 'postgres';
import { signIn } from '@/auth';
import { env } from '@/config/env';
import { AuthError } from 'next-auth';
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
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

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

  try {
    await sql`
      INSERT INTO invoices (user_id, service_id, amount, status, created_at)
      VALUES (${staffId}, ${serviceId}, ${amount}, ${status}, ${date})
    `;
  } catch (error) {
    // We'll also log the error to the console for now
    console.error(error);
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export const updateInvoice = async(id: string, formData: FormData) => {
  const { staffId, serviceId, amount, status } = UpdateInvoice.parse({
    staffId: formData.get('staffId'),
    serviceId: formData.get('serviceId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  try {
    await sql`
      UPDATE invoices
      SET user_id = ${staffId}, service_id = ${serviceId}, amount = ${amount}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    // We'll also log the error to the console for now
    console.error(error);
    // return { message: 'Database Error: Failed to Update Invoice.' };
    throw new Error('Failed to update invoice.');
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export const deleteInvoice = async(id: string) => {
  // throw new Error('Failed to Delete Invoice');

  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}

export const authenticate = async(prevState: string | undefined, formData: FormData) => {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
