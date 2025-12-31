import Link from 'next/link'
import NavLinks from './nav-links'
import KoshLogo from '../kosh-logo'
import { Power } from 'lucide-react'
import { Button } from '../ui/button'

const SideNav = () => {
  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2">
      <Link 
        href='/'
        className='flex items-end justify-start rounded-md bg-sky-500 dark:bg-sky-400 p-4 mb-2 h-20 md:h-40'
      >
        <KoshLogo 
          label='كوش' 
          ClassName='w-32 md:w-40' 
          labelClassName='text-[44px]' 
          iconClassName='size-12'
        />
      </Link>
      <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
        <NavLinks />
        <div className="hidden h-auto w-full grow rounded-md bg-gray-50 dark:bg-white/10 md:block"></div>
        <form>
          <Button 
            variant="outline"
            size="sm"
            className='cursor-pointer bg-gray-50 dark:bg-white/10 hover:bg-sky-100 hover:text-sky-500 flexCenter w-full grow gap-2 border-0 shadow-none h-12 p-3 md:p-2 md:px-3 md:flex-none md:justify-start'
          >
            <Power className="w-6" />
            <span className="hidden md:block">تسجيل الخروج</span>
          </Button>
        </form>
      </div>
    </div>
  )
}

export default SideNav
