import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Plugin to serve and copy markdown files
function markdownPlugin(): Plugin {
  return {
    name: 'markdown-files',
    configureServer(server) {
      // Serve markdown files in dev mode
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.md')) {
          const filePath = path.join(process.cwd(), 'content', req.url)
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
            res.end(fs.readFileSync(filePath, 'utf-8'))
            return
          }
        }
        next()
      })
    },
    closeBundle() {
      // Copy markdown files to dist during build
      const contentDir = path.join(process.cwd(), 'content')
      const distDir = path.join(process.cwd(), 'dist')

      function copyMarkdownFiles(dir: string, relativePath = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const srcPath = path.join(dir, entry.name)
          const destRelativePath = path.join(relativePath, entry.name)
          if (entry.isDirectory()) {
            copyMarkdownFiles(srcPath, destRelativePath)
          } else if (entry.name.endsWith('.md')) {
            const destPath = path.join(distDir, destRelativePath)
            fs.mkdirSync(path.dirname(destPath), { recursive: true })
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }

      if (fs.existsSync(contentDir)) {
        copyMarkdownFiles(contentDir)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    markdownPlugin(),
  ],
  build: {
    outDir: 'dist',
  },
})
