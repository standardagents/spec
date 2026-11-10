// Checks the homepage call to action in the built site in dist/.
// Run `pnpm build` first.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(`../dist/${path}`, import.meta.url)), 'utf8')

const INSTRUCTION =
  'Read https://standardagentspec.org/llms.txt and the pages it lists before you write or review a Standard Agent.'

// The specification is documentation. It has no coding-agent skill, so the
// homepage hands coding agents the documentation index instead of an install.
for (const page of ['index.html', 'index.md']) {
  test(`${page} offers no skill install`, () => {
    const content = read(page)
    assert.doesNotMatch(content, /skills add/)
    assert.doesNotMatch(content, /skills@spec/)
    assert.doesNotMatch(content, /Install the (Standard Agent Specification )?skill/i)
  })

  test(`${page} gives coding agents the documentation index`, () => {
    assert.ok(read(page).includes(INSTRUCTION))
  })
}

test('the copy button copies the instruction shown', () => {
  const html = read('index.html')
  assert.ok(html.includes(`data-copy-command="${INSTRUCTION}"`))
  assert.ok(html.includes('Give the specification to your coding agent'))
})
