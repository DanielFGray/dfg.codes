import clsx from 'clsx'

function OuterContainer({ className, children, ...props }: React.HTMLProps<HTMLDivElement>) {
  return (
    <div className={clsx('sm:px-8', className)} {...props}>
      <div className="mx-auto max-w-7xl lg:px-8">{children}</div>
    </div>
  )
}

function InnerContainer({ className, children, ...props }: React.HTMLProps<HTMLDivElement>) {
  return (
    <div className={clsx('relative px-4 sm:px-8 lg:px-12', className)} {...props}>
      <div className="mx-auto max-w-2xl lg:max-w-5xl">{children}</div>
    </div>
  )
}

export function Container({ children, ...props }: React.HTMLProps<HTMLDivElement>) {
  return (
    <OuterContainer {...props}>
      <InnerContainer>{children}</InnerContainer>
    </OuterContainer>
  )
}

Container.Outer = OuterContainer
Container.Inner = InnerContainer
