// Load all markdown files across all versions at build time
const contentModules = import.meta.glob(
  '../../content/**/*.md',
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

export interface PageInfo {
  content: string
  group: string
  slug: string
  title: string
}

export interface NavGroup {
  group: string
  title: string
  items: { slug: string; title: string; href: string }[]
}

interface VersionedContent {
  [version: string]: {
    [group: string]: {
      [slug: string]: string
    }
  }
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

// Explicit page ordering within specification group (primitives → complex)
const specOrder = ['providers', 'models', 'tools', 'prompts', 'agents', 'threads', 'hooks']

// Parse all content into versioned structure
const versionedContent: VersionedContent = {}

for (const [path, content] of Object.entries(contentModules)) {
  // Path format: "../../content/0.1.0/specification/agents.md"
  const match = path.match(/\.\.\/\.\.\/content\/([^/]+)\/([^/]+)\/([^/]+)\.md$/)
  if (match) {
    const [, version, group, slug] = match
    if (!versionedContent[version]) {
      versionedContent[version] = {}
    }
    if (!versionedContent[version][group]) {
      versionedContent[version][group] = {}
    }
    versionedContent[version][group][slug] = content
  }
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

export const versions = Object.keys(versionedContent).sort(compareVersions)
export const latestVersion = versions[0] || '0.1.0'

// Get content for a specific page
export function getContent(version: string, group: string, slug: string): string | null {
  return versionedContent[version]?.[group]?.[slug] || null
}

// Check if a page exists
export function pageExists(version: string, group: string, slug: string): boolean {
  return !!versionedContent[version]?.[group]?.[slug]
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

// Get navigation structure for a version
export function getNavigation(version: string): NavGroup[] {
  const versionContent = versionedContent[version]
  if (!versionContent) return []

  const nav: NavGroup[] = []

  for (const group of groupOrder) {
    const groupContent = versionContent[group]
    if (!groupContent) continue

    const items = Object.entries(groupContent).map(([slug, content]) => ({
      slug,
      title: extractTitle(content) || slugToTitle(slug),
      href: `/${version}/${group}/${slug}`,
    }))

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
export function getDefaultPage(version: string): { group: string; slug: string } | null {
  const nav = getNavigation(version)
  if (nav.length > 0 && nav[0].items.length > 0) {
    return { group: nav[0].group, slug: nav[0].items[0].slug }
  }
  return null
}
