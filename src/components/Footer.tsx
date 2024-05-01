import Link from 'next/link'
import { navlinks } from '~/navlinks'
import { classed } from '@tw-classed/react'

import { Container } from '~/components/Container'

const NavLink = classed(Link, 'transition hover:text-secondary-500 dark:hover:text-secondary-400')

export function Footer() {
  return (
    <footer className="mt-32">
      <Container.Outer>
        <div className="border-t border-primary-100 pb-16 pt-10 dark:border-primary-700/40">
          <Container.Inner>
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="flex gap-6 text-sm font-medium text-primary-800 dark:text-primary-200">
                {navlinks.map(link => (
                  <NavLink key={link.href} href={link.href}>
                    {link.label}
                  </NavLink>
                ))}
              </div>
              <p className="text-sm text-primary-500">
                &copy; {new Date().getFullYear()} Daniel Gray. All rights reserved.
              </p>
            </div>
          </Container.Inner>
        </div>
      </Container.Outer>
    </footer>
  )
}
