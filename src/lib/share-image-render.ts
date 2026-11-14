import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import opentype from 'opentype.js'
import satori from 'satori'
import sharp from 'sharp'
import type { ShareImage, TitleRun } from './share-images'

// Renders a page's share image at build time. Satori lays out the image and
// draws its text as outlines, and sharp rasterizes the result to PNG. The fonts
// come from the @fontsource packages, so the result does not depend on the
// fonts of the build machine.

export const WIDTH = 1200
export const HEIGHT = 630

const PADDING = 80
const TITLE_WIDTH = WIDTH - PADDING * 2
const TITLE_LINE_HEIGHT = 1.12
const TITLE_MAX_SIZE = 92
const TITLE_MIN_SIZE = 32
const TITLE_MAX_LINES = 3
// The space that the brand row, the gap under it, and the section label take.
const TITLE_MAX_HEIGHT = HEIGHT - PADDING * 2 - 56 - 48 - 60

// The site's colors in dark mode (global.css).
const BACKGROUND = '#111827'
const TITLE = '#f9fafb'
const ACCENT = '#60a5fa'
const BRAND = '#e5e7eb'
const QUIET = '#9ca3af'

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150"><path fill="#f3f4f6" d="M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z"/></svg>`
const MARK_URI = `data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`

function fontFile(pkg: string, file: string): Buffer {
  return readFileSync(join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', file))
}

let fonts: { satori: Parameters<typeof satori>[1]['fonts']; title: opentype.Font } | undefined

function loadFonts() {
  if (fonts) return fonts
  const neuton = fontFile('neuton', 'neuton-latin-400-normal.woff')
  fonts = {
    satori: [
      { name: 'Neuton', data: neuton, weight: 400, style: 'normal' },
      { name: 'Public Sans', data: fontFile('public-sans', 'public-sans-latin-500-normal.woff'), weight: 500, style: 'normal' },
      { name: 'Lexend', data: fontFile('lexend', 'lexend-latin-400-normal.woff'), weight: 400, style: 'normal' },
    ],
    title: opentype.parse(new Uint8Array(neuton).buffer),
  }
  return fonts
}

interface Word {
  text: string
  accent: boolean
}

type Line = Word[]

function words(runs: TitleRun[]): Word[] {
  const result: Word[] = []
  for (const run of runs) {
    for (const text of run.text.split(/\s+/)) {
      if (text) result.push({ text, accent: Boolean(run.accent) })
    }
  }
  return result
}

function lineText(line: Line): string {
  return line.map((word) => word.text).join(' ')
}

// Greedy word wrap. A word wider than the line stays on a line of its own, and
// the caller rejects that size.
function wrap(list: Word[], measure: (text: string) => number, width: number): Line[] {
  const lines: Line[] = []
  let line: Line = []
  for (const word of list) {
    const next = [...line, word]
    if (line.length && measure(lineText(next)) > width) {
      lines.push(line)
      line = [word]
    } else {
      line = next
    }
  }
  if (line.length) lines.push(line)
  return lines
}

export interface TitleLayout {
  size: number
  lines: Line[]
}

// Picks the largest size at which the title fits in at most three lines, then
// balances the lines as the site's headings do (text-wrap: balance).
export function layoutTitle(runs: TitleRun[]): TitleLayout {
  const font = loadFonts().title
  const list = words(runs)
  // A small margin covers differences between this measure and Satori's.
  const limit = TITLE_WIDTH - 8
  for (let size = TITLE_MAX_SIZE; size >= TITLE_MIN_SIZE; size -= 2) {
    const measure = (text: string) => font.getAdvanceWidth(text, size)
    const lines = wrap(list, measure, limit)
    const fits =
      lines.length <= TITLE_MAX_LINES &&
      lines.length * size * TITLE_LINE_HEIGHT <= TITLE_MAX_HEIGHT &&
      lines.every((line) => measure(lineText(line)) <= limit)
    if (!fits) continue
    let low = 0
    let high = limit
    while (high - low > 4) {
      const mid = (low + high) / 2
      const trial = wrap(list, measure, mid)
      if (trial.length <= lines.length && trial.every((line) => measure(lineText(line)) <= mid)) high = mid
      else low = mid
    }
    return { size, lines: wrap(list, measure, high) }
  }
  throw new Error(`The share image title does not fit: ${runs.map((run) => run.text).join('')}`)
}

type Node = { type: string; props: Record<string, unknown> }

function el(type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node {
  return { type, props: { style, children, ...extra } }
}

function titleLine(line: Line, size: number): Node {
  const children: Node[] = []
  line.forEach((word, index) => {
    const text = index < line.length - 1 ? `${word.text} ` : word.text
    children.push(el('span', { color: word.accent ? ACCENT : TITLE }, text))
  })
  return el('div', { display: 'flex', whiteSpace: 'nowrap', fontSize: size, lineHeight: TITLE_LINE_HEIGHT }, children)
}

export async function renderShareImage(image: ShareImage): Promise<Buffer> {
  const { satori: satoriFonts } = loadFonts()
  const { size, lines } = layoutTitle(image.title)

  const brand = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }, [
    el('div', { display: 'flex', alignItems: 'center' }, [
      el('img', { width: 56, height: 56 }, undefined, { src: MARK_URI, width: 56, height: 56 }),
      el('div', { marginLeft: 22, fontFamily: 'Public Sans', fontWeight: 500, fontSize: 28, color: BRAND }, 'Standard Agent Specification'),
    ]),
    image.version
      ? el('div', { fontFamily: 'Lexend', fontSize: 24, color: QUIET }, `Version ${image.version}`)
      : el('div', {}, ''),
  ])

  const section = el(
    'div',
    { display: 'flex', fontFamily: 'Lexend', fontSize: 30, color: ACCENT, height: 60, alignItems: 'flex-start' },
    image.section.join('  /  '),
  )

  const title = el(
    'div',
    { display: 'flex', flexDirection: 'column', fontFamily: 'Neuton', fontWeight: 400, letterSpacing: '0.005em', color: TITLE },
    lines.map((line) => titleLine(line, size)),
  )

  const root = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      width: WIDTH,
      height: HEIGHT,
      padding: PADDING,
      backgroundColor: BACKGROUND,
    },
    [brand, el('div', { display: 'flex', flexDirection: 'column' }, [section, title])],
  )

  const svg = await satori(root as Parameters<typeof satori>[0], { width: WIDTH, height: HEIGHT, fonts: satoriFonts })
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}
