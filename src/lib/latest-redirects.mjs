import { appendFile, readdir } from 'node:fs/promises'

// Links to specification pages from outside a version use /latest/. Pages built
// by this site resolve them at build time. This integration adds Cloudflare Pages
// redirects, so a /latest/ URL typed or linked from elsewhere works too.
export default function latestRedirects() {
  return {
    name: 'latest-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const names = await readdir(new URL('../../content/', import.meta.url))
        const [latest] = names
          .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        if (!latest) throw new Error('No version folder found in content/')
        // The homepage is the Overview of the latest version.
        const rules = ['/latest / 302', `/latest/* /${latest}/:splat 302`]
        await appendFile(new URL('_redirects', dir), `\n${rules.join('\n')}\n`)
      },
    },
  }
}
