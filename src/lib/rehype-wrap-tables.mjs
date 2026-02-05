import { visit } from 'unist-util-visit'

/**
 * Rehype plugin to:
 * 1. Add data-label attributes to cells for mobile display
 * 2. Wrap tables in a scrollable container
 */
export default function rehypeWrapTables() {
  return (tree) => {
    // Collect all tables first
    const tables = []
    visit(tree, 'element', (node) => {
      if (node.tagName === 'table') {
        tables.push(node)
      }
    })

    // Process each table
    for (const table of tables) {
      // Extract headers
      const headers = []
      const thead = findChild(table, 'thead')
      if (thead) {
        const tr = findChild(thead, 'tr')
        if (tr && tr.children) {
          for (const child of tr.children) {
            if (child.tagName === 'th') {
              headers.push(extractText(child))
            }
          }
        }
      }

      // Add labels to cells
      if (headers.length > 0) {
        const tbody = findChild(table, 'tbody')
        if (tbody && tbody.children) {
          for (const tr of tbody.children) {
            if (tr.tagName === 'tr' && tr.children) {
              let i = 0
              for (const td of tr.children) {
                if (td.tagName === 'td') {
                  td.properties = td.properties || {}
                  td.properties['data-label'] = headers[i] || ''
                  i++
                }
              }
            }
          }
        }
      }
    }

    // Wrap tables
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'table' && parent && typeof index === 'number') {
        if (parent.tagName === 'div' && parent.properties?.className?.includes('table-wrapper')) {
          return
        }
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrapper'] },
          children: [node],
        }
        parent.children[index] = wrapper
      }
    })
  }
}

function findChild(node, tagName) {
  if (!node || !node.children) return null
  return node.children.find(c => c.tagName === tagName)
}

function extractText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.value || ''
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractText).join('')
  }
  return ''
}
