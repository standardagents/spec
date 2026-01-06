import { NavLink, useParams } from 'react-router-dom'
import { getNavigation, latestVersion, versions } from '../lib/content'

export function Sidebar() {
  const { version } = useParams()
  const currentVersion = version && versions.includes(version) ? version : latestVersion
  const navigation = getNavigation(currentVersion)

  return (
    <aside className="hidden w-56 flex-shrink-0 lg:block">
      <div className="sticky top-24">
        <nav className="space-y-6">
          {navigation.map((group) => (
            <div key={group.group}>
              <h3 className="mb-2 font-label text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                        }`
                      }
                    >
                      {item.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
