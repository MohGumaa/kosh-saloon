'use client';

import { DASHBOARDLINKS } from '@/constants';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NavLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {DASHBOARDLINKS.map(link => {
        const LinkIcon = link.icon;

        return (
          <Link 
            key={link.id}
            href={link.href}
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
