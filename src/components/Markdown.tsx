import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

interface MarkdownProps {
  children: string
  className?: string
}

// Split markdown into lede (first paragraph) and body (rest)
function splitLede(markdown: string): { lede: string; body: string } {
  const trimmed = markdown.trim()
  // Match first paragraph (text before first double newline or heading)
  const match = trimmed.match(/^([^\n]+(?:\n(?![#\n]).*)*)\n\n/)
  if (match) {
    return {
      lede: match[1],
      body: trimmed.slice(match[0].length),
    }
  }
  return { lede: '', body: trimmed }
}

const baseComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-heading text-5xl font-light tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-16 font-heading text-3xl font-light tracking-tight text-gray-900 dark:text-gray-100">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-10 font-heading text-xl font-light tracking-tight text-gray-900 dark:text-gray-100">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-4 leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 ml-4 space-y-2 leading-relaxed text-gray-700 dark:text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 ml-4 list-decimal space-y-3 pl-8 leading-relaxed text-gray-700 marker:text-lg marker:font-medium marker:text-gray-500 dark:text-gray-300 dark:marker:text-gray-400">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-6 before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400 dark:before:bg-gray-500 [ul>&]:before:block [ol>&]:before:hidden [ol>&]:pl-2">
      {children}
    </li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 font-mono text-sm text-gray-100 dark:bg-gray-800">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-gray-200 dark:border-gray-700" />,
}

const ledeComponents: Components = {
  ...baseComponents,
  p: ({ children }) => (
    <p className="text-xl leading-8 text-gray-600 dark:text-gray-400">{children}</p>
  ),
}

export function Markdown({ children, className }: MarkdownProps) {
  const { lede, body } = splitLede(children)

  return (
    <div className={className}>
      {lede && (
        <ReactMarkdown components={ledeComponents}>{lede}</ReactMarkdown>
      )}
      {body && (
        <ReactMarkdown components={baseComponents}>{body}</ReactMarkdown>
      )}
    </div>
  )
}
