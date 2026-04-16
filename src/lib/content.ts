import { getCollection, type CollectionEntry } from 'astro:content'

export interface NavItem {
  slug: string
  title: string
  href: string
  children?: NavItem[]
}

export interface NavGroup {
  group: string
  title: string
  items: NavItem[]
}

// Group title mapping
const groupTitles: Record<string, string> = {
  'getting-started': 'Get Started',
  'guides': 'Guides',
  'specification': 'Specification',
  'infrastructure': 'Infrastructure',
  'distribution': 'Distribution',
}

// Group ordering
const groupOrder = ['getting-started', 'guides', 'specification', 'infrastructure', 'distribution']

// Explicit page ordering within specification group (primitives -> complex)
const specOrder = ['providers', 'models', 'tools', 'effects', 'prompts', 'agents', 'threads', 'hooks', 'type-registry']

// Explicit ordering of subpages under a parent slug (per group)
// Key is "{group}/{parent}", value is the ordered list of child slugs.
const subpageOrder: Record<string, string[]> = {
  'specification/threads': [
    'messages',
    'filesystem',
    'code-execution',
    'execution-state',
    'endpoints',
  ],
}

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

type DocEntry = CollectionEntry<'docs'>

interface BuiltItem extends NavItem {
  _orderKey: string
}

function buildItem(doc: DocEntry, version: string): { group: string; parent: string | null; slug: string; item: BuiltItem } | null {
  const parts = doc.id.split('/')
  // parts = [version, group, ...rest]
  if (parts.length < 3 || parts[0] !== version) return null

  const group = parts[1]
  // rest is the path after the group
  const rest = parts.slice(2)
  // We only support top-level (rest.length === 1) and one level of nesting (rest.length === 2)
  if (rest.length === 1) {
    const slug = rest[0]
    return {
      group,
      parent: null,
      slug,
      item: {
        slug,
        title: extractTitle(doc.body || '') || slugToTitle(slug),
        href: `/${version}/${group}/${slug}`,
        _orderKey: slug,
      },
    }
  }
  if (rest.length === 2) {
    const parent = rest[0]
    const slug = rest[1]
    return {
      group,
      parent,
      slug,
      item: {
        slug,
        title: extractTitle(doc.body || '') || slugToTitle(slug),
        href: `/${version}/${group}/${parent}/${slug}`,
        _orderKey: slug,
      },
    }
  }
  return null
}

// Get navigation structure for a version
export async function getNavigation(version: string): Promise<NavGroup[]> {
  const docs = await getCollection('docs')
  const versionDocs = docs.filter(d => d.id.startsWith(`${version}/`))

  // Bucket: top-level items by group, and children keyed by "group/parent"
  const topLevelByGroup: Record<string, BuiltItem[]> = {}
  const childrenByParent: Record<string, BuiltItem[]> = {}

  for (const doc of versionDocs) {
    const built = buildItem(doc, version)
    if (!built) continue

    // Apply exclusion (top-level only — subpage exclusion not yet needed)
    if (built.parent === null) {
      const excluded = excludedPages[built.group] || []
      if (excluded.includes(built.slug)) continue
      topLevelByGroup[built.group] ??= []
      topLevelByGroup[built.group].push(built.item)
    } else {
      const key = `${built.group}/${built.parent}`
      childrenByParent[key] ??= []
      childrenByParent[key].push(built.item)
    }
  }

  // Attach children to their matching top-level items
  for (const group of Object.keys(topLevelByGroup)) {
    for (const item of topLevelByGroup[group]) {
      const key = `${group}/${item.slug}`
      const kids = childrenByParent[key]
      if (!kids || kids.length === 0) continue

      const order = subpageOrder[key] || []
      kids.sort((a, b) => {
        const ai = order.indexOf(a.slug)
        const bi = order.indexOf(b.slug)
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return a.title.localeCompare(b.title)
      })
      // Strip the internal order key before exposing
      item.children = kids.map(k => ({ slug: k.slug, title: k.title, href: k.href }))
    }
  }

  const nav: NavGroup[] = []

  for (const group of groupOrder) {
    const groupDocs = topLevelByGroup[group]
    if (!groupDocs || groupDocs.length === 0) continue

    // Sort items: 'overview' first, then by explicit order (for specification), then alphabetically
    groupDocs.sort((a, b) => {
      if (a.slug === 'overview') return -1
      if (b.slug === 'overview') return 1

      if (group === 'specification') {
        const aIndex = specOrder.indexOf(a.slug)
        const bIndex = specOrder.indexOf(b.slug)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
      }

      return a.title.localeCompare(b.title)
    })

    nav.push({
      group,
      title: groupTitles[group] || slugToTitle(group),
      items: groupDocs.map(({ _orderKey, ...item }) => item),
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

  // Flatten all pages into a single ordered list: parent, then its children, before the next sibling.
  const allPages: PageNavItem[] = []
  for (const group of nav) {
    for (const item of group.items) {
      allPages.push({ title: item.title, href: item.href, group: group.title })
      if (item.children) {
        for (const child of item.children) {
          allPages.push({ title: child.title, href: child.href, group: group.title })
        }
      }
    }
  }

  const currentIndex = allPages.findIndex(p => p.href === currentPath)
  if (currentIndex === -1) {
    return { prev: null, next: null }
  }

  return {
    prev: currentIndex > 0 ? allPages[currentIndex - 1] : null,
    next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
  }
}
