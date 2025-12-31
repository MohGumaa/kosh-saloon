import Link from 'next/link'
import { Frown } from "lucide-react"
import KoshLogo from '@/components/kosh-logo'

const NotFoundPage = () => {
  return (
  <main className="flex min-h-screen flex-col gap-2 p-6">
    <div className="flex h-20 shrink-0 items-end rounded-lg bg-sky-500 dark:bg-sky-400 p-4 md:h-52">
      <KoshLogo />
    </div>
    <div className='grow flexCenter flex-col gap-2 text-center'>
      <Frown className="w-10 text-gray-400" />
      <h1 className="text-xl md:text-2xl font-semibold ks-title">
        عذرًا، الصفحة غير موجودة
      </h1>
      <p className="font-medium mb-4">
        يبدو أنك حاولت الوصول إلى صفحة غير متاحة. الرجاء التأكد من الرابط أو
        العودة إلى الصفحة الرئيسية.
      </p>
      <Link
        href="/"
        className="ks-btn ks-btn-primary ks-btn-sm mt-4"
      >
        الصفحة الرئيسية
      </Link>
    </div>
  </main>
  )
}

export default NotFoundPage
