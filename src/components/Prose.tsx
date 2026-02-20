import clsx from 'clsx'

export function Prose({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('prose prose-md max-w-4xl dark:prose-invert', className)} {...props} />
}

export function Callout({
  title,
  children,
  ..._props
}: {
  children: React.ReactNode
  title?: React.ReactNode
  collapsible?: boolean
} & React.HTMLAttributes<HTMLElement>) {
  const isCollapsible = 'collapsible' in _props && title
  const Element = isCollapsible ? 'details' : 'blockquote'
  const Title = isCollapsible ? 'summary' : 'div'
  const { collapsible: _, ...props } = _props as any
  return (
    // @ts-expect-error polymorphic component
    <Element
      {...props}
      className="-mx-6 rounded-xl border-0 bg-primary-100/50 px-8 not-italic shadow-lg shadow-primary-400/40 dark:bg-primary-800/40 dark:text-primary-200 dark:shadow-black/40"
    >
      {title && <Title className="mt-4 pb-4 text-xl font-semibold">{title}</Title>}
      {children}
    </Element>
  )
}
