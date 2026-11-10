import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs'
import rehypeInlineDiagrams from './src/lib/rehype-inline-diagrams.mjs'
import rehypeFileViewers from './src/lib/rehype-file-viewers.mjs'
import remarkFauxThreads from './src/lib/remark-faux-threads.mjs'
import latestRedirects from './src/lib/latest-redirects.mjs'

export default defineConfig({
  site: 'https://standardagentspec.org',
  output: 'static',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    react(),
    sitemap({
      // The 404 page and the /{version} redirect pages are not content.
      filter: (page) => !/\/404\/?$|\/\d+\.\d+\.\d+\/?$/.test(page),
    }),
    latestRedirects(),
  ],
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['macbookserver.tail13bd39.ts.net'],
    },
    preview: {
      allowedHosts: ['macbookserver.tail13bd39.ts.net'],
    },
  },
  markdown: {
    remarkPlugins: ['remark-gfm', remarkFauxThreads],
    rehypePlugins: [rehypeWrapTables, rehypeInlineDiagrams, rehypeFileViewers],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'night-owl',
      },
      defaultColor: false,
    },
  },
})
