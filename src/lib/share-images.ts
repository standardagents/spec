import { getCollection } from 'astro:content'
import { getLatestVersion, groupTitles } from './content'
import homeMarkdown from '../data/home.md?raw'

// One share image per page. src/pages/og/[...image].png.ts renders each entry at
// build time, and BaseLayout.astro looks up the entry for its page. A page
// without an entry, such as the 404 page, uses the default /og.png.

// A run of title text. The homepage title marks part of its text as accent.
export interface TitleRun {
  text: string
  accent?: boolean
}

export interface ShareImage {
  // The page's path, without a trailing slash ("/" for the homepage).
  page: string
  // The image's path parameter under /og/, without the .png extension.
  image: string
  title: TitleRun[]
  // The navigation group, with the parent page for a nested page.
  section: string[]
  // The specification version, for versioned pages only.
  version?: string
  alt: string
}

// Labels on the image use sentence case.
function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

function firstHeading(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m)
  if (!match) throw new Error('A page has no first-level heading for its share image')
  return match[1].trim()
}

// Splits heading HTML into runs, and marks the text inside <span class="accent">.
export function parseTitle(heading: string): TitleRun[] {
  const runs: TitleRun[] = []
  const stack: boolean[] = []
  for (const part of heading.split(/(<[^>]+>)/)) {
    if (!part) continue
    if (part.startsWith('</')) {
      stack.pop()
    } else if (part.startsWith('<')) {
      stack.push(/class="[^"]*\baccent\b/.test(part))
    } else {
      const text = part.replace(/`/g, '').replace(/&amp;/g, '&')
      runs.push({ text, accent: stack.includes(true) })
    }
  }
  return runs
}

function plainTitle(runs: TitleRun[]): string {
  return runs.map((run) => run.text).join('')
}

function entry(page: string, title: TitleRun[], section: string[], version?: string): ShareImage {
  const image = page === '/' ? 'index' : page.slice(1)
  const where = [...section, version ? `version ${version}` : null].filter(Boolean).join(', ')
  return {
    page,
    image,
    title,
    section,
    version,
    alt: `${plainTitle(title).replace(/\.$/, '')}. ${where}. Standard Agent Specification.`,
  }
}

async function build(): Promise<ShareImage[]> {
  const docs = await getCollection('docs')
  const latest = await getLatestVersion()
  const titles = new Map(docs.map((doc) => [doc.id, firstHeading(doc.body || '')]))
  const startedLabel = sentenceCase(groupTitles['getting-started'])

  const images: ShareImage[] = [
    entry('/', parseTitle(firstHeading(homeMarkdown)), ['Overview'], latest),
    entry('/community', [{ text: 'Community' }], [startedLabel]),
    entry('/runtimes', [{ text: 'Runtimes' }], [startedLabel]),
    entry('/models', [{ text: 'Recommended Models' }], [startedLabel]),
  ]

  for (const doc of docs) {
    const [version, group, ...rest] = doc.id.split('/')
    const section = [sentenceCase(groupTitles[group] ?? group)]
    if (rest.length > 1) {
      const parent = titles.get([version, group, ...rest.slice(0, -1)].join('/'))
      if (parent) section.push(parent)
    }
    images.push(entry(`/${doc.id}`, parseTitle(titles.get(doc.id)!), section, version))
  }

  return images
}

let cached: Promise<ShareImage[]> | undefined

export function getShareImages(): Promise<ShareImage[]> {
  cached ??= build()
  return cached
}

export async function getShareImage(pathname: string): Promise<ShareImage | undefined> {
  const page = pathname.replace(/\/+$/, '') || '/'
  return (await getShareImages()).find((image) => image.page === page)
}
