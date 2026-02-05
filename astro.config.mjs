import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs'

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
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
