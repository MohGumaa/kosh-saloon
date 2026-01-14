import Breadcrumbs from "@/components/invoices/breadcrumbs"

const StaffPage = () => {
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          {
            label: 'قائمة الموظفين',
            href: '/dashboard/our-staff',
            active: true,
          },
        ]}
      />
    </main>
  )
}

export default StaffPage
