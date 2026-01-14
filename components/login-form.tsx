'use client';

import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useActionState } from 'react';
import { authenticate } from '@/lib/actions';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, AtSign, CircleAlert, Key } from 'lucide-react';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex-1 rounded-lg bg-gray-50 dark:bg-white/10 px-6 pb-4 pt-8">
        <h1 className="mb-3 text-2xl ks-title font-medium">
          يرجى تسجيل الدخول للمتابعة.
        </h1>
        <div className="w-full">
          <div>
            <Label
              className="mb-3 mt-5 text-gray-900 dark:text-gray-100"
              htmlFor="email"
            >
              البريد إلكتروني
            </Label>
            <div className="relative">
              <Input 
                id="email"
                type="email"
                name="email"
                className="peer w-full rounded-md placeholder:text-gray-500 pr-10 h-10"
                placeholder="أدخل عنوان بريدك الإلكتروني"
                required
              />
              <AtSign className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:peer-focus:text-gray-500" />
            </div>
          </div>
          <div className="mt-4">
            <Label
              className="mb-3 mt-5 text-gray-900 dark:text-gray-100"
              htmlFor="password"
            >
              كلمة المرور
            </Label>
            <div className="relative">
              <Input
                className="peer w-full rounded-md placeholder:text-gray-500 pr-10 h-10"
                id="password"
                type="password"
                name="password"
                placeholder="أدخل كلمة المرور"
                required
                minLength={6}
              />
              <Key className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:peer-focus:text-gray-500" />
            </div>
          </div>
        </div>
        <Input type="hidden" name="redirectTo" value={callbackUrl} />
        <Button variant="outline" className="mt-4 w-full ks-btn ks-btn-primary border-none! h-10" aria-disabled={isPending}>
          تسجيل الدخول <ArrowLeft className="mr-auto h-5 w-5 text-gray-50" />
        </Button>
        <div
          className="flex h-8 items-end space-x-1"
          aria-live="polite"
          aria-atomic="true"
        >
          {errorMessage && (
            <>
              <CircleAlert className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-500">{errorMessage}</p>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
