import { Container } from '~/components/Container'

export function SimpleLayout({ title, intro, children }) {
  return (
    <Container className="mt-16 sm:mt-32">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-primary-800 dark:text-primary-100 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-base text-primary-600 dark:text-primary-400">{intro}</p>
      </header>
      <div className="mt-6 sm:mt-8">{children}</div>
    </Container>
  )
}
