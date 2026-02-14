import { getCollection, type CollectionEntry } from 'astro:content'

export interface NavGroup {
  group: string
  title: string
  items: { slug: string; title: string; href: string }[]
}

// Group title mapping
const groupTitles: Record<string, string> = {
  'getting-started': 'Get Started',
  'specification': 'Specification',
  'infrastructure': 'Infrastructure',
  'distribution': 'Distribution',
}

// Group ordering
const groupOrder = ['getting-started', 'specification', 'infrastructure', 'distribution']

// Explicit page ordering within specification group (primitives -> complex)
const specOrder = ['providers', 'models', 'tools', 'prompts', 'agents', 'subagents', 'threads', 'hooks', 'type-registry']

// Pages to exclude from navigation (group/slug)
const excludedPages: Record<string, string[]> = {
  'infrastructure': ['providers'],
}

// Sort versions (newest first using semver-like comparison)
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA !== numB) return numB - numA
  }
  return 0
}

// Extract title from markdown (first H1)
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1] : 'Untitled'
}

// Format slug to title (fallback)
function slugToTitle(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Get all versions from content collection
export async function getVersions(): Promise<string[]> {
  const docs = await getCollection('docs')
  const versions = [...new Set(docs.map(d => d.id.split('/')[0]))]
  return versions.sort(compareVersions)
}

// Get the latest version
export async function getLatestVersion(): Promise<string> {
  const versions = await getVersions()
  return versions[0] || '0.1.0'
}

// Check if a page exists
export async function pageExists(version: string, group: string, slug: string): Promise<boolean> {
  const docs = await getCollection('docs')
  const id = `${version}/${group}/${slug}`
  return docs.some(d => d.id === id)
}

// Get navigation structure for a version
export async function getNavigation(version: string): Promise<NavGroup[]> {
  const docs = await getCollection('docs')
  const versionDocs = docs.filter(d => d.id.startsWith(`${version}/`))

  // Group documents by their group
  const groupedDocs: Record<string, CollectionEntry<'docs'>[]> = {}
  for (const doc of versionDocs) {
    const parts = doc.id.split('/')
    if (parts.length >= 3) {
      const group = parts[1]
      if (!groupedDocs[group]) {
        groupedDocs[group] = []
      }
      groupedDocs[group].push(doc)
    }
  }

  const nav: NavGroup[] = []

  for (const group of groupOrder) {
    const groupDocs = groupedDocs[group]
    if (!groupDocs || groupDocs.length === 0) continue

    // Filter out excluded pages
    const filteredDocs = groupDocs.filter(doc => {
      const parts = doc.id.split('/')
      const slug = parts[parts.length - 1]
      const excluded = excludedPages[group] || []
      return !excluded.includes(slug)
    })

    const items = filteredDocs.map(doc => {
      const parts = doc.id.split('/')
      const slug = parts[parts.length - 1]
      return {
        slug,
        title: extractTitle(doc.body || '') || slugToTitle(slug),
        href: `/${version}/${group}/${slug}`,
      }
    })

    // Sort items: 'overview' first, then by explicit order (for specification), then alphabetically
    items.sort((a, b) => {
      if (a.slug === 'overview') return -1
      if (b.slug === 'overview') return 1

      // Use explicit ordering for specification group
      if (group === 'specification') {
        const aIndex = specOrder.indexOf(a.slug)
        const bIndex = specOrder.indexOf(b.slug)
        // If both are in specOrder, sort by that order
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        // If only one is in specOrder, it comes first
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
      }

      return a.title.localeCompare(b.title)
    })

    nav.push({
      group,
      title: groupTitles[group] || slugToTitle(group),
      items,
    })
  }

  return nav
}

// Get the default page for a version (first page of first group)
export async function getDefaultPage(version: string): Promise<{ group: string; slug: string } | null> {
  const nav = await getNavigation(version)
  if (nav.length > 0 && nav[0].items.length > 0) {
    return { group: nav[0].group, slug: nav[0].items[0].slug }
  }
  return null
}

// Get all docs for generating static paths
export async function getAllDocs() {
  return await getCollection('docs')
}

// Get prev/next page navigation
export interface PageNavItem {
  title: string
  href: string
  group: string
}

export async function getPrevNextPages(
  version: string,
  currentPath: string
): Promise<{ prev: PageNavItem | null; next: PageNavItem | null }> {
  const nav = await getNavigation(version)

  // Flatten all pages into a single ordered list
  const allPages: PageNavItem[] = []
  for (const group of nav) {
    for (const item of group.items) {
      allPages.push({
        title: item.title,
        href: item.href,
        group: group.title,
      })
    }
  }

  // Find current page index
  const currentIndex = allPages.findIndex(p => p.href === currentPath)

  if (currentIndex === -1) {
    return { prev: null, next: null }
  }

  return {
    prev: currentIndex > 0 ? allPages[currentIndex - 1] : null,
    next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
  }
}
