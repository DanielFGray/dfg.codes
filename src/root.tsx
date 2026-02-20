import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import type { LinksFunction } from 'react-router'
import { useLayoutEffect } from 'react'
import stylesheet from './index.css?url'

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: stylesheet }]

function DarkModeSync() {
  useLayoutEffect(() => {
    const isDarkMode =
      window.localStorage.isDarkMode === 'true' ||
      (window.localStorage.isDarkMode == null &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [])
  return null
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script dangerouslySetInnerHTML={{
          __html: `
          let isDarkMode = window.localStorage.isDarkMode === 'true' ||
            (window.localStorage.isDarkMode == null && window.matchMedia('(prefers-color-scheme: dark)').matches)
          document.documentElement.classList.toggle('dark', isDarkMode)
        ` }} />
        <Meta />
        <Links />
      </head>
      <body className="flex h-full bg-zinc-100 antialiased dark:bg-zinc-900">
        <DarkModeSync />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function Root() {
  return <Outlet />
}
