import { readFileSync } from 'node:fs'
import { visit } from 'unist-util-visit'

const DIAGRAMS = new URL('../diagrams/', import.meta.url)
const MARKER = /<figure data-diagram="([a-z0-9-]+)"([^>]*)><\/figure>/

const HANDLES = ['tl', 'tr', 'bl', 'br']
  .map((corner) => `<i class="story-frame-handle" data-corner="${corner}" aria-hidden="true"></i>`)
  .join('')

/**
 * Replaces a diagram marker in Markdown with its SVG source from src/diagrams.
 *
 * The marker keeps SVG out of the page's raw Markdown endpoint, where coding
 * agents would read it as noise. They read the marker's aria-label, which is
 * also the description for screen readers. A diagram's links open files in the
 * section's viewer, and rehype-file-viewers.mjs resolves them. They work without
 * script.
 *
 * Runs before rehype-raw, so the marker is still an unparsed raw node here.
 */
export default function rehypeInlineDiagrams() {
  return (tree) => {
    visit(tree, 'raw', (node) => {
      const match = node.value.match(MARKER)
      if (!match) return
      const [marker, name, attributes] = match
      const source = readFileSync(new URL(`${name}.html`, DIAGRAMS), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
      node.value = node.value.replace(
        marker,
        `<figure class="diagram story-frame" role="group"${attributes}>${HANDLES}${source}</figure>`,
      )
    })
  }
}
