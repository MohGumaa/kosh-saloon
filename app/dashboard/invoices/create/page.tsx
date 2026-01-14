import Breadcrumbs from "@/components/invoices/breadcrumbs"
import Form from "@/components/invoices/create-form";
import { fetchServices, fetchStaffs } from "@/lib/data";

const CreateInvoicesPage = async() => {
  const [services, staffs] = await Promise.all([
    fetchServices(),
    fetchStaffs()
  ]);

  return (
   <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'الفواتير', href: '/dashboard/invoices' },
          {
            label: 'إنشاء فاتورة',
            href: '/dashboard/invoices/create',
            active: true,
          },
        ]}
      />
      <Form staffs={staffs} services={services}/>
    </main>
  )
}

export default CreateInvoicesPage
