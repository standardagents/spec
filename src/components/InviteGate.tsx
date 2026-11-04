import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'sab_spec_invite'
const API_BASE = 'https://agents.standardagentbuilder.com'

function shouldBypassInviteGateLocally(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false

  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.orb.local')
}

// Logo component matching the existing pattern from Header.tsx
function Logo() {
  return (
    <span className="flex items-center justify-center gap-2.5 text-gray-900 dark:text-gray-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 150 150"
        fill="currentColor"
        className="h-8 w-8 shrink-0"
        aria-hidden="true"
      >
        <path d="M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z" />
      </svg>
      <span className="font-heading text-[1.5rem] leading-[1.1]">Standard Agent Specification</span>
    </span>
  )
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className || ''}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export default function InviteGate() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validateCode = useCallback(async (inviteCode: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/site-access/${encodeURIComponent(inviteCode)}`)
      const data = await response.json()
      return data.valid === true
    } catch {
      return false
    }
  }, [])

  const handleAuthenticate = useCallback((inviteCode: string) => {
    localStorage.setItem(STORAGE_KEY, inviteCode)
    setAuthenticated(true)
    document.body.classList.remove('invite-gate-active')
  }, [])

  // Check for stored code or URL parameter on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Local development never requires invite codes.
      if (shouldBypassInviteGateLocally()) {
        document.documentElement.classList.remove('invite-gate-pending')
        document.body.classList.remove('invite-gate-active')
        setAuthenticated(true)
        return
      }

      // Check for ?invite=CODE query parameter
      const params = new URLSearchParams(window.location.search)
      const urlCode = params.get('invite')

      if (urlCode) {
        // Show the gate while validating URL code
        document.documentElement.classList.remove('invite-gate-pending')
        setAuthenticated(false)
        document.body.classList.add('invite-gate-active')
        setLoading(true)

        const isValid = await validateCode(urlCode)
        if (isValid) {
          // Clean the URL
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.delete('invite')
          window.history.replaceState({}, '', newUrl.toString())
          handleAuthenticate(urlCode)
          return
        }
        setError('Invalid invite code')
        setLoading(false)
        return
      }

      // Check localStorage
      const storedCode = localStorage.getItem(STORAGE_KEY)
      if (storedCode) {
        // Trust localStorage (don't re-validate every page load)
        document.documentElement.classList.remove('invite-gate-pending')
        setAuthenticated(true)
        return
      }

      // No valid code found, show the gate
      document.documentElement.classList.remove('invite-gate-pending')
      setAuthenticated(false)
      document.body.classList.add('invite-gate-active')
    }

    checkAuth()
  }, [validateCode, handleAuthenticate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedCode = code.trim()
    if (!trimmedCode) {
      setError('Please enter an invite code')
      return
    }

    setLoading(true)
    setError('')

    const isValid = await validateCode(trimmedCode)
    if (isValid) {
      handleAuthenticate(trimmedCode)
    } else {
      setError('Invalid invite code')
      setLoading(false)
    }
  }

  // Still checking auth state
  if (authenticated === null) {
    return null
  }

  // Authenticated, don't render anything
  if (authenticated) {
    return null
  }

  // Show the gate overlay
  return (
    <div data-invite-gate className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm px-6">
        <div className="text-center">
          <Logo />
          <p className="mt-6 font-label text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Early Access
          </p>
          <h1 className="mt-2 font-heading text-2xl font-light text-gray-900 dark:text-gray-100">
            Invite Code Required
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div>
            <label htmlFor="invite-code" className="sr-only">
              Invite code
            </label>
            <input
              id="invite-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your invite code"
              disabled={loading}
              autoFocus
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-body text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-400/20"
            />
          </div>

          {error && (
            <p className="mt-3 text-center font-body text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-3 font-label text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:ring-offset-2 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus:ring-gray-100/20 dark:focus:ring-offset-gray-900"
          >
            {loading ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Verifying...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
