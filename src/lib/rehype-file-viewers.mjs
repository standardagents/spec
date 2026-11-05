import { readFileSync } from 'node:fs'
import { visit } from 'unist-util-visit'

const CLIENT = readFileSync(new URL('./file-viewer-client.js', import.meta.url), 'utf8')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\n\s*\n/g, '\n')

const OPEN = /^<div data-file-viewer>\s*$/
const CLOSE = /^<\/div>\s*$/
const THREAD = /^<figure class="thread"/
const CHILD_THREAD = /^<figure class="thread" data-thread-child="([^"]+)"/
const CHILD_ROW = /<a class="thread-child-link" data-thread-child="([^"]+)">/g
const PATH_COMMENT = /^(?:\/\/|#) (\S+)$/
const FILE_LINK = /^(agents\/[^#]+\.ts|\.github\/[^#]+\.yml|package\.json)(?:#(.+))?$/
const DIAGRAM_LINK = /<a data-file="([^"]+)"(?: data-mark="([^"]+)")? data-name="([^"]+)">/g

const el = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children: children.map((child) => (typeof child === 'string' ? { type: 'text', value: child } : child)),
})

const textOf = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join('')

const slug = (path) => path.replace(/[^a-zA-Z0-9]+/g, '-')

/** A viewer treats the agents/ folder as its root. Links keep the full path. */
const fromRoot = (path) => path.replace(/^agents\//, '')

/**
 * Removes the first line of a highlighted block, which names its file. The
 * viewer shows that path in its tree and bar. The raw Markdown keeps the line.
 */
function stripPathLine(pre) {
  const code = pre.children.find((child) => child.tagName === 'code')
  const first = code.children.findIndex((child) => child.type === 'element')
  const next = code.children[first + 1]
  code.children.splice(first, next?.type === 'text' ? 2 : 1)
}

function readFile(pre) {
  const text = textOf(pre)
  const path = text.split('\n')[0].trim().match(PATH_COMMENT)?.[1]
  if (!path) throw new Error(`A file viewer block must start with a path comment: "${text.slice(0, 60)}"`)
  stripPathLine(pre)
  return { path, pre, text: textOf(pre) }
}

/** Nests sorted paths into folders. */
function buildTree(paths) {
  const root = { folders: new Map(), files: [] }
  for (const path of [...paths].sort()) {
    const parts = fromRoot(path).split('/')
    const name = parts.pop()
    let folder = root
    for (const part of parts) {
      if (!folder.folders.has(part)) folder.folders.set(part, { folders: new Map(), files: [] })
      folder = folder.folders.get(part)
    }
    folder.files.push({ name, path })
  }
  return root
}

function renderTree(folder, renderFile) {
  const items = [...folder.folders].map(([name, child]) =>
    el('li', {}, [el('span', { className: ['fv-folder'] }, [name]), renderTree(child, renderFile)]),
  )
  items.push(...folder.files.map((file) => el('li', {}, [renderFile(file)])))
  return el('ul', { className: ['fv-tree'] }, items)
}

/** Builds one viewer. A section's view is the thread, a child thread, or a file path. */
function renderViewer({ id, label, thread, children, files }) {
  const viewProps = (view, href) => ({ href, dataFvViewer: id, dataFvView: view })
  const fileLink = ({ name, path }) =>
    el('a', { className: ['fv-link', 'fv-link--file'], ...viewProps(path, `#${id}-${slug(path)}`) }, [name])
  const paths = files.map((file) => file.path)
  const isMainTree = (path) => path.startsWith('agents/') || !path.includes('/')
  const agentPaths = paths.filter(isMainTree)
  const otherPaths = paths.filter((path) => !isMainTree(path))
  const longest = Math.max(...files.map((file) => file.text.split('\n').length))
  const minHeight = `${Math.min(24, longest * 1.3 + 4.5).toFixed(2)}rem`

  const childLink = ({ name, view }) =>
    el('li', {}, [el('a', { className: ['fv-link', 'fv-link--child'], ...viewProps(view, `#${id}-${slug(view)}`) }, [name])])
  const threadPanel = (view, node) =>
    el('div', { className: ['fv-panel', 'fv-panel--thread'], id: `${id}-${slug(view)}`, dataFvView: view, tabIndex: -1 }, [node])

  const nav = el('nav', { className: ['fv-nav'], ariaLabel: `${label}: threads and files` }, [
    ...(thread
      ? [
          el('ul', { className: ['fv-tree'] }, [
            el('li', {}, [
              el('a', { className: ['fv-link', 'fv-link--thread'], ...viewProps('thread', `#${id}-thread`) }, ['Thread']),
              ...(children.length ? [el('ul', { className: ['fv-tree'] }, children.map(childLink))] : []),
            ]),
          ]),
        ]
      : []),
    el('div', { className: ['fv-files'] }, [
      el('span', { className: ['fv-files-title'] }, ['Files']),
    ]),
    renderTree(buildTree(agentPaths), fileLink),
    ...(otherPaths.length
      ? [
          el('div', { className: ['fv-files', 'fv-files--outside'] }, [
            el('span', { className: ['fv-files-title'] }, ['Outside agents/']),
          ]),
          renderTree(buildTree(otherPaths), fileLink),
        ]
      : []),
  ])

  const option = (value, text) => el('option', { value }, [text])
  const select = el('select', { className: ['fv-select'], ariaLabel: 'Choose a view', dataFvViewer: id }, [
    ...(thread ? [option('thread', 'Thread')] : []),
    ...children.map(({ name, view }) => option(view, `Thread / ${name}`)),
    el('optgroup', { label: 'Files' }, [...agentPaths].sort().map((path) => option(path, fromRoot(path)))),
    ...(otherPaths.length
      ? [el('optgroup', { label: 'Outside agents/' }, [...otherPaths].sort().map((path) => option(path, path)))]
      : []),
  ])

  const filePanel = ({ path, pre }) => {
    const parts = fromRoot(path).split('/')
    const name = parts.pop()
    return el(
      'section',
      {
        className: ['fv-panel', 'fv-panel--file'],
        id: `${id}-${slug(path)}`,
        dataFvView: path,
        ariaLabel: path,
      },
      [
        el('div', { className: ['fv-bar'] }, [
          el('span', { className: ['fv-path'] }, [parts.length ? `${parts.join(' / ')} / ` : '', el('b', {}, [name])]),
        ]),
        pre,
      ],
    )
  }

  return el('div', { className: ['fv'], id, style: `--fv-min:${minHeight}` }, [
    select,
    nav,
    el('div', { className: ['fv-panels'] }, [
      ...(thread ? [threadPanel('thread', thread)] : []),
      ...children.map(({ view, node }) => threadPanel(view, node)),
      ...files.map(filePanel),
    ]),
  ])
}

/**
 * Turns each `<div data-file-viewer>` block in a Markdown section into a file
 * viewer, and points that section's diagram and write-up links at it.
 *
 * In the Markdown, a viewer holds an optional ```thread fence and plain code
 * fences. A thread's child threads become views under it, and the parent's row
 * for each child opens that view. Each code fence starts with a comment that names its file, so the raw
 * Markdown endpoint keeps every path and block. A viewer holds every file its
 * section needs, so a file may repeat across viewers. A section's links open files
 * only in that section's viewer.
 *
 * Links name a file as a relative path, with an optional definition to highlight:
 *
 *   [`sessionStop`](agents/agents/issue_triage.ts#sessionStop)
 *   <a data-file="agents/agents/issue_triage.ts" data-mark="sessionStop" data-name="sessionStop rule">
 *
 * The first form is for Markdown and the second for src/diagrams. Each one
 * becomes an in-page link, so it works without script. A link to an unknown
 * file or definition fails the build.
 *
 * A file in a folder outside agents/, such as a CI workflow, has its own group in
 * the tree. A file with no folder, such as package.json, sits at the tree's top level.
 *
 * Runs after rehype-inline-diagrams and before rehype-raw.
 */
export default function rehypeFileViewers() {
  return (tree) => {
    if (!tree.children.some((node) => node.type === 'raw' && OPEN.test(node.value))) return

    const sections = [[]]
    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'h2') sections.push([])
      sections.at(-1).push(node)
    }

    let count = 0
    const output = []

    for (const section of sections) {
      const start = section.findIndex((node) => node.type === 'raw' && OPEN.test(node.value))
      if (start === -1) {
        output.push(...section)
        continue
      }
      const end = section.findIndex((node, index) => index > start && node.type === 'raw' && CLOSE.test(node.value))
      if (end === -1) throw new Error('A file viewer has no closing </div>')

      count += 1
      const id = `files-${count}`
      const inner = section.slice(start + 1, end)
      const threads = inner.filter((node) => node.type === 'raw' && THREAD.test(node.value))
      const threadNode = threads.find((node) => !CHILD_THREAD.test(node.value))
      const children = threads
        .filter((node) => node !== threadNode)
        .map((node) => {
          const name = node.value.match(CHILD_THREAD)[1]
          return { name, node, view: `thread/${name}` }
        })
      if (threadNode) {
        threadNode.value = threadNode.value.replace(CHILD_ROW, (row, name) => {
          const view = `thread/${name}`
          return row.replace('>', ` href="#${id}-${slug(view)}" data-fv-viewer="${id}" data-fv-view="${view}">`)
        })
      }
      const files = inner.filter((node) => node.tagName === 'pre').map(readFile)
      const known = new Map(files.map((file) => [file.path, file]))
      if (known.size !== files.length) throw new Error(`${id} repeats a file`)

      const heading = textOf(section[0]).replace(/^\d+\.\s*/, '')
      const viewer = renderViewer({ id, label: heading, thread: threadNode, children, files })

      const target = (path, mark) => {
        const file = known.get(path)
        if (!file) throw new Error(`${id} has no file ${path}`)
        if (mark && !file.text.includes(mark)) throw new Error(`${path} has no definition "${mark}"`)
        return `#${id}-${slug(path)}`
      }

      const nodes = [
        ...section.slice(0, start),
        viewer,
        {
          type: 'raw',
          value: `${count === 1 ? `<script>${CLIENT}</script>` : ''}<script>fileViewer(document.getElementById('${id}'))</script>`,
        },
        ...section.slice(end + 1),
      ]

      for (const node of nodes) {
        if (node === viewer) continue
        if (node.type === 'raw') {
          node.value = node.value.replace(DIAGRAM_LINK, (_, path, mark, name) => {
            const href = target(path, mark)
            const markAttribute = mark ? ` data-fv-mark="${mark}"` : ''
            return `<a class="dg-link" href="${href}" data-fv-viewer="${id}" data-fv-view="${path}"${markAttribute} aria-label="${name}, open ${path}"><title>${path}</title>`
          })
          continue
        }
        visit(node, 'element', (link) => {
          if (link.tagName !== 'a') return
          const match = String(link.properties?.href ?? '').match(FILE_LINK)
          if (!match) return
          const mark = match[2] ? decodeURIComponent(match[2]) : undefined
          link.properties.href = target(match[1], mark)
          link.properties.dataFvViewer = id
          link.properties.dataFvView = match[1]
          if (mark) link.properties.dataFvMark = mark
        })
      }
      output.push(...nodes)
    }
    tree.children = output
  }
}
