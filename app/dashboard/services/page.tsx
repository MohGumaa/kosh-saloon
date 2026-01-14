import Breadcrumbs from "@/components/invoices/breadcrumbs"

const ServicesPage = () => {
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          {
            label: 'الخدمات',
            href: '/dashboard/services',
            active: true,
          },
        ]}
      />
    </main>
  )
}

export default ServicesPage
