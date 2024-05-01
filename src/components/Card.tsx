import Link, { LinkProps } from 'next/link'
import { classed } from '@tw-classed/react'
import clsx from 'clsx'

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6.75 5.75 9.25 8l-2.5 2.25"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const Card = classed('div', 'group relative flex flex-col items-start')

Card.Link = function CardLink({ children, ...props }: LinkProps & { children: React.ReactNode }) {
  return (
    <>
      <div className="absolute -inset-x-4 -inset-y-6 z-0 scale-95 bg-primary-50/40 opacity-0 transition group-hover:scale-100 group-hover:opacity-100 dark:bg-primary-800/40 sm:-inset-x-6 sm:rounded-2xl" />
      <Link {...props}>
        <span className="absolute -inset-x-4 -inset-y-6 z-20 sm:-inset-x-6 sm:rounded-2xl" />
        <span className="relative z-10">{children}</span>
      </Link>
    </>
  )
}

Card.Title = function CardTitle({
  as: Component = 'h2',
  href,
  children,
}: {
  as?: keyof JSX.IntrinsicElements | ((p: any) => JSX.Element)
  href?: LinkProps['href']
  children: React.ReactNode
}) {
  return (
    <Component className="text-base font-semibold tracking-tight text-secondary-800 dark:text-secondary-100">
      {href ? <Card.Link href={href}>{children}</Card.Link> : children}
    </Component>
  )
}

Card.Description = function CardDescription({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={clsx(
        'relative z-10 mt-2 text-sm text-primary-600 dark:text-primary-400',
        className,
      )}
    >
      {children}
    </p>
  )
}

Card.Cta = function CardCta({ children }) {
  return (
    <div
      aria-hidden="true"
      className="relative z-10 mt-4 flex items-center text-sm font-medium text-secondary-500"
    >
      {children}
      <ChevronRightIcon className="ml-1 h-4 w-4 stroke-current" />
    </div>
  )
}

Card.Eyebrow = function CardEyebrow<
  T extends keyof JSX.IntrinsicElements | ((p: P) => React.ReactNode),
  P extends Object,
>({
  // @ts-expect-error polymorphic components are hard
  as: Component = 'p',
  className,
  children,
  ...props
}: {
  as?: T
  className?: string
  children: React.ReactNode
} & Omit<React.ComponentProps<T>, 'children'>) {
  return (
    // @ts-expect-error
    <Component
      className={clsx(
        className,
        'relative z-10 order-first mb-3 flex items-center text-sm text-primary-500 text-thin',
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
