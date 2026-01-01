'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DASHBOARD_LINKS, user } from '@/constants';

const NavLinks = () => {
  const pathname = usePathname();

  const linksForRole = DASHBOARD_LINKS.filter((item) =>
    item.allowedRoles.includes(user.role)
  );

  return (
    <>
      {linksForRole.map(link => {
        const LinkIcon = link.icon;

        return (
          <Link 
            key={link.id}
            href={link.href}
            className={clsx(
              'flexCenter grow gap-2 rounded-md text-sm font-semibold h-12 cursor-pointer bg-gray-50 dark:bg-white/10 hover:bg-sky-100 hover:text-sky-500 md:flex-none md:justify-start md:p-2 md:px-3',
              {
                'bg-sky-100! text-sky-500!': pathname === link.href
              }
            )}
          >
            <LinkIcon className="w-6" />
            <span className="hidden md:block">{link.label}</span>
          </Link>
        )
      })}
    </>
  )
}

export default NavLinks
