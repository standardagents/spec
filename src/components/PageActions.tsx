import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface PageActionsProps {
  content: string
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  )
}

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 4h2v6H7V9zm3 0h2l1.5 3 1.5-3h2v6h-2v-3l-1.5 3-1.5-3v3H10V9zm7 0h2l2 3-2 3h-2l2-3-2-3z"/>
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

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  )
}

export function PageActions({ content }: PageActionsProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Append .md to current path for raw markdown view
  const mdPath = `${location.pathname}.md`

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <CopyIcon className="h-4 w-4" />
        {copied ? 'Copied!' : 'Copy page'}
        <ChevronIcon className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={handleCopy}
            className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <CopyIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Copy page</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Copy page as Markdown for LLMs</div>
            </div>
          </button>
          <a
            href={mdPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => setOpen(false)}
          >
            <MarkdownIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div className="flex-1">
              <div className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                View as Markdown
                <ArrowUpRightIcon className="h-3 w-3" />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">View this page as plain text</div>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
