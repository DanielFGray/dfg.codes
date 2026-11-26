import { Outlet } from 'react-router'
import { Header } from '#src/components/Header.js'
import { Footer } from '#src/components/Footer.js'
import { QueryProvider } from '#src/lib/comments.js'

export default function MainLayout() {
  return (
    <QueryProvider>
      <div className="relative w-full">
        <Header />
        <main>
          <Outlet />
        </main>
        <Footer />
      </div>
    </QueryProvider>
  )
}
