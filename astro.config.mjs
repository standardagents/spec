import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs'
import rehypeInlineDiagrams from './src/lib/rehype-inline-diagrams.mjs'
import rehypeFileViewers from './src/lib/rehype-file-viewers.mjs'
import remarkFauxThreads from './src/lib/remark-faux-threads.mjs'

export default defineConfig({
  site: 'https://standardagentspec.org',
  output: 'static',
  integrations: [react()],
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
