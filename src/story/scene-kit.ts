import { BRAND_ICONS } from './brand-icons'

/**
 * Shared drawing kit for the site's canvas illustrations.
 *
 * The hero scene and the domain-agents story are the same hand: three inks
 * (black, white, gold), tone simulated by ordered dither rather than by
 * translucent fills, hairline strokes, mono labels. This module owns those
 * primitives so both sections stay in step, and so a scene file is a
 * description of WHAT is on screen rather than a re-implementation of HOW to
 * draw a slab.
 *
 * The centrepiece is drawAgent(): the domain-agents story renders every beat
 * with it. The vocabulary (slabs, dashed icon chips, logo rows, the labelled
 * curly brace) mirrors Justin Schroeder's Sigil-meetup slide deck — each
 * element here exists because a slide uses it, themed for this site. See the
 * CITATIONS map in agent-story-scenes.ts for the slide/timestamp behind each
 * scene.
 */

// =========================================================================
// Palette
// =========================================================================

/**
 * The parts of an agent that get a colour of their own. Gold was always the
 * sub-agent — an agent used as a tool is still an agent, and the deck colours
 * it as one — and the rest follow that principle: a colour marks a KIND of
 * capability, so the same kind is the same colour everywhere it appears.
 *
 * `Functions` deliberately has none. A tool being a function is what everyone
 * already assumes, so colouring it would spend attention on the one part of
 * the row that carries no news.
 */
export type Accent = 'gold' | 'rules' | 'hooks' | 'prompts' | 'files' | 'exec' | 'provider'

/**
 * Two forms per accent, one per theme. Accents are laid down as a half-tone
 * over the panel rather than as a flat fill, so each form only has to hold the
 * same apparent vividness against a white ground as against a black one — which
 * is why they sit close together rather than as a deep/pale pair. Matched in
 * chroma to the gold, so the set still reads as one family.
 */
const ACCENTS: Record<Accent, { light: string; dark: string }> = {
  // The gold used to FILL an area, which is not the gold used to set type in.
  // Type gold has to hold its own against a white page, and that gold spread
  // across a whole slab reads as brown; dithered, the fill can be the brighter,
  // actually-gold version without costing any legibility.
  gold: { light: '37, 99, 235', dark: '96, 165, 250' },
  // Governance. Purple: the part that constrains everything else.
  rules: { light: '124, 58, 232', dark: '138, 68, 224' },
  // Lifecycle interception. Emerald rather than forest — the green has to sit
  // beside a blue and a purple of this depth without going olive.
  hooks: { light: '26, 172, 84', dark: '38, 178, 92' },
  // Language: instructions handed to a model. A true blue, not a periwinkle.
  prompts: { light: '222, 170, 32', dark: '225, 185, 101' },
  // Storage — the same family as hooks but steadier and further back, since it
  // is a capability the agent reaches for rather than a part it contains.
  files: { light: '30, 156, 116', dark: '72, 190, 146' },
  // Doing something in the world, so the hottest of the set.
  exec: { light: '226, 58, 44', dark: '255, 116, 102' },
  // Where the model runs: the vendor connection under everything else.
  // Magenta — the one hue band the set has not used, so it cannot be
  // mistaken for a neighbour at hatch density.
  provider: { light: '204, 44, 168', dark: '224, 82, 190' },
}

export interface Palette {
  light: boolean
  /** `r, g, b` triples, for composing rgba() at call sites. */
  inkChannels: string
  goldChannels: string
  /** Channel triples per accent, already resolved for this theme. */
  accents: Record<Accent, string>
  panel: string
  gold: string
  goldBright: string
  /** Dither colour for broad shaded regions. */
  field: string
}

export const paletteFor = (light: boolean): Palette => ({
  light,
  inkChannels: light ? '17, 24, 39' : '243, 244, 246',
  goldChannels: light ? '37, 99, 235' : '96, 165, 250',
  accents: Object.fromEntries(
    Object.entries(ACCENTS).map(([k, v]) => [k, light ? v.light : v.dark]),
  ) as Record<Accent, string>,
  panel: light ? '#ffffff' : '#1e293b',
  gold: light ? '#2563eb' : '#60a5fa',
  goldBright: light ? '#1d4ed8' : '#93c5fd',
  field: light ? 'rgba(37, 99, 235, 0.45)' : 'rgba(96, 165, 250, 0.32)',
})

/** An accent at a given alpha. `gold(p, a)` is `accent(p, 'gold', a)`. */
export const accent = (p: Palette, a: Accent, alpha: number) =>
  `rgba(${p.accents[a]}, ${alpha})`

/**
 * The accent field is the Say More territory hatch (say-more-draw.ts,
 * `drawHatch`) in another palette: the same 4-of-16 Bayer coverage with the
 * colour held well back. That treatment already had to sit behind live page
 * content without swallowing it, which is the same problem a slab label has,
 * and matching it keeps one dither language across the site rather than a
 * second one invented for this stack.
 */
const ACCENT_DENSITY = 4
const ACCENT_FIELD_ALPHA = { light: 0.55, dark: 0.45 }

/**
 * An accented region: the one recipe for "this part is of kind X", used by
 * slabs, chips and footers alike. Panel first so the field is a known ground
 * rather than whatever it was drawn over, the accent as a half-tone through
 * the shared ditherRect, then the accent again as the border that names it.
 *
 * One function because the alternative is what this replaced — every call site
 * picking its own density and alpha, which is how the same idea ended up with
 * three different weights and no way to retune them together.
 */
const accentField = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  a: Accent,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  ctx.fillStyle = p.panel
  ctx.fillRect(x, y, w, h)
  ditherRect(
    ctx, x, y, w, h,
    accent(p, a, p.light ? ACCENT_FIELD_ALPHA.light : ACCENT_FIELD_ALPHA.dark),
    ACCENT_DENSITY,
  )
  ctx.save()
  ctx.strokeStyle = accent(p, a, 0.9)
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.restore()
}

/** A chip's accent, if it has one. `goldChips` is the older spelling of the
    same idea and still works, so existing scenes need no edit. */
const chipTone = (slab: Slab, chip: string): Accent | undefined =>
  slab.chipAccents?.[chip] ?? (slab.goldChips?.includes(chip) ? 'gold' : undefined)

export const ink = (p: Palette, alpha: number) => `rgba(${p.inkChannels}, ${alpha})`
export const gold = (p: Palette, alpha: number) => `rgba(${p.goldChannels}, ${alpha})`

export const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
export const SANS = '"Public Sans", system-ui, sans-serif'

// =========================================================================
// Content bounds
//
// Scenes lay themselves out from the canvas size, which makes it easy to fit
// one axis and forget the other — a label hanging off a brace is outside the
// box its own layout math reasoned about. Every primitive here reports the
// area it drew into, so the rig can compare the union against the canvas and
// either scale the frame to fit or say plainly what ran over.
//
// Scenes that draw something bespoke should call noteBounds themselves; the
// union is only as honest as its contributors.
// =========================================================================

let bounds: { x1: number; y1: number; x2: number; y2: number } | null = null

/** Start recording. The rig calls this; scenes do not. */
export const beginBounds = () => {
  bounds = null
}

/** The union of everything drawn since beginBounds, or null if nothing was. */
export const readBounds = () => bounds

