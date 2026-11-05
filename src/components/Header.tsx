import { useState, useEffect, useRef } from 'react'
import { navGroupIcons, navIconProps } from '../lib/nav-icons'

// Type for window with our theme functions
declare global {
  interface Window {
    toggleTheme: () => void
    getTheme: () => 'light' | 'dark'
  }
}

interface Props {
  currentVersion: string
  currentGroup?: string
  currentSlug?: string
  currentPath: string
  versionHomes: Record<string, string>
}

// Get versions from the content at build time - these are passed as props
const versions = ['0.2.0', '0.1.0']

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

// Logo component inline to avoid import issues
function Logo() {
  return (
    <span className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 150 150"
        fill="currentColor"
        className="h-6 w-6 shrink-0"
        aria-hidden="true"
      >
        <path d="M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z" />
      </svg>
      <span className="font-heading text-[0.9375rem] leading-[1.1] sm:text-[1.25rem] sm:whitespace-nowrap">
        Standard Agent Specification
      </span>
    </span>
  )
}

// Navigation data that will be loaded dynamically
interface NavItem {
  slug: string
  title: string
  href: string
  children?: NavItem[]
}

interface NavGroup {
  group: string
  title: string
  items: NavItem[]
}

/**
 * HIGH CONTRAST OVERRIDES — revert these when ready:
 *   text-gray-800  → text-gray-600   (light inactive text)
 *   text-gray-700  → text-gray-500   (light label text)
 *   text-gray-600  → text-gray-400   (light secondary text)
 *   dark:text-gray-300 → dark:text-gray-400 (dark inactive text)
 *   dark:text-gray-400 → dark:text-gray-500 (dark secondary text)
 */
export default function Header({ currentVersion, currentGroup, currentSlug, currentPath, versionHomes }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [navigation, setNavigation] = useState<NavGroup[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // Handle escape key and outside click to close mobile menu
  useEffect(() => {
    if (!menuOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setMenuOpen(false)
      }
    }

    // Focus trap - keep focus within menu
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !menuRef.current) return

      const focusableElements = menuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleFocusTrap)
    document.addEventListener('mousedown', handleClickOutside)

    // Prevent body scroll when menu is open
    document.body.style.overflow = 'hidden'

    // Focus first focusable element in menu
    const timer = setTimeout(() => {
      const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])'
      )
      firstFocusable?.focus()
    }, 100) // Small delay to allow animation to start

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleFocusTrap)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
      clearTimeout(timer)
    }
  }, [menuOpen])

  // Fetch navigation on mount
  useEffect(() => {
    // Navigation is fetched at build time via the Sidebar component
    // For the mobile menu, we'll fetch it client-side
    fetch(`/api/navigation/${currentVersion}.json`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setNavigation(data))
      .catch(() => setNavigation([]))
  }, [currentVersion])

  const handleToggleTheme = () => {
    if (typeof window !== 'undefined' && window.toggleTheme) {
      window.toggleTheme()
    }
  }

  const latestVersion = versions[0]

  // Pure function to generate version URL - safe to call during render
  const getVersionUrl = (newVersion: string) => {
    if (!currentGroup && newVersion === latestVersion) return currentPath
    if (currentGroup === 'getting-started' && currentSlug === 'overview' && newVersion === latestVersion) return '/'
    if (currentGroup && currentSlug) {
      return `/${newVersion}/${currentGroup}/${currentSlug}`
    }
    return versionHomes[newVersion] ?? `/${newVersion}`
  }

  // Event handler for closing dropdowns - only called on click
  const handleVersionClick = () => {
    setVersionOpen(false)
    setMenuOpen(false)
  }

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 border-b border-gray-200 dark:border-gray-800 ${menuOpen ? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-50/60 backdrop-blur-sm dark:bg-gray-900/60'}`}>
        <div className="px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="flex items-center">
                <Logo />
              </a>
              {/* Version dropdown - desktop only */}
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setVersionOpen(!versionOpen)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-label text-sm font-medium text-gray-800 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                >
                  v{currentVersion}
                  <ChevronIcon className={`h-3 w-3 transition-transform ${versionOpen ? 'rotate-180' : ''}`} />
                </button>
                {versionOpen && (
                  <div className="absolute left-0 z-50 mt-1 min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {versions.map((v) => (
                      <a
                        key={v}
                        href={getVersionUrl(v)}
                        onClick={handleVersionClick}
                        className={`block w-full px-3 py-1.5 text-left text-sm ${
                          v === currentVersion
                            ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                            : 'text-gray-800 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        v{v}
                        {v === latestVersion && (
                          <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">latest</span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <a
                href="https://github.com/standardagents"
                className="rounded-md p-2 text-gray-800 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                <GitHubIcon className="h-5 w-5" />
              </a>
              <button
                onClick={handleToggleTheme}
                className="rounded-md p-2 text-gray-800 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                {/* CSS picks the icon, so a page swap cannot show the wrong one. */}
                <MoonIcon className="h-5 w-5 dark:hidden" />
                <SunIcon className="hidden h-5 w-5 dark:block" />
              </button>
              {/* Hamburger - mobile only */}
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
              >
                {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu backdrop - starts below header */}
      <div
        className={`fixed top-16 right-0 bottom-0 left-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />

      {/* Mobile menu panel */}
      <div
        ref={menuRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-16 right-0 bottom-0 z-50 w-full max-w-sm bg-gray-50 shadow-xl transition-transform duration-300 ease-out dark:bg-gray-900 lg:hidden ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto px-4 py-6">
            {/* Version selector - dropdown style */}
            <div className="relative mb-6">
              <button
                onClick={() => setVersionOpen(!versionOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                <span>v{currentVersion}</span>
                <ChevronIcon className={`h-4 w-4 text-gray-500 transition-transform dark:text-gray-400 ${versionOpen ? 'rotate-180' : ''}`} />
              </button>
              {versionOpen && (
                <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {versions.map((v) => (
                    <a
                      key={v}
                      href={getVersionUrl(v)}
                      onClick={handleVersionClick}
                      className={`block px-4 py-2 text-sm ${
                        v === currentVersion
                          ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      v{v}
                      {v === latestVersion && (
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">latest</span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="space-y-6">
              {navigation.map((navGroup) => (
                <div key={navGroup.group}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm leading-5 font-semibold text-gray-900 dark:text-gray-100">
                    <svg {...navIconProps} className="h-4 w-4 flex-none text-gray-500 dark:text-gray-400" aria-hidden="true" dangerouslySetInnerHTML={{ __html: navGroupIcons[navGroup.group] ?? '' }} />
                    {navGroup.title}
                  </h3>
                  <ul className="space-y-1">
                    {navGroup.items.map((item) => {
                      const isActive = item.href === currentPath
                      const hasActiveChild = item.children?.some(c => c.href === currentPath) ?? false
                      return (
                        <li key={item.href}>
                          <a
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                                : 'text-gray-800 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                            }`}
                          >
                            {item.title}
                          </a>
                          {item.children && (isActive || hasActiveChild) && (
                            <ul className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-3 dark:border-gray-700">
                              {item.children.map((child) => {
                                const childActive = child.href === currentPath
                                return (
                                  <li key={child.href}>
                                    <a
                                      href={child.href}
                                      onClick={() => setMenuOpen(false)}
                                      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                                        childActive
                                          ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                                      }`}
                                    >
                                      {child.title}
                                    </a>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            {/* Agent Builder link */}
          </div>
        </div>
    </>
  )
}
