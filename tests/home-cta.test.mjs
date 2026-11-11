// Checks the homepage call to action in the built site in dist/.
// Run `pnpm build` first.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(`../dist/${path}`, import.meta.url)), 'utf8')

// The specification is documentation. It has no coding-agent skill, and a
// reader starts in a runtime, so the homepage sends readers to the runtimes page.
for (const page of ['index.html', 'index.md']) {
  test(`${page} offers no skill install`, () => {
    const content = read(page)
    assert.doesNotMatch(content, /skills add/)
    assert.doesNotMatch(content, /skills@spec/)
    assert.doesNotMatch(content, /Install the (Standard Agent Specification )?skill/i)
  })

  test(`${page} points readers to the runtimes page`, () => {
    const content = read(page)
    assert.ok(content.includes('Choose a runtime to build with'))
    assert.match(content, /\/runtimes/)
  })

  test(`${page} gives no instruction to paste into a coding agent`, () => {
    assert.doesNotMatch(read(page), /Give the specification to your coding agent/)
  })
}

test('the main card links to the runtimes page', () => {
  assert.match(read('index.html'), /<a href="\/runtimes" class="cta-card runtime-cta">/)
})
