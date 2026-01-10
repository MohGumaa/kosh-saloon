import Link from 'next/link';
import { Pen, Plus, Trash2 } from 'lucide-react';

export function CreateInvoice() {
  return (
    <Link
      href="/dashboard/invoices/create"
      className="flex items-center h-10 font-medium! ks-btn ks-btn-sm ks-btn-primary"
    >
      <span className="hidden md:block">إنشاء فاتورة</span>{' '}
      <Plus className="h-5 md:mr-4" />
    </Link>
  );
}

export function UpdateInvoice({ id }: { id: string }) {
  return (
    <Link
      href="/dashboard/invoices"
      className="rounded-md border p-2 hover:bg-gray-100 dark:hover:dark:bg-white/10"
    >
      <Pen className="w-5" />
    </Link>
  );
}

export function DeleteInvoice({ id }: { id: string }) {
  return (
    <>
      <button type="submit" className="rounded-md border p-2 hover:bg-gray-100 dark:hover:dark:bg-white/10">
        <span className="sr-only">حذف</span>
        <Trash2 className="w-5" />
      </button>
    </>
  );
}
