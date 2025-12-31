import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

const HomePage = () => {
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-sky-500 dark:bg-sky-400 p-4 md:h-52">
        {/* <AcmeLogo /> */} الشعار
      </div>
      <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
        <div className="flex flex-col justify-center gap-6 rounded-lg bg-gray-50 dark:bg-white/10 px-6 py-10 md:w-2/5 md:px-20">
          <p className={`text-xl text-gray-700 dark:text-gray-300 md:text-2xl md:leading-normal`}>
            <strong className='text-gray-800 dark:text-white'>مرحبًا بكم 👋</strong> يهدف هذا النظام إلى تمكين موظفي الصالون من إدارة البيانات المالية بكفاءة، وفق الصلاحيات المعتمدة، وبما يضمن الدقة والشفافية.
          </p>
          <Link
            href="/login"
            className="flex items-center gap-5 self-start rounded-lg bg-sky-500 dark:bg-sky-400 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-600 md:text-base"
          >
            <ArrowLeftIcon className="w-5 md:w-6" /> <span>تسجيل الدخول</span>
          </Link>
        </div>
        <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
          {/* Add Hero Images Here */}
        </div>
      </div>
    </main>
  )
}

export default HomePage
