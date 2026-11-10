import type { APIRoute } from 'astro'
import { getLatestVersion, resolveLatestLinks } from '../lib/content'
import { rawContent } from '../data/runtimes.md'

export const GET: APIRoute = async () =>
  new Response(resolveLatestLinks(rawContent(), await getLatestVersion()), {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
