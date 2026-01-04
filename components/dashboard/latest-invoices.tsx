import clsx from 'clsx';
import Image from 'next/image';
import { LatestInvoice } from '@/types';
import { RefreshCw } from 'lucide-react';

const LatestInvoices = ({
  latestInvoices
}: {
  latestInvoices: LatestInvoice[]
}) => {
  return (
    <div className="flex w-full flex-col md:col-span-4">
      <h2 className={`ks-title mb-4 text-xl md:text-2xl font-medium`}>
        أحدث الفواتير
      </h2>
      <div className="flex grow flex-col justify-between rounded-xl bg-gray-50 dark:bg-white/10 p-4">

        <div className="bg-white dark:bg-gray-950 rounded-md px-6">
          {latestInvoices.map((invoice, i) => {
            return (
              <div
                key={invoice.id}
                className={clsx(
                  'flex flex-row items-center justify-between py-4',
                  {
                    'border-t': i !== 0,
                  },
                )}
              >
                <div className="flex items-center gap-4">
                  <Image
                    src={invoice.image_url}
                    alt={`${invoice.name}'s profile picture`}
                    className="rounded-full"
                    width={32}
                    height={32}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold md:text-base">
                      {invoice.name}
                    </p>
                    <p className="hidden text-sm text-gray-500 sm:bloc">
                      {invoice.email}
                    </p>
                  </div>
                </div>
                <p
                  className={` truncate text-sm font-medium md:text-base`}
                >
                  {invoice.amount}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pb-2 pt-6">
          <RefreshCw className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm text-gray-500 ">تم التحديث الآن</h3>
        </div>
      </div>
    </div>
  )
}

export default LatestInvoices
