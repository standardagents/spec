import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '../context/ThemeContext'

// Create a modified oneLight theme with no token backgrounds
const oneLightNoBackground = Object.fromEntries(
  Object.entries(oneLight).map(([key, value]) => [
    key,
    typeof value === 'object' ? { ...value, background: 'transparent' } : value,
  ])
) as typeof oneLight

interface MarkdownProps {
  children: string
  className?: string
  compact?: boolean
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

function createComponents(theme: 'light' | 'dark', compact?: boolean): Components {
  return {
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
      <h3 className="mt-10 font-sans text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-6 font-sans text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="mt-4 text-base leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mt-4 ml-4 space-y-2 text-base leading-relaxed text-gray-700 dark:text-gray-300">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-4 ml-4 list-decimal space-y-3 pl-8 text-base leading-relaxed text-gray-700 marker:text-base marker:font-medium marker:text-gray-500 dark:text-gray-300 dark:marker:text-gray-400">
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
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '')
      const isInline = !match && !className

      if (isInline) {
        return (
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {children}
          </code>
        )
      }

      const language = match ? match[1] : 'text'
      const codeString = String(children).replace(/\n$/, '')

      return (
        <SyntaxHighlighter
          style={theme === 'dark' ? oneDark : oneLightNoBackground}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            background: theme === 'dark' ? undefined : '#ECEDEE',
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      )
    },
    pre: ({ children }) => (
      <div className="mt-4 overflow-x-auto">
        {children}
      </div>
    ),
    blockquote: ({ children }) => {
      // Check if this is a callout (Tip, Note, Warning, etc.)
      const childArray = Array.isArray(children) ? children : [children]
      const firstChild = childArray[0]

      // Extract text content to check for callout pattern
      let textContent = ''
      if (firstChild && typeof firstChild === 'object' && 'props' in firstChild) {
        const props = firstChild.props as { children?: React.ReactNode }
        if (props.children) {
          const innerChildren = Array.isArray(props.children) ? props.children : [props.children]
          for (const child of innerChildren) {
            if (typeof child === 'string') {
              textContent += child
            } else if (child && typeof child === 'object' && 'props' in child) {
              const childProps = child.props as { children?: React.ReactNode }
              if (typeof childProps.children === 'string') {
                textContent += childProps.children
              }
            }
          }
        }
      }

      // Check for callout patterns
      const tipMatch = textContent.match(/^💡\s*Tip:/i)
      const noteMatch = textContent.match(/^ℹ️?\s*Note:/i)
      const warnMatch = textContent.match(/^⚠️?\s*Warning:/i)

      if (tipMatch || noteMatch) {
        return (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <div className="text-sm text-blue-800 dark:text-blue-200 [&>p]:mt-0 [&>p]:not-italic">
              {children}
            </div>
          </div>
        )
      }

      if (warnMatch) {
        return (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <div className="text-sm text-amber-800 dark:text-amber-200 [&>p]:mt-0 [&>p]:not-italic">
              {children}
            </div>
          </div>
        )
      }

      // Default blockquote styling
      return (
        <blockquote className="mt-4 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
          {children}
        </blockquote>
      )
    },
    hr: () => <hr className="my-8 border-gray-200 dark:border-gray-700" />,
    table: ({ children }) => (
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {children}
      </tbody>
    ),
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {children}
      </td>
    ),
  }
}

function createLedeComponents(theme: 'light' | 'dark'): Components {
  return {
    ...createComponents(theme),
    p: ({ children }) => (
      <p className="text-xl leading-8 text-gray-600 dark:text-gray-400">{children}</p>
    ),
  }
}

export function Markdown({ children, className, compact }: MarkdownProps) {
  const { theme } = useTheme()
  const { lede, body } = splitLede(children)
  const baseComponents = createComponents(theme, compact)
  const ledeComponents = createLedeComponents(theme)

  return (
    <div className={className}>
      {lede && (
        <ReactMarkdown components={ledeComponents} remarkPlugins={[remarkGfm]}>
          {lede}
        </ReactMarkdown>
      )}
      {body && (
        <ReactMarkdown components={baseComponents} remarkPlugins={[remarkGfm]}>
          {body}
        </ReactMarkdown>
      )}
    </div>
  )
}
