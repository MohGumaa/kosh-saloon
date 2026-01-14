
import clsx from 'clsx';
import { Check, Clock } from 'lucide-react';

export default function InvoiceStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'flexCenter rounded-full px-2 py-1 text-xs max-w-24.5',
        {
          'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300': status === 'pending',
          'bg-green-500 text-white': status === 'paid',
        },
      )}
    >
      {status === 'pending' ? (
        <>
          غير مدفوعة
          <Clock className="mr-1 w-4 text-gray-500" />
        </>
      ) : null}
      {status === 'paid' ? (
        <>
          مدفوع
          <Check className="mr-1 w-4 text-white" />
        </>
      ) : null}
    </span>
  );
}
