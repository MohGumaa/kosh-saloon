import Breadcrumbs from "@/components/invoices/breadcrumbs"

const ReportsPage = () => {
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          {
            label: 'التقارير',
            href: '/dashboard/reports',
            active: true,
          },
        ]}
      />
    </main>
  )
}

export default ReportsPage
