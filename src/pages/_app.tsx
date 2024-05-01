import type { AppProps } from 'next/app'
import { Footer } from '~/components/Footer'
import { Header } from '~/components/Header'
import { QueryProvider } from '~/lib/comments'

import '@code-hike/mdx/dist/index.css'
import '~/styles/tailwind.css'
import 'focus-visible'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryProvider>
      <Header />
      <main>
        <Component {...pageProps} />
      </main>
      <Footer />
    </QueryProvider>
  )
}
