import { SKIP, visit } from 'unist-util-visit'

/**
 * Renders a ```thread fence as a static illustration of a conversation.
 *
 * The fence is the only source of a thread's text. The rendered page shows it
 * as a conversation, and the page's raw Markdown endpoint keeps it as a plain
 * transcript, so the two cannot drift apart.
 *
 * Each line is `kind: text`. Indentation is ignored. Backticks mark inline code.
 *
 *   agent: agent_name           Required first line. Names the running agent.
 *   person: A message from the human side.
 *   model: A text reply from the model.
 *   side: name | text           A message from the other side, when no person sends it.
 *   code: name | text           A reply from a handler or an effect.
 *   tool: name | summary | optional arguments | optional result
 *   tool b: the same, for a tool call from side B. It aligns with side B's messages.
 *   child: agent_name | status | result   Starts a child thread.
 *   parent: text                The first message a child gets from its parent.
 *   wait: text                  The session waits here.
 *   end child:                  Ends the child thread.
 *
 * A thread stays a conversation. Rules and runtime behavior belong in the
 * diagram and the write-up.
 *
 * A child thread becomes its own figure after its parent's figure. The parent
 * shows one row with the child's status and result.
 *
 * Inside a file viewer, rehype-file-viewers.mjs shows the thread as the viewer's
 * first view, each child thread as a view under it, and links each row to its
 * child's view. To remove a thread, delete its fence, and the viewer then opens on
 * its first file. To remove the feature, also delete this file, its entry in
 * astro.config.mjs, and the "Faux threads" block in src/styles/global.css.
 */
export default function remarkFauxThreads() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'thread') return
      const figures = renderThread(node.value).map((value) => ({ type: 'html', value }))
      parent.children.splice(index, 1, ...figures)
      return [SKIP, index + figures.length]
    })
  }
}

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const inline = (text) => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')

function parseLine(line) {
  const separator = line.indexOf(':')
  if (separator === -1) throw new Error(`Thread line has no kind: "${line}"`)
  return { kind: line.slice(0, separator), text: line.slice(separator + 1).trim() }
}

const hidden = (text) => `<span class="thread-hidden">${text}</span>`

/** One quiet line. Its arguments and result stay behind a native disclosure. */
function renderTool(text, className = 'thread-quiet') {
  const [name, summary, args, result] = text.split(' | ')
  if (!summary) throw new Error(`Thread tool line needs a summary: "${text}"`)
  const title = `<span class="thread-tool-name">${escapeHtml(name)}</span> ${inline(summary)}`
  if (!args) return `<li class="${className}">${title}</li>`
  return (
    `<li class="${className}"><details class="thread-tool"><summary>${title}</summary>` +
    `<div class="thread-tool-detail">${escapeHtml(args)}` +
    (result ? `<span class="thread-tool-result">${escapeHtml(result)}</span>` : '') +
    `</div></details></li>`
  )
}

/** A message with its sender's name above it. */
function renderNamed(className, text) {
  const separator = text.indexOf(' | ')
  if (separator === -1) throw new Error(`Thread line needs a name and a message: "${text}"`)
  const name = text.slice(0, separator)
  return (
    `<li class="${className}"><span class="thread-from">${escapeHtml(name)}</span>` +
    `<p>${inline(text.slice(separator + 3))}</p></li>`
  )
}

function renderEvent(kind, text, parentName) {
  if (kind === 'person')
    return `<li class="thread-person">${hidden('Person: ')}<p>${inline(text)}</p></li>`
  if (kind === 'model')
    return `<li class="thread-model">${hidden('Model: ')}<p>${inline(text)}</p></li>`
  if (kind === 'side') return renderNamed('thread-person', text)
  if (kind === 'code') return renderNamed('thread-model thread-code', text)
  if (kind === 'tool') return renderTool(text)
  if (kind === 'tool b') return renderTool(text, 'thread-quiet thread-quiet--b')
  if (kind === 'parent')
    return `<li class="thread-quiet">From <span class="thread-tool-name">${escapeHtml(parentName)}</span>: ${inline(text)}</li>`
  if (kind === 'wait') return `<li class="thread-quiet">${inline(text)}</li>`
  throw new Error(`Unknown thread line kind: "${kind}"`)
}

/** One row in the parent. rehype-file-viewers.mjs adds its link target. */
function renderChildRow(text) {
  const [name, status, result] = text.split(' | ')
  if (!result) throw new Error(`Thread child line needs a status and a result: "${text}"`)
  return (
    `<li class="thread-child"><a class="thread-child-link" data-thread-child="${escapeHtml(name)}">` +
    `${hidden('Child thread: ')}<span class="thread-name">${escapeHtml(name)}</span> ` +
    `<span class="thread-child-status">${inline(status)}</span>` +
    `<span class="thread-child-result">${inline(result)}</span></a></li>`
  )
}

const renderFigure = (attributes, bar, items) =>
  `<figure class="thread"${attributes}><div class="thread-panel"><div class="thread-bar">${bar}</div>` +
  `<ol class="thread-list">${items}</ol></div></figure>`

function renderThread(source) {
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean).map(parseLine)
  const [agent, ...rest] = lines
  if (agent?.kind !== 'agent') throw new Error('A thread must start with an agent line')

  const children = []
  let items = ''
  let child = null
  for (const { kind, text } of rest) {
    if (kind === 'child') {
      if (child) throw new Error('A child thread cannot hold another child thread')
      items += renderChildRow(text)
      child = { name: text.split(' | ')[0], items: '' }
    } else if (kind === 'end child') {
      children.push(child)
      child = null
    } else if (child) {
      child.items += renderEvent(kind, text, agent.text)
    } else {
      items += renderEvent(kind, text, agent.text)
    }
  }
  if (child) throw new Error('A child thread has no end child line')

  return [
    renderFigure('', `<span class="thread-name">${escapeHtml(agent.text)}</span>`, items),
    ...children.map(({ name, items: childItems }) =>
      renderFigure(
        ` data-thread-child="${escapeHtml(name)}"`,
        `<span class="thread-name">${escapeHtml(name)}</span> <span class="thread-bar-note">child thread</span>`,
        childItems,
      ),
    ),
  ]
}
