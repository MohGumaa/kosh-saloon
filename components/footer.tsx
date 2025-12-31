import { env } from '@/config/env';

const Footer = () => {
  const currentYear = env.currentYear;
  const appNameAR = env.appNameAR;

  return (
    <footer className='border-t border-950/5 dark:border-white/10 mt-6'>
      <div className="flexCenter flex-col gap-6 lg:flex-row lg:justify-between lg:gap-8 pt-10 pb-4">
        <p className='text-sm text-gray-600 dark:text-gray-400 font-medium'>
          {appNameAR}
        </p>
        <p className='text-sm text-black/20 dark:text-white/25 font-medium'>
          حقوق النشر  محفوظة - {appNameAR} م.ض {currentYear} - 2011
        </p>
      </div>
    </footer>
  )
}

export default Footer
