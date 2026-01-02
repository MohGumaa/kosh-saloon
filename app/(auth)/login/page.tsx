import { Suspense } from 'react';
import KoshLogo from '@/components/kosh-logo';
import LoginForm from '@/components/login-form';
import Link from 'next/link';

const LoginPage = () => {
  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-100 flex-col space-y-2.5 p-4 md:-mt-32">
        <div className="flex h-20 w-full items-end rounded-lg bg-sky-500 p-3 md:h-36">
          <Link href="/" className="w-60 md:w-80">
            <KoshLogo />
          </Link>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}

export default LoginPage
