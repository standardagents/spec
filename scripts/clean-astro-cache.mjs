import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

for (const relativePath of ['.astro', 'node_modules/.astro', 'node_modules/.vite']) {
  rmSync(resolve(rootDir, relativePath), { recursive: true, force: true })
}
