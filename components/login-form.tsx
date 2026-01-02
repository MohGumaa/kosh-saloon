
import { cairo } from '@/fonts';
import { ArrowLeft, AtSign, Key } from 'lucide-react';
import { Button } from './ui/button';


export default function LoginForm() {
  return (
    <form className="space-y-3">
      <div className="flex-1 rounded-lg bg-gray-50 dark:bg-white/10 px-6 pb-4 pt-8">
        <h1 className={`${cairo.className} mb-3 text-2xl ks-title`}>
          يرجى تسجيل الدخول للمتابعة.
        </h1>
        <div className="w-full">
          <div>
            <label
              className="mb-3 mt-5 block text-xs font-medium text-gray-900 dark:text-gray-100"
              htmlFor="email"
            >
              البريد إلكتروني
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-2.25 pr-10 text-sm outline-2 dark:outline-white/10 placeholder:text-gray-500 dark:bg-white/5"
                id="email"
                type="email"
                name="email"
                placeholder="أدخل عنوان بريدك الإلكتروني"
                required
              />
              <AtSign className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:peer-focus:text-gray-500" />
            </div>
          </div>
          <div className="mt-4">
            <label
              className="mb-3 mt-5 block text-xs font-medium text-gray-900"
              htmlFor="password"
            >
              كلمة المرور
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-2.25 pr-10 text-sm outline-2 placeholder:text-gray-500"
                id="password"
                type="password"
                name="password"
                placeholder="أدخل كلمة المرور"
                required
                minLength={6}
              />
              <Key className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
          </div>
        </div>
        <Button variant="outline" className="mt-4 w-full ks-btn ks-btn-primary border-none! h-10">
          تسجيل الدخول <ArrowLeft className="mr-auto h-5 w-5 text-gray-50" />
        </Button>
        <div className="flex h-8 items-end space-x-1">
          {/* Add form errors here */}
        </div>
      </div>
    </form>
  );
}
