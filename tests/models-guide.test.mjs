// Checks the reader of the models guide's data block against malformed input.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseModelsGuide } from '../src/lib/models.ts'

const guide = readFileSync(fileURLToPath(new URL('../src/data/models.md', import.meta.url)), 'utf8')
const data = () => JSON.parse(/```json\n([\s\S]*?)\n```/.exec(guide.slice(guide.indexOf('\n## Data')))[1])
const withData = (value) => `# Guide\n\n## Data\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n`

function rejects(change, pattern) {
  const value = data()
  change(value)
  assert.throws(() => parseModelsGuide(withData(value)), pattern)
}

test('the published guide parses', () => {
  const parsed = parseModelsGuide(guide)
  assert.ok(parsed.categories.length > 0)
  assert.deepEqual(parseModelsGuide(withData(data())), parsed)
})

test('a malformed guide is rejected', () => {
  assert.throws(() => parseModelsGuide('# Guide'), /no json block/)
  rejects((d) => delete d.recommendations[0].name, /recommendations\[0\]\.name/)
  rejects((d) => (d.recommendations[0].openWeights = 'false'), /openWeights must be true or false/)
  rejects((d) => d.categories.push({ ...d.categories[0] }), /is listed twice/)
  rejects((d) => (d.recommendations[0].category = 'vibes'), /unknown category/)
  rejects((d) => d.recommendations.push({ ...d.recommendations[0] }), /has two recommendations/)
  rejects((d) => (d.recommendations[0].modalities.input = ['smell']), /modalities\.input/)
  rejects((d) => (d.recommendations[0].alternatives = [{ name: 'Other' }]), /alternatives\[0\]\.provider/)
  rejects((d) => (d.models[0].price = ''), /models\[0\]\.price/)
  rejects((d) => (d.updated = 'today'), /YYYY-MM-DD/)
})