export const noteBounds = (x: number, y: number, w: number, h: number) => {
  const x1 = Math.min(x, x + w)
  const y1 = Math.min(y, y + h)
  const x2 = Math.max(x, x + w)
  const y2 = Math.max(y, y + h)
  if (!bounds) {
    bounds = { x1, y1, x2, y2 }
    return
  }
  if (x1 < bounds.x1) bounds.x1 = x1
  if (y1 < bounds.y1) bounds.y1 = y1
  if (x2 > bounds.x2) bounds.x2 = x2
  if (y2 > bounds.y2) bounds.y2 = y2
}

/** Bounds for text already committed to ctx.font/textAlign/textBaseline. */
export const noteTextBounds = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) => {
  const m = ctx.measureText(text)
  const ascent = m.actualBoundingBoxAscent || 12
  const descent = m.actualBoundingBoxDescent || 4
  const left = m.actualBoundingBoxLeft
  const right = m.actualBoundingBoxRight
  // actualBoundingBox* already account for textAlign and textBaseline, so
  // they describe the painted ink rather than the advance box.
  noteBounds(x - (left || 0), y - ascent, (left || 0) + (right || m.width), ascent + descent)
}

// =========================================================================
// Easing
// =========================================================================

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** smoothstep — ss(x) + ss(1 - x) === 1, so a crossfading pair never dips. */
export const ss = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c) }
export const ease = (x: number) => 1 - (1 - clamp01(x)) ** 3
/** Progress of a segment of a longer timeline. */
export const seg = (t: number, from: number, to: number) => clamp01((t - from) / (to - from))

// =========================================================================
// Ordered dither
//
// Tone between the three inks is simulated by a 4x4 Bayer pattern. Fills
// happen in DEVICE space: the scenes draw under a fractional scale, and
// filling the tile through that scale minifies it, which the browser
// resamples into uneven blotchy dots. Mapping the rect to device pixels puts
// one tile cell on a whole number of device pixels, which is both crisper and
// cheaper. Same treatment as the hero canvas.
// =========================================================================

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const tileCache = new Map<string, HTMLCanvasElement>()
const patternCache = new Map<string, CanvasPattern>()

const ditherTile = (color: string, density: number, texel: number) => {
  const key = `${color}|${density}|${texel}`
  const hit = tileCache.get(key)
  if (hit) return hit
  const tile = document.createElement('canvas')
  tile.width = 4 * texel
  tile.height = 4 * texel
  const tctx = tile.getContext('2d')
  if (!tctx) return null
  tctx.fillStyle = color
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if (BAYER[y]![x]! < density) tctx.fillRect(x * texel, y * texel, texel, texel)
    }
  }
  tileCache.set(key, tile)
  return tile
}

/** Fill a rect with ordered dither. Coordinates are in scene units. */
export const ditherRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  density: number,
) => {
  if (!(w > 0) || !(h > 0)) return
  const m = ctx.getTransform()
  const texel = Math.max(1, Math.round(m.a))
  const key = `${color}|${density}|${texel}`
  let pattern = patternCache.get(key)
  if (!pattern) {
    const tile = ditherTile(color, density, texel)
    if (!tile) return
    const made = ctx.createPattern(tile, 'repeat')
    if (!made) return
    patternCache.set(key, made)
    pattern = made
  }
  // Map both edges so rounding never adds or drops a pixel of width.
  const x0 = Math.round(m.a * x + m.e)
  const y0 = Math.round(m.d * y + m.f)
  const x1 = Math.round(m.a * (x + w) + m.e)
  const y1 = Math.round(m.d * (y + h) + m.f)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = pattern
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}

/** Palette changes bake into the tiles, so a theme flip retires them. */
export const resetDitherCaches = () => {
  tileCache.clear()
  patternCache.clear()
}

// =========================================================================
// Chrome
// =========================================================================

export const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Dashed organisational boundary with a label set into its top edge. */
export const drawGroupFrame = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
  w: number,
  h: number,
  label?: string,
  tone: 'neutral' | 'gold' = 'neutral',
) => {
  ctx.save()
  ctx.strokeStyle = tone === 'gold' ? gold(p, p.light ? 0.75 : 0.5) : ink(p, p.light ? 0.4 : 0.3)
  ctx.lineWidth = 1.2
  ctx.setLineDash([5, 6])
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
  noteBounds(x, y, w, h)
  if (!label) return
  ctx.save()
  ctx.font = `600 9.5px ${SANS}`
  const tw = ctx.measureText(label.toUpperCase()).width + 14
  ctx.fillStyle = p.panel
  ctx.fillRect(x + 12, y - 6, tw, 12)
  sectionLabel(ctx, p, label, x + 19, y + 3, 9.5, 0.55)
  ctx.restore()
}

/** Small caps-ish label with wide tracking. Never sits on dither. */
/**
 * Tracking on a section label, in px. Canvas letterSpacing adds a gap AFTER
 * every glyph, the last one included, so a measurement taken with it set
 * carries one trailing space the eye does not see — subtract it when sizing
 * anything to the words. Shared so a caller measuring the label and
 * sectionLabel drawing it cannot disagree, which is what left the header's
 * selection a character short of the end.
 */
const LABEL_TRACK = 1.4

/** The width `sectionLabel` will actually draw `text` at. */
export const sectionLabelWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
) => {
  ctx.save()
  ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${LABEL_TRACK}px`
  ctx.font = `600 ${size}px ${SANS}`
  const w = ctx.measureText(text.toUpperCase()).width - LABEL_TRACK
  ctx.restore()
  return w
}

export const sectionLabel = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  text: string,
  x: number,
  y: number,
  size = 10,
  alpha = 0.58,
) => {
  ctx.save()
  ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${LABEL_TRACK}px`
  ctx.font = `600 ${size}px ${SANS}`
  ctx.fillStyle = ink(p, alpha)
  const upper = text.toUpperCase()
  ctx.fillText(upper, x, y)
  noteTextBounds(ctx, upper, x, y)
  ctx.restore()
}

/** Square pulse. Circles read soft against a dithered scene. */
export const drawPulse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) => {
  ctx.fillStyle = color
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

export const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1)
  }
  return `${trimmed}…`
}

/**
 * Chip-row columns sized to their names rather than equal shares: the labels
 * are monospaced, so character count IS relative width and no canvas context
 * is needed. Equal columns ellipsized "Sub-prompts" while "Functions" sat in
 * air. The padding constant is in character-equivalents, so short names keep
 * proportionally more breathing room.
 */
export const chipCols = (chips: string[], w: number, g: number) => {
  const padChars = 3
  const weights = chips.map((chip) => chip.length + padChars)
  const total = weights.reduce((a, b) => a + b, 0)
  const avail = w - g * (chips.length - 1)
  const widths = weights.map((weight) => (weight / total) * avail)
  const xs: number[] = []
  let acc = 0
  widths.forEach((cw) => {
    xs.push(acc)
    acc += cw + g
  })
  return { widths, xs }
}

/**
 * Brand-row columns: equal shares (logo entries are near-uniform, unlike chip
 * labels). One helper for the same reason as chipCols — layoutAgent and
 * drawAgent must place these cells identically, and two hand-maintained
 * copies of the arithmetic is how they drift apart.
 */
export const brandCols = (n: number, w: number, g: number) => {
  const cw = (w - g * (n - 1)) / n
  return { cw, xAt: (ci: number) => ci * (cw + g) }
}

// =========================================================================
// The curly brace
//
// The deck's own annotation device: a right-side brace spanning part of the
// stack, with a large label beside it. It carries the two turns of the
// argument — labelled "Context" at 54:52, relabelled "Inheritance" at 55:52
// over the same (grown) stack.
// =========================================================================

