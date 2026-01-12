import { Suspense } from 'react';
import { fetchInvoicesPages } from '@/lib/data';

import Search from '@/components/search';
import InvoicesTable from '@/components/invoices/table';
import Pagination from '@/components/invoices/pagination';
import { CreateInvoice } from '@/components/invoices/buttons';
import { InvoicesTableSkeleton } from '@/components/skeletons/dashboard-skeleton';

const InvoicesPage = async (props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
  }>;
}) => {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  const totalPages = await fetchInvoicesPages(query);

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className={`text-2xl ks-title font-bold`}>الفواتير</h1>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="ابحث عن الفواتير..." />
        <CreateInvoice />
      </div>
       <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <InvoicesTable query={query} currentPage={currentPage} />
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  )
}

export default InvoicesPage
