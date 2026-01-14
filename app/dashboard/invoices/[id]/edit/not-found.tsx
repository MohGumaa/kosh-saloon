import Link from 'next/link'
import { Frown } from "lucide-react"

const NotFoundPage = () => {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <Frown className="w-10 text-gray-400" />
      <h2 className="text-xl font-semibold ks-title">404 غير موجود</h2>
      <p className='font-medium'>لم يتم العثور على الفاتورة المطلوبة.</p>
      <Link
        href="/dashboard/invoices"
        className="mt-4 ks-btn ks-btn-primary ks-btn-sm"
      >
        العودة إلى الصفحة السابقة
      </Link>
    </main>
  )
}

export default NotFoundPage