export const drawBrace = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y1: number,
  y2: number,
  label: string,
  scale = 1,
  alpha = 1,
) => {
  const d = Math.min(11 * scale, (y2 - y1) / 4)
  const mid = (y1 + y2) / 2
  const labelX0 = x + 2 * d + 10 * scale
  // Geometry first, and returned even when nothing is drawn: a caller hanging
  // something off the label (which may outlive the brace) still needs to know
  // where the words were.
  ctx.save()
  ctx.font = `600 ${Math.max(14, 19 * scale)}px ${SANS}`
  const labelW0 = ctx.measureText(label).width
  ctx.restore()
  if (alpha <= 0.01 || y2 - y1 < 8) return { x: labelX0, y: mid, w: labelW0 }
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.strokeStyle = ink(p, 0.7)
  ctx.lineWidth = Math.max(1.4, 2 * scale)
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y1)
  ctx.quadraticCurveTo(x + d, y1, x + d, y1 + d)
  ctx.lineTo(x + d, mid - d)
  ctx.quadraticCurveTo(x + d, mid, x + 2 * d, mid)
  ctx.quadraticCurveTo(x + d, mid, x + d, mid + d)
  ctx.lineTo(x + d, y2 - d)
  ctx.quadraticCurveTo(x + d, y2, x, y2)
  ctx.stroke()
  ctx.font = `600 ${Math.max(14, 19 * scale)}px ${SANS}`
  ctx.fillStyle = ink(p, 0.8)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const labelX = x + 2 * d + 10 * scale
  ctx.fillText(label, labelX, mid)
  // The spine plus the label, which is the part that hangs furthest right.
  noteBounds(x, y1, 2 * d, y2 - y1)
  noteTextBounds(ctx, label, labelX, mid)
  const labelW = ctx.measureText(label).width
  ctx.restore()
  // Where the words ended, so a caller can hang something off them without
  // re-deriving a layout this function already did.
  return { x: labelX, y: mid, w: labelW }
}

/**
 * The package mark's geometry, on Lucide's 24 grid (ISC), as points rather
 * than as path data — because the card has to BECOME this outline, which
 * means interpolating to its corners rather than drawing it.
 *
 * Six sharp corners: the two peaks are the near and far vertical edges of the
 * cube, the four sides are its silhouette. Everything else about the mark is
 * interior line work.
 */
const PKG_HULL = [
  { x: 12, y: 2 },  // top — the far top corner
  { x: 21, y: 7 },  // upper right
  { x: 21, y: 17 }, // lower right
  { x: 12, y: 22 }, // bottom — the near bottom corner
  { x: 3, y: 17 },  // lower left
  { x: 3, y: 7 },   // upper left
]
/**
 * The three-quarter view: the front vertical edge and the two top seams.
 *
 * Each is stored from the HULL inward, because that is the direction it is
 * drawn. Growing them out of the centre made the cube resolve from a point
 * nobody was looking at; running them in from the corners the hull has just
 * finished landing on continues that motion, and they meet in the middle,
 * which is where the eye ends up anyway.
 */
const PKG_LINES = [
  [{ x: 12, y: 22 }, { x: 12, y: 12 }],
  [{ x: 3, y: 7 }, { x: 12, y: 12 }],
  [{ x: 21, y: 7 }, { x: 12, y: 12 }],
  // Snapped to THIS hull, not to Lucide's. Their silhouette has 2-unit
  // rounded corners, so their lid seam starts a fraction above where a sharp
  // upper-left edge actually runs and pokes out past it. On sharp geometry the
  // seam runs from the midpoint of that edge to the midpoint of the far top
  // seam, which is what it is: the back edge of the lid.
  [{ x: 7.5, y: 4.5 }, { x: 16.5, y: 9.5 }],
]

/**
 * A card turning into the package mark.
 *
 * The card's rectangle is treated as a degenerate hexagon — its four corners
 * plus a point at the middle of the top and bottom edges — and every one of
 * those six points travels to the corresponding corner of the mark. The two
 * mid-edge points are what pull out into the cube's near and far vertical
 * edges, so the rectangle does not dissolve into an icon: it is drawn out into
 * one. Nothing crossfades, and there is only ever one shape on screen.
 *
 * `morph` moves the hull. `lines` grows the interior line work outward from
 * the centre vertex once there is a cube for it to be inside.
 */
/**
 * The hull a card is at, part-way through becoming the mark. Exposed because
 * the container's hull has to CLIP what it holds: the outline closes faster
 * than the contents can shrink, and without a clip the interior spills back
 * out through the sides of the box it is supposed to be going into.
 */
export const packageHull = (
  rect: { x: number; y: number; w: number; h: number },
  size: number,
  morph: number,
) => {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const k = size / 24
  const flat = [
    { x: cx, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: cx, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x, y: rect.y },
  ]
  return PKG_HULL.map((g, i) => {
    const a = flat[i]!
    const b = { x: cx + (g.x - 12) * k, y: cy + (g.y - 12) * k }
    return { x: a.x + (b.x - a.x) * morph, y: a.y + (b.y - a.y) * morph }
  })
}

/** Trace a closed polygon, optionally offset. */
export const tracePolygon = (
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  dx = 0,
  dy = 0,
) => {
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x + dx, pts[0]!.y + dy)
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i]!.x + dx, pts[i]!.y + dy)
  ctx.closePath()
}

export const drawPackageMorph = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  rect: { x: number; y: number; w: number; h: number },
  size: number,
  morph: number,
  lines: number,
  opts: {
    shadow?: number
    lineWidth?: number
    stroke?: string
    /** Fill the mark with a half-tone of this colour instead of flat panel. */
    dither?: string
  } = {},
) => {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const k = size / 24
  const at = (g: { x: number; y: number }) => ({
    x: cx + (g.x - 12) * k,
    y: cy + (g.y - 12) * k,
  })
  const hull = packageHull(rect, size, morph)
  const trace = (pts: { x: number; y: number }[], dx = 0, dy = 0) =>
    tracePolygon(ctx, pts, dx, dy)

  const off = opts.shadow ?? 7
  if (off > 0) {
    // Cast in SCENE space, so the tile is the same tile every other shadow in
    // the scene uses. Dithering under a scaled transform magnifies the pattern
    // by whatever that scale is, which is what turned this one into wallpaper.
    ctx.save()
    trace(hull, off, off)
    ctx.clip()
    const x1 = Math.min(...hull.map((q) => q.x)) + off
    const y1 = Math.min(...hull.map((q) => q.y)) + off
    const x2 = Math.max(...hull.map((q) => q.x)) + off
    const y2 = Math.max(...hull.map((q) => q.y)) + off
    ditherRect(ctx, x1, y1, x2 - x1, y2 - y1, ink(p, 0.5), 4)
    ctx.restore()
  }

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = opts.lineWidth ?? 2
  ctx.strokeStyle = opts.stroke ?? ink(p, 0.9)
  trace(hull)
  if (!opts.dither) {
    // Opaque only when the mark is meant to be a solid object. A dithered
    // interior is a SURFACE, and laying it over panel first makes it a
    // half-tone on a black card rather than a half-tone you can see the scene
    // through — which is what the field it replaced always was.
    ctx.fillStyle = p.panel
    ctx.fill()
  }
  if (opts.dither) {
    // The mark keeps the scene's own surface rather than becoming a solid
    // shape in a scene that has none. Clipped to the hull and dithered in
    // SCENE space, so it is the same tile as every other field here.
    ctx.save()
    ctx.clip()
    const x1 = Math.min(...hull.map((q) => q.x))
    const y1 = Math.min(...hull.map((q) => q.y))
    const x2 = Math.max(...hull.map((q) => q.x))
    const y2 = Math.max(...hull.map((q) => q.y))
    ditherRect(ctx, x1, y1, x2 - x1, y2 - y1, opts.dither, 4)
    ctx.restore()
    trace(hull)
  }
  ctx.stroke()

  // Drawn OUT from the centre vertex as the cube resolves, so the interior
  // arrives as construction lines rather than as a second picture laid over
  // the first.
  if (lines > 0.004) {
    // Butt caps on the interior: every one of these terminates against
    // another stroke, and a round cap adds half a line width of stub past the
    // join — which at icon weight is a visible spur sticking out of the hull.
    ctx.lineCap = 'butt'
    ctx.beginPath()
    for (const [a, b] of PKG_LINES as [
      { x: number; y: number },
      { x: number; y: number },
    ][]) {
      const from = at(a)
      const to = at(b)
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(from.x + (to.x - from.x) * lines, from.y + (to.y - from.y) * lines)
    }
    ctx.stroke()
  }
  ctx.restore()
  noteBounds(
    Math.min(...hull.map((q) => q.x)),
    Math.min(...hull.map((q) => q.y)),
    Math.max(...hull.map((q) => q.x)) - Math.min(...hull.map((q) => q.x)) + off,
    Math.max(...hull.map((q) => q.y)) - Math.min(...hull.map((q) => q.y)) + off,
  )
}

