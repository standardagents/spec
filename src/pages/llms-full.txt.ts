import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { getLatestVersion, getNavigation, resolveLatestLinks } from '../lib/content'
import { rawContent as homeContent } from '../data/home.md'
import { rawContent as communityContent } from '../data/community.md'
import { rawContent as runtimesContent } from '../data/runtimes.md'
import modelsContent from '../data/models.md?raw'

// Every page of the latest version as Markdown, in navigation order, for
// coding agents and answer engines that read a whole site in one request.
// llms.txt lists the same pages as separate links.
const unversioned: Record<string, () => string> = {
  '/': homeContent,
  '/community': communityContent,
  '/runtimes': runtimesContent,
  // The Recommended Models page is built from the models guide, so the guide is its Markdown.
  '/models': () => modelsContent,
}

export const GET: APIRoute = async ({ site }) => {
  // The canonical origin is `site` in astro.config.mjs.
  const BASE_URL = site!.origin
  const latestVersion = await getLatestVersion()
  const navigation = await getNavigation(latestVersion)
  const bodies = new Map((await getCollection('docs')).map(doc => [`/${doc.id}`, doc.body ?? '']))

  const hrefs = navigation.flatMap(group =>
    group.items.flatMap(item => [item.href, ...(item.children ?? []).map(child => child.href)]),
  )

  const sections = hrefs.map((href) => {
    const body = unversioned[href]
      ? resolveLatestLinks(unversioned[href](), latestVersion)
      : bodies.get(href)
    if (body === undefined) throw new Error(`llms-full.txt: no content for ${href}`)
    return `Source: ${BASE_URL}${href}\n\n${body.trim()}\n`
  })

  const header = [
    '# Standard Agent Specification',
    '',
    `Latest version: ${latestVersion}. This file holds every page of the latest version as Markdown, in navigation order. Each page starts with its source URL.`,
    '',
  ].join('\n')

  return new Response(`${header}\n${sections.join('\n---\n\n')}`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
