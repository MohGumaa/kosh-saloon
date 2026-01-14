import Breadcrumbs from "@/components/invoices/breadcrumbs"

const AccessPage = () => {
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          {
            label: 'صلاحيات الوصول',
            href: '/dashboard/access',
            active: true,
          },
        ]}
      />
    </main>
  )
}

export default AccessPage
