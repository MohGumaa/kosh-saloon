import { notFound } from 'next/navigation';
import Form from '@/components/invoices/edit-form';
import Breadcrumbs from '@/components/invoices/breadcrumbs';

import { fetchInvoiceById, fetchServices, fetchStaffs } from '@/lib/data';

const UpdateInvoicePage = async(props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const id = params.id;

  const [invoice, services, staffs] = await Promise.all([
    fetchInvoiceById(id),
    fetchServices(),
    fetchStaffs()
  ]);

  // Handle case when invoice is not found
  if (!invoice) {
    notFound();
  }

  return (
   <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'الفواتير', href: '/dashboard/invoices' },
          {
            label: 'تعديل الفاتورة',
            href: `/dashboard/invoices/${id}/edit`,
            active: true,
          },
        ]}
      />
      <Form invoice={invoice} staffs={staffs} services={services}/>
    </main>
  )
}

export default UpdateInvoicePage
