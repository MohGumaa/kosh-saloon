import { Card } from "@/components/dashboard/cards";
import LatestInvoices from "@/components/dashboard/latest-invoices";
import RevenueChart from "@/components/dashboard/revenue-chart";
import { fetchCardData, fetchLatestInvoices, fetchRevenue } from "@/lib/data";

const DashboardPage = async () => {
  const revenue = await fetchRevenue();
  const latestInvoices = await fetchLatestInvoices();
  const {
    numberOfInvoices,
    numberOfUsers,
    totalPaidInvoices,
    totalPendingInvoices,
  } = await fetchCardData();
 

  return (
    <main>
      <h1 className="mb-6 text-xl md:text-2xl font-bold">
        مرحبًا بك 👋 في نظام إدارة  صالون كوش المالي
      </h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="مدفوعه" value={totalPaidInvoices} type="collected" />
        <Card title="قيد الانتظار" value={totalPendingInvoices} type="pending" />
        <Card title="إجمالي الفواتير" value={numberOfInvoices} type="invoices" />
        <Card
          title="إجمالي عدد الموظفين"
          value={numberOfUsers}
          type="staffs"
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <RevenueChart revenue={revenue}  />
        {/* @ts-ignore */}
        <LatestInvoices latestInvoices={latestInvoices} />
      </div>
    </main>
  )
}

export default DashboardPage