/**
 * The pointer, as a bitmap. Everything else on this site is drawn on a grid —
 * the skull, the dither, the hairline rules — and a smooth vector arrow in the
 * middle of it reads as a screenshot of somebody else's interface. `#` is the
 * fill, `O` the outline, so it carries its own contrast on any ground.
 *
 * No tail: at this size a tail is four ambiguous pixels, and cutting it lets
 * the bottom edge curve INWARD to a softened heel — concave, so the silhouette
 * still reads as an arrow rather than as a leaf.
 *
 * RASTERISED from the polygon, not typed out. Hand-authoring it left a hole
 * between the heel and the tail and an outline that stopped one column short
 * of the fill it was meant to wrap, which read as the shape bending. To change
 * it: fill the polygon, dilate for the outline, and LOOK at the result — do
 * not nudge cells.
 */
const CURSOR = [
  'OOO.......',
  'O#OO......',
  'O##OO.....',
  'O###OO....',
  'O####O....',
  'O####OO...',
  'O#####OO..',
  'O######OO.',
  'O#######OO',
  'O########O',
  'O#####OOOO',
  'O###OOO...',
  'O##OO.....',
  'OOOO......',
]

export const drawCursor = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  x: number,
  y: number,
  cell: number,
  alpha = 1,
) => {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha *= alpha
  const fill = ink(p, 0.98)
  const edge = p.panel
  CURSOR.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      const c = row[rx]
      if (c !== '#' && c !== 'O') continue
      ctx.fillStyle = c === '#' ? fill : edge
      ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell)
    }
  })
  ctx.restore()
  noteBounds(x, y, CURSOR[0]!.length * cell, CURSOR.length * cell)
}

/**
 * A skull, drawn as pixels on a 12x12 grid rather than as a path. Everything
 * else in these scenes is dithered tone and hairline rules, so a smooth glyph
 * would read as an illustration dropped in from somewhere else; at this size a
 * cell grid is also simply more legible than a curve.
 *
 * (This is not a brand mark, so the never-hand-draw-an-icon rule does not
 * apply — that rule exists so a product is never approximated.)
 */
const SKULL = [
  '...######...',
  '.##########.',
  '############',
  '############',
  '##..####..##',
  '##..####..##',
  '############',
  '#####..#####',
  '.##########.',
  '..########..',
  '..##.##.##..',
  '..########..',
  '..##.##.##..',
]

/**
 * Deterministic per-cell jitter. Not Math.random: the scenes are pure
 * functions of the playhead, so a particle's path has to be the same on every
 * frame AND the same when the reader scrolls back through it. A hash of the
 * cell's index gives each one its own velocity that survives being replayed
 * backwards, which is what lets the explosion run in reverse and reassemble
 * the skull exactly as it was.
 */
const jitter = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

export const drawSkull = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string,
  alpha = 1,
  /** 0 = intact, 1 = fully scattered. Every cell is its own particle. */
  burst = 0,
) => {
  if (alpha <= 0.01) return
  const cols = SKULL[0]!.length
  const cx = (cols - 1) / 2
  ctx.save()
  ctx.fillStyle = color
  SKULL.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      if (row[rx] !== '#') continue
      let px = x + rx * cell
      let py = y + ry * cell
      if (burst > 0.001) {
        const n = ry * cols + rx
        // Outward from the centre line, plus a kick, plus gravity. The spread
        // is in cells so it scales with the mark.
        // Dust, not debris. The chips falling out of the stack are heavy
        // objects and drop like them; these are the pieces of a mark, so they
        // get a wide, slow drift and only enough gravity to settle downward
        // over the whole window. Their fall is also damped rather than freely
        // accelerating — sqrt of the burst rather than its square — which is
        // what small light things do in air, and what keeps a piece readable
        // for the whole of its trip instead of only at the start.
        const vx = (rx - cx) * 46 + (jitter(n) - 0.5) * 300
        // Blown from the middle of the mark: the rows at the top take the
        // upward half of the charge and are thrown clear, the rows at the
        // bottom are driven down with it. A single launch velocity for every
        // cell reads as the whole shape being lifted rather than as something
        // detonating inside it.
        const cy = (SKULL.length - 1) / 2
        const vy = -60 - jitter(n + 97) * 70 + (ry - cy) * 34
        const drift = Math.sin((jitter(n + 31) + burst * 1.6) * Math.PI * 2)
        px += (vx * burst + drift * 6) * cell
        // Free fall, not a damped one. A piece that eases to a halt reads as
        // settling onto something, and there is nothing there to settle on —
        // these have to keep gaining speed until they are past the bottom of
        // the container. The window is what makes it slow, not the curve.
        py += (vy * burst + 620 * burst * burst) * cell
      }
      // No fade, ever. The pieces are solid objects leaving the frame, and
      // dimming them as they go turns a blast into a dissolve — they should
      // simply fall off the bottom of the panel at full strength and be gone
      // because they are elsewhere, not because they evaporated.
      ctx.globalAlpha = alpha
      ctx.fillRect(px, py, cell, cell)
    }
  })
  ctx.restore()
  noteBounds(x, y, cols * cell, SKULL.length * cell)
}

// =========================================================================
// Brand marks
//
// Real product icons only — house rule: never hand-draw an icon. Marks come
// from simple-icons path data (app/utils/brand-icons.ts), rendered as Path2D
// in the site ink, and are ALWAYS paired with the product name. A brand
// without a sourceable mark is typeset name-only.
// =========================================================================

export interface BrandRef {
  /** Key into BRAND_ICONS; omitted = name-only chip. */
  slug?: string
  name: string
}

const brandPathCache = new Map<string, Path2D>()

export const drawBrandMark = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  slug: string,
  cx: number,
  cy: number,
  size: number,
  alpha = 0.85,
) => {
  const icon = BRAND_ICONS[slug]
  if (!icon) return false
  let path = brandPathCache.get(slug)
  if (!path) {
    path = new Path2D(icon.path)
    brandPathCache.set(slug, path)
  }
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  // Per-icon grid: simple-icons draws on 24, Phosphor on 256. Assuming 24 for
  // everything rendered the concept glyphs at a tenth of their size.
  const box = icon.box ?? 24
  ctx.scale(size / box, size / box)
  ctx.fillStyle = ink(p, alpha)
  ctx.fill(path)
  ctx.restore()
  return true
}

