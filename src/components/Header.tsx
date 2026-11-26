import { Link, useLocation } from 'react-router'
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay } from 'react-aria-components'
import { tv } from 'tailwind-variants'
import clsx from 'clsx'

import { Container } from '#src/components/Container.js'
import { ChevronDownIcon, CloseIcon, MoonIcon, SunIcon } from './SocialIcons'
import { isCurrent, navlinks } from '#src/navlinks.js'

const menuButtonClass =
  'group flex items-center rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-primary-800 shadow-lg shadow-primary-800/5 ring-1 ring-primary-900/5 backdrop-blur dark:bg-primary-800/90 dark:text-primary-200 dark:ring-primary-700 dark:hover:ring-white/20'

// RAC mounts an overlay in its entering state and holds it in its exiting state until the CSS
// transition ends, so these variants are the closed end of the open and close transitions.
const overlayStyles = tv({
  base: 'fixed inset-0 z-50 bg-primary-800/40 backdrop-blur-sm transition duration-150 dark:bg-black/80',
  variants: {
    isEntering: { true: 'opacity-0' },
    isExiting: { true: 'opacity-0' },
  },
})

const panelStyles = tv({
  base: 'fixed inset-x-4 top-8 z-50 origin-top rounded-3xl bg-white p-8 ring-1 ring-primary-900/5 transition duration-150 dark:bg-primary-900 dark:ring-primary-800',
  variants: {
    isEntering: { true: 'scale-95 opacity-0' },
    isExiting: { true: 'scale-95 opacity-0' },
  },
})

function MobileNavItem({
  href,
  close,
  children,
}: {
  href: string
  close: () => void
  children: React.ReactNode
}) {
  return (
    <li>
      <Link to={href} onClick={close} className="block py-2">
        {children}
      </Link>
    </li>
  )
}

function MobileNavigation(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <div {...props}>
      <DialogTrigger>
        <Button className={menuButtonClass}>
          Menu
          <ChevronDownIcon className="ml-3 h-auto w-2 stroke-primary-500 group-hover:stroke-primary-700 dark:group-hover:stroke-primary-400" />
        </Button>
        <ModalOverlay isDismissable className={overlayStyles}>
          <Modal className={panelStyles}>
            <Dialog aria-label="Site navigation" className="outline-none">
              {({ close }) => (
                <>
                  <div className="flex flex-row-reverse items-center justify-between">
                    <Button slot="close" aria-label="Close menu" className="-m-1 p-1">
                      <CloseIcon className="h-6 w-6 text-primary-500 dark:text-primary-400" />
                    </Button>
                    <h2 className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      Navigation
                    </h2>
                  </div>
                  <nav className="mt-6">
                    <ul className="-my-2 divide-y divide-primary-100 text-base text-primary-800 dark:divide-primary-100/5 dark:text-primary-300">
                      {navlinks.map(link => (
                        <MobileNavItem key={link.href} href={link.href} close={close}>
                          {link.label}
                        </MobileNavItem>
                      ))}
                    </ul>
                  </nav>
                </>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  )
}

function NavItem({ link }: { link: (typeof navlinks)[number] }) {
  const { href } = link
  const isActive = isCurrent(link, useLocation().pathname)

  return (
    <li>
      <Link
        to={href}
        className={clsx(
          'relative block px-3 py-2 transition',
          isActive
            ? 'text-secondary-500 dark:text-secondary-400'
            : 'hover:text-secondary-500 dark:hover:text-secondary-400',
        )}
      >
        {link.label}
        {isActive && (
          <span
            className={clsx(
              'absolute inset-x-1 -bottom-px h-px',
              'bg-gradient-to-r from-secondary-500/0 via-secondary-500/40 to-secondary-500/0',
              'dark:from-secondary-400/0 dark:via-secondary-400/40 dark:to-secondary-400/0',
            )}
          />
        )}
      </Link>
    </li>
  )
}

function DesktopNavigation(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav {...props}>
      <ul className="flex rounded-full bg-white/90 px-3 text-sm font-medium text-primary-800 shadow-lg shadow-primary-800/5 ring-1 ring-primary-900/5 dark:bg-primary-800/90 dark:text-primary-200 dark:ring-primary-700">
        {navlinks.map(link => (
          <NavItem key={link.href} link={link} />
        ))}
      </ul>
    </nav>
  )
}

function ModeToggle() {
  function disableTransitionsTemporarily() {
    document.documentElement.classList.add('[&_*]:!transition-none')
    window.setTimeout(() => {
      document.documentElement.classList.remove('[&_*]:!transition-none')
    }, 0)
  }

  function toggleMode() {
    disableTransitionsTemporarily()

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const isSystemDarkMode = darkModeMediaQuery.matches
    const isDarkMode = document.documentElement.classList.toggle('dark')

    if (isDarkMode === isSystemDarkMode) {
      delete window.localStorage.isDarkMode
    } else {
      window.localStorage.isDarkMode = isDarkMode
    }
  }

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      className="group rounded-full bg-white/90 px-3 py-2 shadow-lg shadow-primary-800/5 ring-1 ring-primary-800/5 backdrop-blur transition dark:bg-primary-800/90 dark:ring-white/10 dark:hover:ring-white/20"
      onClick={toggleMode}
    >
      <SunIcon className="[@media(prefers-color-scheme:dark)]:fill--50 h-6 w-6 fill-primary-100 stroke-primary-500 transition group-hover:fill-primary-200 group-hover:stroke-primary-700 dark:hidden [@media(prefers-color-scheme:dark)]:stroke-secondary-500 [@media(prefers-color-scheme:dark)]:group-hover:fill-secondary-50 [@media(prefers-color-scheme:dark)]:group-hover:stroke-secondary-600" />
      <MoonIcon className="[@media_not_(prefers-color-scheme:dark)]:fill--400/10 hidden h-6 w-6 fill-primary-700 stroke-primary-500 transition dark:block [@media(prefers-color-scheme:dark)]:group-hover:stroke-primary-400 [@media_not_(prefers-color-scheme:dark)]:stroke-secondary-500" />
    </button>
  )
}

function AvatarContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        className,
        'h-10 w-10 rounded-full bg-white/90 p-0.5 shadow-lg shadow-primary-800/5 ring-1 ring-primary-900/5 backdrop-blur dark:bg-primary-800/90 dark:ring-white/10',
      )}
      {...props}
    />
  )
}

function Avatar() {
  return (
    <Link to="/" aria-label="Home" className="pointer-events-auto">
      <img
        src="/avatar.jpg"
        alt=""
        className="h-9 w-9 rounded-full bg-primary-100 object-cover dark:bg-primary-800"
      />
    </Link>
  )
}

export function Header() {
  return (
    <header className="relative z-50 flex flex-none flex-col">
      <div className="sticky top-0 z-10 pb-8 pt-6">
        <Container>
          <div className="relative flex gap-4">
            <div className="flex flex-1">
              <AvatarContainer>
                <Avatar />
              </AvatarContainer>
            </div>
            <div className="flex flex-1 justify-end md:justify-center">
              <MobileNavigation className="pointer-events-auto md:hidden" />
              <DesktopNavigation className="pointer-events-auto hidden md:block" />
            </div>
            <div className="flex justify-end md:flex-1">
              <div className="pointer-events-auto">
                <ModeToggle />
              </div>
            </div>
          </div>
        </Container>
      </div>
    </header>
  )
}
