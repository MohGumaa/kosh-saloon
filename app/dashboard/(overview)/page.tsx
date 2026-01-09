import { Suspense } from 'react';
import CardWrapper from "@/components/dashboard/cards";
import LatestInvoices from "@/components/dashboard/latest-invoices";
import RevenueChart from "@/components/dashboard/revenue-chart";
import { CardsSkeleton, LatestInvoicesSkeleton, RevenueChartSkeleton } from '@/components/skeletons/dashboard-skeleton';

const DashboardPage = async () => {
  return (
    <main>
      <h1 className="mb-6 text-xl md:text-2xl font-bold">
        مرحبًا بك 👋 في نظام إدارة  صالون كوش المالي
      </h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

        <Suspense fallback={<CardsSkeleton />}>
          <CardWrapper />
        </Suspense>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <Suspense fallback={<RevenueChartSkeleton />}>
          <RevenueChart />
        </Suspense>
        {/* @ts-ignore */}
        <Suspense fallback={<LatestInvoicesSkeleton />}>
          <LatestInvoices />
        </Suspense>
      </div>
    </main>
  )
}

export default DashboardPage
