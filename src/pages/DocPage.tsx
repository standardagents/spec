import { useParams, Navigate } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { PageActions } from '../components/PageActions'
import { getContent, getDefaultPage, latestVersion, versions } from '../lib/content'

export function DocPage() {
  const { version, group, slug } = useParams()

  // Use latest version if not specified
  const currentVersion = version && versions.includes(version) ? version : latestVersion

  // If no group/slug, redirect to default page for this version
  if (!group || !slug) {
    const defaultPage = getDefaultPage(currentVersion)
    if (defaultPage) {
      return <Navigate to={`/${currentVersion}/${defaultPage.group}/${defaultPage.slug}`} replace />
    }
    return <Navigate to="/" replace />
  }

  const content = getContent(currentVersion, group, slug)

  if (!content) {
    // Page doesn't exist, redirect to default
    const defaultPage = getDefaultPage(currentVersion)
    if (defaultPage) {
      return <Navigate to={`/${currentVersion}/${defaultPage.group}/${defaultPage.slug}`} replace />
    }
    return <Navigate to="/" replace />
  }

  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1] : slug.charAt(0).toUpperCase() + slug.slice(1)

  // Strip the h1 from content since we render it separately
  const bodyContent = content.replace(/^#\s+.+\n+/, '')

  const isOverview = slug === 'overview' && group === 'getting-started'

  return (
    <article className="max-w-prose">
      <div className="mb-8 flex items-start justify-between">
        <h1 className="font-heading text-4xl font-light tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
          {title}
        </h1>
        <PageActions content={content} />
      </div>

      <Markdown>{bodyContent}</Markdown>

      {isOverview && (
        <div className="mt-12">
          <a
            href={`/${currentVersion}/specification/agents`}
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Explore the Specification
          </a>
        </div>
      )}
    </article>
  )
}
