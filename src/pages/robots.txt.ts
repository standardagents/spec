import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', site)}\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
