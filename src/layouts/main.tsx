import { Outlet } from 'react-router'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function MainLayout() {
  return (
    <div className="relative w-full">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
