import { fetchCardData } from '@/lib/data';
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

const CardWrapper = async () => {
  const {
    numberOfInvoices,
    numberOfUsers,
    totalPaidInvoices,
    totalPendingInvoices,
  } = await fetchCardData();

  return (
    <>
      <Card title="مدفوعه" value={totalPaidInvoices} type="collected" />
      <Card title="قيد الانتظار" value={totalPendingInvoices} type="pending" />
      <Card title="إجمالي الفواتير" value={numberOfInvoices} type="invoices" />
      <Card
        title="إجمالي عدد الموظفين"
        value={numberOfUsers}
        type="staffs"
      />
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
