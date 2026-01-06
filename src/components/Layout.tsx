import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-8 py-8">
          <Sidebar />
          <main className="min-w-0 flex-1 py-2">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