/** Mark + name, centred as a unit at (cx, cy). Name-only when no slug. */
export const drawBrandEntry = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  brand: BrandRef,
  cx: number,
  cy: number,
  iconSize: number,
  fontPx: number,
  alpha = 0.85,
) => {
  ctx.save()
  ctx.font = `600 ${fontPx}px ${SANS}`
  const nameW = ctx.measureText(brand.name).width
  const gap = iconSize * 0.35
  const hasIcon = !!(brand.slug && BRAND_ICONS[brand.slug])
  const total = hasIcon ? iconSize + gap + nameW : nameW
  let x = cx - total / 2
  if (hasIcon) {
    drawBrandMark(ctx, p, brand.slug!, x + iconSize / 2, cy, iconSize, alpha)
    x += iconSize + gap
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink(p, Math.min(1, alpha + 0.05))
  ctx.fillText(brand.name, x, cy + 0.5)
  ctx.restore()
}

// =========================================================================
// The agent
//
// One renderer, configured per beat. Slabs are listed BOTTOM-UP, matching the
// deck's build order: the model first, then a system prompt on top of it,
// then tools on top of that. The model's top edge is the anchor, so the stack
// grows upward from a fixed line — exactly as the deck keeps the Model slab
// parked at the bottom of every slide — and consecutive panels crossfade as a
// morph rather than as a dissolve between two differently-placed boxes.
// =========================================================================

export interface Slab {
  label?: string
  /** Chips rendered inside the slab instead of a label, e.g. Tools. */
  chips?: string[]
  /** How far the chip row has divided, 0..1 (default 1). At 0 the columns
      butt together under the slab's own label; at 1 they are separate chips
      with their own. Animating it plays the division in either direction. */
  split?: number
  /** Chips in this list are drawn in gold — an agent used as a tool is still
      an agent, and the deck colours it as one. */
  goldChips?: string[]
  /** Per-chip accents, by chip label. Takes precedence over `goldChips`. */
  chipAccents?: Partial<Record<string, Accent>>
  /** Fills the slab in this accent instead of plain ink. */
  accent?: Accent
  /** A borderless row of product marks with names — the deck's logo rows. */
  brands?: BrandRef[]
  /** A single mark-plus-name centred in the slab (with `tone: 'dashed'`,
      the deck's MCP tool chips). */
  brand?: BrandRef
  tone?: 'solid' | 'field' | 'gold' | 'dashed' | 'plain'
  /** 0 hides it, 1 is fully present. Drives the build-on animations. */
  presence?: number
  height?: number
  /** Extra gap below this slab, in slab-heights — the deck separates the
      Model from the context stack. */
  gapBefore?: number
  /** This slab is a CHILD of the slab above it (top-down reading): it sits
      tight under its parent — ownership by proximity. */
  child?: boolean
  /** Brands-row entries to omit entirely (index into `brands`) — used while
      an entry is off being animated as a free sprite. */
  hiddenEntries?: number[]
  /** Dashed slab: draw the outline but not the mark/name — the slot is open,
      its occupant is elsewhere (a sprite in flight). */
  contentHidden?: boolean
}

export interface AgentSpec {
  /** Caption above the boundary. */
  title?: string
  /** Bottom-up. Index 0 sits on the anchor line. */
  slabs: Slab[]
  /** Half-width slabs below the stack, e.g. Storage / Code Execution. They are
      drawn exactly like the slabs above them. */
  footers?: { label: string; presence?: number; accent?: Accent }[]
  /** High-contrast panel card behind the group — the hero illustration's
      TUI/file-panel treatment (solid panel fill, hairline border, dithered
      drop shadow). Default ON for any agent grouping. */
  card?: boolean
  /** Header set into the card's top band, hero-panel style (bullet + small
      caps). Skipped automatically when the card is too small to carry it. */
  header?: string
  /** `gold` sets the header in a filled gold plate instead of bullet + small
      caps, for a header that asserts something about the card rather than
      naming it. */
  headerTone?: 'neutral' | 'gold'
  /** Dashed boundary around the whole thing (the deck's "ideal agent" box);
      drawn OUTSIDE the card when both are present. */
  boundary?: boolean
  boundaryLabel?: string
  boundaryTone?: 'neutral' | 'gold'
  /** Whole-agent opacity, for fades. */
  alpha?: number
  /** Draw the model solid and everything above it hollow. */
  hollowAboveModel?: boolean
  /**
   * How much of the header is selected, 0..1, swept from the RIGHT. Drawn as
   * the same gold hatch the rest of the kit uses for a marked region, so a
   * header about to be rewritten is marked the way anything else here is.
   */
  headerHighlight?: number
  /**
   * Multiplier on the header band's type size. The band is otherwise sized
   * off the card, which is right for a card being read on its own and wrong
   * for one sitting in a lockup that is fitted to the frame afterwards: the
   * fit shrinks the card, the header goes with it, and the one card meant to
   * be legible ends up with the smallest name on screen.
   */
  headerScale?: number
  /**
   * Same card, no type in its rows: every row keeps its size, position,
   * colour and outline, and loses its label and its identity mark. A card
   * repeated across a graph is making a claim about shape rather than asking
   * to be read again, and at small sizes its row labels are texture that
   * competes with the one card that IS meant to be read. The header stays —
   * what KIND of card this is is the claim — as does the `title` above it.
   */
  wordless?: boolean
}

const SLAB_H = 26
const SLAB_GAP = 7
const PAD = 15
/**
 * The header's type size, and the size it is quoted against. Below roughly a
 * 0.9 card scale the words stop shrinking and hold at 8.5px, so the band's
 * bullet, gutter and plate are all derived from `HEADER_SIZE / HEADER_BASE`
 * rather than from the card's scale. Shared with layoutAgent so the reserved
 * band and the drawn one cannot disagree.
 */
const HEADER_BASE = 9.5
const HEADER_SIZE = (scale: number) => Math.max(8.5, HEADER_BASE * scale)
/** Tracking on a plated header, in px. Shared by the measure and the draw so
    the plate can never be sized from a width the text does not have. */
const HEADER_TRACK = 1.4
export const SLAB_PITCH = SLAB_H + SLAB_GAP

export interface AgentBox {
  x: number
  y: number
  w: number
  h: number
  /** The backing card's rect (equals the stack bounds when card is off). */
  card: { x: number; y: number; w: number; h: number }
  /** Centre of each drawn slab, bottom-up, for wiring links. */
  slabCentres: { x: number; y: number }[]
  chipRects: Record<string, { x: number; y: number; w: number; h: number }>
}

export interface AgentLayout {
  placed: { slab: Slab; y: number; h: number; pres: number }[]
  topY: number
  bottomY: number
  cardRect: { x: number; y: number; w: number; h: number }
  /** Geometry of every named cell: chips by label, brand entries and dashed
      brand slabs by brand name, footers by label. */
  cells: Record<string, { x: number; y: number; w: number; h: number }>
}

/**
 * The layout pass alone — everything drawAgent needs to paint, exposed so a
 * scene can ask "where is this cell at playhead T" without drawing (e.g. the
 * launch position of a chip about to fall).
 */
export const layoutAgent = (
  spec: AgentSpec,
  cx: number,
  anchorY: number,
  w: number,
  scale = 1,
): AgentLayout => {
  const slabH = SLAB_H * scale
  const gap = SLAB_GAP * scale
  const pad = PAD * scale
  const x = cx - w / 2
  const cells: AgentLayout['cells'] = {}

  let cursor = anchorY
  const placed: { slab: Slab; y: number; h: number; pres: number }[] = []
  spec.slabs.forEach((slab, i) => {
    const pres = slab.presence ?? 1
    const h = (slab.height ?? SLAB_H) * scale
    const below = spec.slabs[i - 1]
    const gb = slab.gapBefore ?? (slab.child && !(below?.child) && i > 0 ? 0.5 : 0)
    cursor -= gb * slabH * pres
    const y = cursor
    placed.push({ slab, y, h, pres })
    const above = spec.slabs[i + 1]
    const step = slab.child && !(above?.child) ? gap * 0.4 : gap
    cursor -= (h + step) * pres

    // Register named cells at the slab's own y. A collapsed slab registers
    // nothing: its degenerate position would overwrite a live cell of the
    // same name elsewhere in the stack (the Figma slot chased a collapsed
    // logo row's phantom cell before this guard).
    if (pres <= 0.01) return
    if (slab.brands?.length) {
      const bc = brandCols(slab.brands.length, w, gap)
      slab.brands.forEach((brand, ci) => {
        if (slab.hiddenEntries?.includes(ci)) return
        cells[brand.name] = { x: x + bc.xAt(ci), y, w: bc.cw, h }
      })
    } else if (slab.chips?.length) {
      const cols = chipCols(slab.chips, w, gap)
      slab.chips.forEach((chip, ci) => {
        cells[chip] = { x: x + cols.xs[ci]!, y, w: cols.widths[ci]!, h }
      })
    } else if (slab.tone === 'dashed' && slab.brand) {
      cells[slab.brand.name] = { x: x + w * 0.12, y, w: w * 0.76, h }
    }
  })
  const topY = cursor + gap
  const footers = spec.footers ?? []
  const footerH = footers.length ? slabH + gap : 0
  const bottomY = anchorY + slabH + footerH
  // Presence of a header, not its content: a card mid-rename holds the empty
  // string for a frame, and sizing the band to the text collapsed the card's
  // top the instant the last character went and snapped it back as the first
  // new one arrived.
  const headerPad =
    spec.header !== undefined
      ? pad + 14 * ((HEADER_SIZE(scale) * (spec.headerScale ?? 1)) / HEADER_BASE)
      : pad
  const cardRect = {
    x: x - pad,
    y: topY - headerPad,
    w: w + pad * 2,
    h: bottomY - topY + headerPad + pad,
  }
  return { placed, topY, bottomY, cardRect, cells }
}

/**
 * Draw one agent. `cx` is the horizontal centre; `anchorY` is the TOP edge of
 * slab 0 (the model). Returns geometry so callers can wire links to chips.
 */
export const drawAgent = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  cx: number,
  anchorY: number,
  w: number,
  spec: AgentSpec,
  scale = 1,
): AgentBox => {
  const alpha = spec.alpha ?? 1
  const slabH = SLAB_H * scale
  const gap = SLAB_GAP * scale
  const pad = PAD * scale
  const x = cx - w / 2
  const chipRects: Record<string, { x: number; y: number; w: number; h: number }> = {}
  const slabCentres: { x: number; y: number }[] = []
  let stackTop = Infinity

  const L = layoutAgent(spec, cx, anchorY, w, scale)
  const { placed, topY, bottomY } = L
  Object.assign(chipRects, L.cells)
  const footers = spec.footers ?? []

  ctx.save()
  ctx.globalAlpha *= alpha

  // The hero's group treatment: a solid panel card with a dithered drop
  // shadow, so the stack reads as one high-contrast object on the field.
  const cardRect = L.cardRect
  if (spec.card !== false && cardRect.h > pad) {
    ditherRect(
      ctx,
      cardRect.x + 7 * scale, cardRect.y + 7 * scale,
      cardRect.w, cardRect.h,
      ink(p, 0.5), 4,
    )
    ctx.fillStyle = p.panel
    ctx.fillRect(cardRect.x, cardRect.y, cardRect.w, cardRect.h)
    ctx.strokeStyle = ink(p, 0.55)
    ctx.lineWidth = 1.2
    ctx.strokeRect(cardRect.x, cardRect.y, cardRect.w, cardRect.h)

    // Hero-panel header in the card's top band: gold bullet + small caps.
    // Tested against undefined, not for truthiness: a header mid-rename passes
    // through the empty string, and dropping the bullet for that frame read as
    // the whole band flickering rather than as the words being retyped.
    if (spec.header !== undefined) {
      const size = HEADER_SIZE(scale) * (spec.headerScale ?? 1)
      // Everything in the header band is sized off `hs`, the card's scale with
      // the type's own floor already folded in — NOT off `scale`. The type
      // stops shrinking at 8.5px while the card keeps going, so a bullet and a
      // gap measured in raw `scale` kept shrinking out from under words that
      // had stopped: the mark drifted into the letters and turned into a speck.
      // One scale for the band means the band shrinks as a unit and then holds
      // its shape, which is what makes the smallest cards still read.
      const hs = size / HEADER_BASE
      ctx.save()
      ctx.font = `600 ${size}px ${SANS}`
      // Tracking BEFORE the measurement. Setting it afterwards measured a
      // string narrower than the one that got drawn, so the plate sized to it
      // ended short and the last few letters ran off it into dark ink on a
      // dark card — the header read as truncated.
      if (spec.headerTone === 'gold') {
        ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${HEADER_TRACK}px`
      }
      const tw = ctx.measureText(spec.header.toUpperCase()).width
      if (tw + 26 * hs < cardRect.w) {
        const hy = cardRect.y + Math.max(12, 13 * hs)
        // `headerTone: 'gold'` swaps the bullet for a filled gold plate behind
        // the words. It is for a header that is making a claim about the card
        // rather than naming it, so it has to carry more weight than the
        // hairline treatment every other card wears.
        if (spec.headerTone === 'gold') {
          // Canvas letterSpacing adds a gap AFTER every glyph, the last one
          // included, so the measured width carries one trailing space the eye
          // does not see. Left in, it pushes the plate out to the right and the
          // text reads as sitting off-centre inside it.
          const textW = tw - HEADER_TRACK
          const padX = 7 * hs
          // Centred on the cap box rather than on the baseline: a baseline-
          // centred plate leaves the descender space below the letters and
          // nothing above them, which is what makes the text look dropped.
          const capH = size * 0.72
          const plateH = capH + 9 * hs
          const plateY = hy - capH / 2 - plateH / 2
          const plateX = cardRect.x + 10 * hs - padX
          ctx.fillStyle = gold(p, p.light ? 0.92 : 0.8)
          ctx.fillRect(plateX, plateY, textW + padX * 2, plateH)
          ctx.fillStyle = p.light ? 'rgba(255, 255, 255, 0.97)' : 'rgba(30, 41, 59, 0.92)'
          ctx.fillText(spec.header.toUpperCase(), plateX + padX, hy)
        } else {
          const bulletSize = 4.5 * hs
          const bulletY = hy - size * 0.62
          ctx.fillStyle = gold(p, 0.95)
          ctx.fillRect(cardRect.x + 10 * hs, bulletY, bulletSize, bulletSize)
          // Selected, right to left, before the words are replaced. The hatch
          // goes down first so the type sits on it rather than behind it.
          const sel = spec.headerHighlight ?? 0
          if (sel > 0.001 && !spec.wordless) {
            const tw2 = sectionLabelWidth(ctx, spec.header, size)
            // Barely any bleed. A selection is meant to sit on the words, and
            // at this type size three pixels of lead-in reads as a box that
            // starts before the first letter rather than on it.
            const padX = 1 * hs
            const selX = cardRect.x + 18 * hs - padX
            const full = tw2 + padX * 2
            const selW = full * Math.min(1, sel)
            const barH = size * 1.25
            ditherRect(
              ctx,
              selX + full - selW,
              hy - barH * 0.72,
              selW,
              barH,
              // Held back on dark, where a gold hatch on black is already the
              // brightest thing in the card.
              gold(p, p.light ? 0.95 : 0.62),
              ACCENT_DENSITY,
            )
          }
          if (spec.wordless) {
            // The header as a skeleton: one bar per word, each the width the
            // word would actually have set. Small type repeated across a graph
            // is noise the eye tries to read and cannot; a bar is legible as
            // "there is a name here, the same one as on every other card",
            // which is the only thing this header has left to say. Measured
            // rather than guessed, so the mark keeps the rhythm of the words.
            let bx = cardRect.x + 18 * hs
            const barH = size * 0.46
            // Centred on the bullet, not hung off the baseline. Type sits on a
            // baseline with its weight above it; a bar has no such asymmetry,
            // so matching the baseline left it visibly high beside the mark —
            // and by a different amount on every card, since the two were
            // measured against different scales.
            const barY = bulletY + bulletSize / 2 - barH / 2
            ctx.fillStyle = ink(p, 0.45)
            for (const word of spec.header.split(' ')) {
              const ww = ctx.measureText(word.toUpperCase()).width
              ctx.fillRect(bx, barY, ww, barH)
              bx += ww + size * 0.42
            }
            noteBounds(cardRect.x + 18 * hs, barY, bx - cardRect.x - 18 * hs, barH)
          } else {
            sectionLabel(ctx, p, spec.header, cardRect.x + 18 * hs, hy, size, 0.66)
          }
        }
      }
      ctx.restore()
    }
  }

  if (spec.boundary) {
    const bp = spec.card !== false ? pad * 1.7 : pad
    drawGroupFrame(
      ctx, p,
      x - bp, topY - bp,
      w + bp * 2, bottomY - topY + bp * 2,
      spec.boundaryLabel, spec.boundaryTone ?? 'neutral',
    )
  }

  if (spec.title) {
    ctx.save()
    ctx.textAlign = 'center'
    // Above the CARD, not the stack — the card's header band extends higher
    // than the top slab.
    sectionLabel(ctx, p, spec.title, cx, cardRect.y - 8 * scale, Math.max(9, 10 * scale), 0.7)
    ctx.restore()
  }

  placed.forEach(({ slab, y, h, pres }, i) => {
    if (pres <= 0.004) return
    const hollow = spec.hollowAboveModel && i > 0
    ctx.save()
    ctx.globalAlpha *= ease(pres)
    // Slide in from slightly above as it arrives.
    ctx.translate(0, (1 - ease(pres)) * -10 * scale)

    if (slab.brands?.length) {
      // A row of attached objects (the deck's MCP-server logo rows): each
      // entry in its own dashed chip, mark + name.
      const bc = brandCols(slab.brands.length, w, gap)
      const cw = bc.cw
      slab.brands.forEach((brand, ci) => {
        if (slab.hiddenEntries?.includes(ci)) return
        const bx = x + bc.xAt(ci)
        ctx.save()
        ctx.strokeStyle = ink(p, 0.45)
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
        ctx.strokeRect(bx, y, cw, h)
        ctx.setLineDash([])
        ctx.restore()
        if (!spec.wordless) {
          drawBrandEntry(ctx, p, brand, bx + cw / 2, y + h / 2, h * 0.6, Math.max(9, 9.5 * scale), 0.82)
        }
      })
    } else if (slab.chips?.length) {
      // Chip row: equal columns across the slab width.
      //
      // `split` animates the row's own division. At 0 the columns butt
      // together and carry the slab's label, so the row is indistinguishable
      // from a plain slab; as it grows the gaps open, the one label fades and
      // the chips' own labels take over. The division is the thing being
      // shown, so it has to be watchable rather than swapped in.
      // Three moves in sequence, never at once: the row's own label leaves
      // first, THEN the bar parts into columns, THEN the columns take their
      // names. Played backwards it is the same three in reverse, because each
      // is a function of `split` rather than an event.
      const split = slab.split ?? 1
      // Each stage eased on its own and handed over with a slight overlap. A
      // hard baton-pass between three linear ramps is what reads as stepping;
      // the parting in particular needs the long middle of the move, since it
      // is the only one carrying real motion.
      const oldText = 1 - ease(seg(split, 0, 0.24))
      const parted = ease(seg(split, 0.18, 0.82))
      const chipText = ease(seg(split, 0.7, 1))
      const n = slab.chips.length
      const g = gap * parted
      const cols = chipCols(slab.chips, w, g)
      // One bar, then the gaps cut out of it. Three abutting fills leave
      // antialiased hairlines at the joins, so an undivided row read as
      // already-divided before the move began.
      if (!hollow) {
        ctx.fillStyle = ink(p, 0.82)
        ctx.fillRect(x, y, w, h)
        if (g > 0.01) {
          ctx.fillStyle = p.panel
          for (let ci = 1; ci < n; ci += 1) ctx.fillRect(x + cols.xs[ci]! - g, y, g, h)
        }
      }
      slab.chips.forEach((chip, ci) => {
        const chipX = x + cols.xs[ci]!
        const cw = cols.widths[ci]!
        chipRects[chip] = { x: chipX, y, w: cw, h }
        if (hollow) {
          ctx.strokeStyle = ink(p, 0.32)
          ctx.lineWidth = 1
          ctx.strokeRect(chipX, y, cw, h)
          ditherRect(ctx, chipX, y, cw, h, ink(p, 0.3), 2)
        } else if (chipTone(slab, chip) && parted > 0.001) {
          // Colour arrives with the division: before it, this column is still
          // part of one undivided Tools bar, and a coloured band inside a bar
          // that has not yet parted reads as a highlight rather than as one of
          // the kinds the row is about to separate into.
          ctx.save()
          ctx.globalAlpha *= parted
          // Same field as an accented slab, so a kind of tool and a part of
          // the agent are marked the same way wherever they appear.
          accentField(ctx, p, chipTone(slab, chip)!, chipX, y, cw, h)
          ctx.restore()
        }
        ctx.save()
        ctx.globalAlpha *= chipText * (spec.wordless ? 0 : 1)
        ctx.textAlign = 'center'
        ctx.font = `600 ${Math.max(8.5, 9.5 * scale)}px ${MONO}`
        const tone = chipTone(slab, chip)
        ctx.fillStyle = hollow ? ink(p, 0.7) : tone && parted > 0.5 ? ink(p, 0.95) : p.panel
        ctx.fillText(fitText(ctx, chip, cw - 8 * scale), chipX + cw / 2, y + h / 2 + 3.5 * scale)
        ctx.restore()
      })
      // The label the row had before it divided, gone before the bar parts.
      if (slab.label && oldText > 0.001 && !spec.wordless) {
        ctx.save()
        ctx.globalAlpha *= oldText
        ctx.textAlign = 'center'
        ctx.font = `600 ${Math.max(9, 11 * scale)}px ${MONO}`
        ctx.fillStyle = p.panel
        ctx.fillText(slab.label, cx, y + h / 2 + 4 * scale)
        ctx.restore()
      }
    } else if (slab.tone === 'dashed') {
      // Dashed chip — the deck's MCP tool entries: real mark + name. The box
      // is sized to what it holds rather than to a fixed share of the slab:
      // a fixed slot leaves the chip's own dashed outline nested inside a
      // second, wider one, which reads as two containers for one thing.
      // Full slab width, like every other row: the identity slot is part of
      // the stack rather than a chip sitting inside it, and a narrower box
      // reads as a second container nested in the first.
      const boxW = w
      const boxX = cx - boxW / 2
      // While a chip is still flying to this slot the slab only holds the
      // space open. The chip carries its own dashed border, so drawing one
      // here too would put an empty outline under a moving one.
      if (!slab.contentHidden) {
        ctx.strokeStyle = ink(p, 0.45)
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
        ctx.strokeRect(boxX, y, boxW, h)
        ctx.setLineDash([])
      }
      // The slot the sprite flies into is this box, so the landing chip lands
      // on the outline rather than beside it.
      if (slab.brand) chipRects[slab.brand.name] = { x: boxX, y, w: boxW, h }
      if (spec.wordless) {
        // The identity slot keeps its dashed outline; the mark and its name are
        // type like any other label.
      } else if (slab.brand && !slab.contentHidden) {
        drawBrandEntry(ctx, p, slab.brand, cx, y + h / 2, h * 0.6, Math.max(9, 9.5 * scale), 0.8)
      } else if (slab.label && !slab.contentHidden) {
        ctx.textAlign = 'center'
        ctx.font = `500 ${Math.max(8.5, 9.5 * scale)}px ${MONO}`
        ctx.fillStyle = ink(p, 0.7)
        ctx.fillText(fitText(ctx, slab.label, w * 0.7), cx, y + h / 2 + 3.5 * scale)
      }
    } else {
      const tone = slab.tone ?? 'solid'
      if (hollow || tone === 'field') {
        ctx.strokeStyle = ink(p, 0.3)
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, w, h)
        ditherRect(ctx, x, y, w, h, tone === 'gold' ? p.field : ink(p, 0.32), 3)
      } else if (tone === 'gold') {
        ctx.fillStyle = gold(p, 0.9)
        ctx.fillRect(x, y, w, h)
      } else if (slab.accent) {
        // Accented parts are half-toned rather than flooded. A solid field of
        // any of these hues is a much heavier mark than the ink slabs around
        // it — the row stops being one of several parts and becomes the
        // subject — and in light mode a dark enough fill to carry white type
        // reads as a muddy version of the hue rather than the hue. The dither
        // keeps the colour identifiable at a weight that matches the stack.
        accentField(ctx, p, slab.accent, x, y, w, h)
      } else {
        ctx.fillStyle = ink(p, 0.82)
        ctx.fillRect(x, y, w, h)
      }
      if (slab.label && !spec.wordless) {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.font = `600 ${Math.max(9, 10 * scale)}px ${MONO}`
        // On a half-tone the type takes the page's own ink, not the accent: a
        // full-strength hue set on a field of the same hue is the one pairing
        // the dither cannot hold apart.
        ctx.fillStyle =
          hollow || tone === 'field' ? ink(p, 0.72) : slab.accent ? ink(p, 0.95) : p.panel
        ctx.fillText(fitText(ctx, slab.label, w - 12 * scale), cx, y + h / 2 + 3.5 * scale)
        ctx.restore()
      }
    }
    ctx.restore()
    slabCentres.push({ x: cx, y: y + h / 2 })
    stackTop = Math.min(stackTop, y)
  })

  if (footers.length) {
    const n = footers.length
    const fw = (w - gap * (n - 1)) / n
    const fy = anchorY + slabH + gap
    const fh = slabH
    footers.forEach((f, i) => {
      const pres = f.presence ?? 1
      if (pres <= 0.004) return
      const fx = x + i * (fw + gap)
      ctx.save()
      ctx.globalAlpha *= ease(pres)
      if (f.accent) accentField(ctx, p, f.accent, fx, fy, fw, fh)
      else {
        ctx.fillStyle = ink(p, 0.82)
        ctx.fillRect(fx, fy, fw, fh)
      }
      ctx.textAlign = 'center'
      ctx.font = `600 ${Math.max(9, 10 * scale)}px ${MONO}`
      if (spec.wordless) ctx.globalAlpha = 0
      ctx.fillStyle = f.accent ? ink(p, 0.95) : p.panel
      ctx.fillText(fitText(ctx, f.label, fw - 12 * scale), fx + fw / 2, fy + fh / 2 + 3.5 * scale)
      ctx.restore()
      chipRects[f.label] = { x: fx, y: fy, w: fw, h: fh }
    })
  }

  ctx.restore()
  // The card is the outermost thing an agent paints; slabs and chips live
  // inside it, so one note covers the whole stack.
  noteBounds(cardRect.x, cardRect.y, cardRect.w, cardRect.h)
  noteBounds(x, topY, w, bottomY - topY)
  return {
    x,
    y: topY,
    w,
    h: bottomY - topY,
    card: cardRect,
    // The top of the topmost slab that was actually DRAWN. `topY` is where the
    // stack was laid out, which includes rows still at zero presence and the
    // gaps reserved for them, so anything anchored to it floats above a card
    // whose visible content starts lower down.
    stackTop: Number.isFinite(stackTop) ? stackTop : topY,
    slabCentres,
    chipRects,
  }
}

/**
 * Extent of an agent spec around its anchor line, without drawing it.
 * `above` is the span from the top of the stack to the anchor (Model top);
 * `below` is the Model slab plus any footer row. Scenes use this to centre a
 * keyframe's END state in the frame: anchorY = h / 2 + (above - below) / 2.
 */
export const measureAgent = (spec: AgentSpec, scale = 1) => {
  const slabH = SLAB_H * scale
  const gap = SLAB_GAP * scale
  let cursor = 0
  for (const slab of spec.slabs) {
    const pres = slab.presence ?? 1
    const h = (slab.height ?? SLAB_H) * scale
    cursor += (slab.gapBefore ?? 0) * slabH * pres
    cursor += (h + gap) * pres
  }
  const above = Math.max(0, cursor - gap - slabH)
  const below = slabH + (spec.footers?.length ? slabH * 0.72 + gap : 0)
  return { above, below }
}

/** Dashed link between two boxes, optionally with an arrowhead or a
    travelling packet. The deck's composition slides connect agents with
    plain arrows. */
export const drawLink = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress = -1,
  tone: 'neutral' | 'gold' = 'neutral',
  arrow = false,
) => {
  ctx.save()
  ctx.strokeStyle = tone === 'gold' ? gold(p, 0.7) : ink(p, 0.4)
  ctx.lineWidth = 1.1
  ctx.setLineDash([4, 5])
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.setLineDash([])
  if (arrow) {
    const a = Math.atan2(to.y - from.y, to.x - from.x)
    const s = 6
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - s * Math.cos(a - 0.45), to.y - s * Math.sin(a - 0.45))
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - s * Math.cos(a + 0.45), to.y - s * Math.sin(a + 0.45))
    ctx.stroke()
  }
  ctx.restore()
  if (progress >= 0 && progress <= 1) {
    drawPulse(
      ctx,
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
      2.5,
      tone === 'gold' ? p.goldBright : ink(p, 0.85),
    )
  }
}
