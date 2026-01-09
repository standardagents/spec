import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: 'content',
    generateId: ({ entry }) => {
      // Preserve the original path structure including dots in version numbers
      return entry.replace(/\.md$/, '')
    }
  }),
})

export const collections = { docs }
