// Checks the built site in dist/. Run `pnpm test`, which builds first.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const read = (path) => readFileSync(join(dist, path), 'utf8')

const ORIGIN = 'https://standardagentspec.org'
const latest = readdirSync(join(root, 'content'))
  .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]

// Reads the size from a PNG's signature and IHDR chunk.
function pngSize(file) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const isPng = file.length >= 24 && file.subarray(0, 8).equals(signature) && file.toString('latin1', 12, 16) === 'IHDR'
  if (!isPng) throw new Error('not a PNG')
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

test('the homepage states the current version', () => {
  const sentence = `The current version of the specification is ${latest}.`
  assert.ok(read('index.html').replace(/<[^>]+>/g, '').includes(sentence))
  assert.ok(read('index.md').includes(sentence))
})

test('no current page shows a 1.0.0 version', () => {
  const pages = walk(join(dist, latest)).concat(join(dist, 'index.html'), join(dist, 'index.md'))
  const offenders = pages.filter((path) => readFileSync(path, 'utf8').includes('1.0.0'))
  assert.deepEqual(offenders, [])
})

test('current pages use the product name Standard Agents Builder', () => {
  // The product is "Standard Agents Builder" and the company is "Standard
  // Agents". Archived version folders are immutable, so they are not checked.
  const versions = readdirSync(join(root, 'content')).filter((name) => /^\d+\.\d+\.\d+$/.test(name))
  const archived = versions.filter((name) => name !== latest).map((name) => join(dist, name) + '/')
  const wrong = /AgentBuilder|Agent Builder|StandardAgents(?!pec)|STANDARDAGENTS/
  const offenders = walk(dist)
    .filter((path) => /\.(html|md|txt)$/.test(path) && !archived.some((dir) => path.startsWith(dir)))
    .filter((path) => wrong.test(readFileSync(path, 'utf8')))
    .map((path) => path.slice(dist.length + 1))
  assert.deepEqual(offenders, [])
})

test('llms.txt links to the canonical domain', () => {
  const urls = read('llms.txt').match(/https?:\/\/\S+/g)
  assert.ok(urls.length > 10)
  assert.deepEqual(urls.filter((url) => !url.startsWith(`${ORIGIN}/`)), [])
})

test('a 404 page exists and is kept out of search', () => {
  // Cloudflare Pages serves a top-level 404.html with status 404 for unknown
  // URLs. Without it, Pages serves the homepage with status 200.
  const html = read('404.html')
  assert.match(html, /Page not found/)
  assert.match(html, /<meta name="robots" content="noindex"/)
  assert.doesNotMatch(html, /rel="canonical"/)
})

test('robots.txt allows crawling and names the sitemap', () => {
  const robots = read('robots.txt')
  assert.match(robots, /^User-agent: \*$/m)
  assert.match(robots, /^Allow: \/$/m)
  assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap-index.xml`))
})

test('the sitemap lists real pages only', () => {
  assert.ok(read('sitemap-index.xml').includes(`${ORIGIN}/sitemap-0.xml`))
  const urls = [...read('sitemap-0.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  assert.ok(urls.includes(`${ORIGIN}/`))
  assert.ok(urls.includes(`${ORIGIN}/${latest}/specification/agents/`))
  // The 404 page and the /{version} redirect pages are not content.
  assert.deepEqual(urls.filter((url) => /\/404\/?$|\/\d+\.\d+\.\d+\/?$/.test(url)), [])
})

test('pages carry share tags', () => {
  for (const page of ['index.html', `${latest}/specification/agents/index.html`]) {
    const html = read(page)
    for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:site_name', 'og:image']) {
      assert.match(html, new RegExp(`<meta property="${property}" content="[^"]+"`), `${page} ${property}`)
    }
    for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      assert.match(html, new RegExp(`<meta name="${name}" content="[^"]+"`), `${page} ${name}`)
    }
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)[1]
    assert.equal(image, `${ORIGIN}/og.png`)
    assert.equal(html.match(/<meta name="twitter:image" content="([^"]+)"/)[1], image)
    // The image is a PNG of the size the tags declare.
    const { width, height } = pngSize(readFileSync(join(dist, new URL(image).pathname)))
    assert.equal(html.match(/<meta property="og:image:width" content="(\d+)"/)[1], String(width))
    assert.equal(html.match(/<meta property="og:image:height" content="(\d+)"/)[1], String(height))
    assert.deepEqual({ width, height }, { width: 1200, height: 630 })
  }
})

test('the share image check rejects a file that is not a PNG', () => {
  assert.throws(() => pngSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), /not a PNG/)
})

test('/latest/ redirects to the latest version', () => {
  const redirects = read('_redirects').split('\n')
  assert.ok(redirects.includes(`/latest/* /${latest}/:splat 302`))
  assert.ok(redirects.includes('/latest / 302'))
  // The rules from public/_redirects are kept.
  assert.ok(redirects.includes(`/0.2.0/getting-started/overview / 301`))
})

test('pages tell Cloudflare to leave email addresses alone', () => {
  const html = read(`${latest}/specification/effects/index.html`)
  const open = html.indexOf('<!--email_off-->')
  const close = html.indexOf('<!--/email_off-->')
  const email = html.replace(/<[^>]+>/g, '').includes('user@example.com')
  assert.ok(email, 'the sample email is in the page')
  assert.ok(open !== -1 && open < html.indexOf('<main'))
  assert.ok(close > html.lastIndexOf('example.com'))
})
