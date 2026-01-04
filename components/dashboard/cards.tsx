import {
  Clock,
  Users,
  Banknote,
  Inbox
} from 'lucide-react';

const iconMap = {
  collected: Banknote,
  staffs: Users,
  pending: Clock,
  invoices: Inbox,
};

const CardWrapper = () => {
  return (
    <>
      {/* NOTE: Uncomment this code in Chapter 9 */}

      {/* <Card title="Collected" value={totalPaidInvoices} type="collected" />
      <Card title="Pending" value={totalPendingInvoices} type="pending" />
      <Card title="Total Invoices" value={numberOfInvoices} type="invoices" />
      <Card
        title="Total Customers"
        value={numberOfCustomers}
        type="customers"
      /> */}
    </>
  );
}

export const Card = ({
  title,
  value,
  type,
}: {
  title: string;
  value: number | string;
  type: 'invoices' | 'staffs' | 'pending' | 'collected';
}) => {
  const Icon = iconMap[type];

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/10 p-2 shadow-sm">
      <div className="flex p-4">
        {Icon ? <Icon className="h-5 w-5 text-gray-700 dark:text-gray-400" /> : null}
        <h3 className="mr-2 text-sm font-medium">{title}</h3>
      </div>
      <p
        className={`
          truncate rounded-xl bg-white dark:bg-gray-950 px-4 py-8 text-center text-2xl`}
      >
        {value}
      </p>
    </div>
  )
}

export default CardWrapper
