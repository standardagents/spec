import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs'

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
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [rehypeWrapTables],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'night-owl',
      },
      defaultColor: false,
    },
  },
})
