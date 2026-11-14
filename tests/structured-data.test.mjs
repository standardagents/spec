import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const origin = 'https://standardagentspec.org'
const organizationId = 'https://standardagents.ai/#organization'
const versions = readdirSync(new URL('content/', root)).filter(name => /^\d+\.\d+\.\d+$/.test(name))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
const latest = versions[0]

function graph(path) {
  const html = readFileSync(new URL(`dist/${path}`, root), 'utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length, 1, path)
  const data = JSON.parse(scripts[0][1])
  assert.equal(data['@context'], 'https://schema.org')
  const nodes = data['@graph']
  assert.equal(new Set(nodes.map(node => node['@id'])).size, nodes.length)
  assert.equal(nodes.find(node => node['@type'] === 'WebPage').url,
    html.match(/<link rel="canonical" href="([^"]+)"/)[1])
  return type => nodes.find(node => node['@type'] === type)
}

function docIds(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? docIds(join(directory, entry.name), `${prefix}${entry.name}/`)
    : entry.name.endsWith('.md') ? [`${prefix}${entry.name.slice(0, -3)}`] : [])
}

test('the homepage identifies the latest specification and shared publisher', () => {
  const node = graph('index.html')
  assert.equal(node('WebSite')['@id'], `${origin}/#website`)
  assert.equal(node('WebSite').publisher['@id'], organizationId)
  assert.equal(node('Organization')['@id'], organizationId)
  assert.equal(node('Organization').name, 'Standard Agents')
  assert.ok(node('Organization').sameAs.includes('https://github.com/standardagents'))
  assert.equal(node('CreativeWork')['@id'], `${origin}/#specification`)
  assert.equal(node('CreativeWork').version, latest)
  assert.equal(node('WebPage').about['@id'], `${origin}/#specification`)
  assert.equal(node('BreadcrumbList'), undefined)
})

test('every versioned page belongs to its specification and has valid breadcrumbs', () => {
  for (const version of versions) {
    const ids = docIds(fileURLToPath(new URL(`content/${version}`, root))).map(id => `${version}/${id}`)
    const specificationId = `${origin}/${version === latest ? '' : `${version}/`}#specification`
    const parts = ids.map(id => `${origin}/${id}/#webpage`).sort()
    for (const id of ids) {
      const node = graph(`${id}/index.html`)
      const work = node('CreativeWork')
      assert.equal(work['@id'], specificationId)
      assert.equal(work.version, version)
      assert.equal(work.name, 'Standard Agent Specification')
      assert.equal(work.additionalType, 'https://www.wikidata.org/wiki/Q317623')
      assert.equal(work.license, 'https://spdx.org/licenses/MIT.html')
      assert.equal(work.publisher['@id'], organizationId)
      assert.ok(work.url.startsWith(origin))
      assert.deepEqual(work.hasPart.map(part => part['@id']).sort(), parts)
      assert.equal(node('WebPage')['@id'], `${origin}/${id}/#webpage`)
      assert.equal(node('WebPage').url, `${origin}/${id}/`)
      assert.equal(node('WebPage').isPartOf['@id'], specificationId)
      const breadcrumb = node('BreadcrumbList')
      assert.equal(node('WebPage').breadcrumb['@id'], breadcrumb['@id'])
      assert.ok(breadcrumb.itemListElement.length >= 2)
      breadcrumb.itemListElement.forEach((item, index) => {
        assert.equal(item.position, index + 1)
        assert.equal(item['@type'], 'ListItem')
        assert.ok(item.name)
        assert.ok(item.item.startsWith(origin))
        const path = new URL(item.item).pathname.replace(/^\//, '').replace(/\/$/, '')
        assert.ok(readFileSync(new URL(`dist/${path ? `${path}/` : ''}index.html`, root)).length)
      })
      assert.equal(breadcrumb.itemListElement.at(-1).item, node('WebPage').url)
    }
  }
})

test('unversioned guides belong to the website', () => {
  for (const page of ['community', 'runtimes', 'models']) {
    const node = graph(`${page}/index.html`)
    assert.equal(node('WebPage').isPartOf['@id'], `${origin}/#website`)
    assert.equal(node('CreativeWork').version, latest)
    assert.equal(node('BreadcrumbList').itemListElement.at(-1).item, `${origin}/${page}/`)
  }
})

test('the 404 page has no structured data', () => {
  assert.doesNotMatch(readFileSync(new URL('dist/404.html', root), 'utf8'), /application\/ld\+json/)
})
