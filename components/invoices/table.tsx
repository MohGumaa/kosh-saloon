import Image from 'next/image';
import InvoiceStatus from './status';
import { DeleteInvoice, UpdateInvoice } from './buttons';
import { formatCurrency, formatDateToLocal } from '@/lib/utils';
import { fetchFilteredInvoices } from '@/lib/data';

const InvoicesTable = async({
  query,
  currentPage,
}: {
  query: string;
  currentPage: number;
}) => {
    const invoices = await fetchFilteredInvoices(query, currentPage);

  return (
    <div className="mt-6 flow-root">
      <div className="inline-block min-w-full align-middle">
        <div className="rounded-lg bg-gray-50 dark:bg-white/10 p-2 md:pt-0">
          <div className="md:hidden">
            {invoices?.map((invoice) => (
              <div
                key={invoice.id}
                className="mb-2 w-full rounded-md bg-white dark:bg-gray-950 p-4"
              >
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <div className="mb-2 flex items-center">
                      <Image
                        src={invoice.image_url}
                        className="ml-2 rounded-full"
                        width={28}
                        height={28}
                        alt={`${invoice.name}'s profile picture`}
                      />
                      <p className='font-medium'>{invoice.name}</p>
                    </div>
                    <p className="text-sm text-gray-500">{invoice.name_ar}</p>
                  </div>
                  <InvoiceStatus status={invoice.status} />
                </div>
                <div className="flex w-full items-center justify-between pt-4">
                  <div>
                    <p className="text-xl">
                      {formatCurrency(invoice.amount)}
                    </p>
                    <p>{formatDateToLocal(invoice.created_at)}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <UpdateInvoice id={invoice.id} />
                    <DeleteInvoice id={invoice.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <table className="hidden min-w-full ks-title md:table">
            <thead className="rounded-lg text-right text-sm font-normal">
              <tr>
                <th scope="col" className="px-4 py-5 font-medium sm:pr-6">
                  الموظف
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  نوع الخدمة
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  المبلغ
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  التاريخ
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  الحالة
                </th>
                <th scope="col" className="relative py-3 pl-6 pr-3">
                  <span className="sr-only">تعديل</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-950">
              {invoices?.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="bg-white dark:bg-gray-950 w-full border-b py-3 text-sm last-of-type:border-none [&:first-child>td:first-child]:rounded-tr-lg [&:first-child>td:last-child]:rounded-tl-lg [&:last-child>td:first-child]:rounded-br-lg [&:last-child>td:last-child]:rounded-bl-lg"
                >
                  <td className="whitespace-nowrap py-3 pr-6 pl-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={invoice.image_url}
                        className="rounded-full"
                        width={28}
                        height={28}
                        alt={`${invoice.name}'s profile picture`}
                      />
                      <p>{invoice.name}</p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {invoice.name_ar}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatDateToLocal(invoice.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <InvoiceStatus status={invoice.status} />
                  </td>
                  <td className="whitespace-nowrap py-3 pl-3 pr-6">
                    <div className="flex justify-end gap-3">
                      <UpdateInvoice id={invoice.id} />
                      <DeleteInvoice id={invoice.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default InvoicesTable
