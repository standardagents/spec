/**
 * The domain-agents story as keyframed timelines.
 *
 * Beats that build on one another are NOT separate pictures — they are
 * integer keyframes on one continuous track, drawn by one pure function of a
 * playhead T. Scrolling to a beat tweens the playhead to that beat's
 * keyframe: forward when scrolling down, backward when scrolling up. Because
 * every element is a pure function of T, reverse playback needs no extra
 * code, and there is no crossfade and no redraw — the object simply moves.
 *
 * Tracks:
 *   anatomy  T 0..8 — ? → definition → context → inheritance → composition
 *                     → figma agent → the team → the ideal agent → the
 *                     fractal graph. One object, one baseline: every card on
 *                     screen at T=8 descends from the stack built at T=1, so
 *                     the whole argument is one continuous object rather than
 *                     a series of pictures of it.
 *   team     time-based arc (a standalone diagram; plays on arrival).
 * Track switches are hard cuts at the scroll boundary; inside a track,
 * everything is played, never faded. That is why the story keeps collapsing
 * onto the anatomy track — a beat that has to grow out of the one before it
 * cannot live on a track of its own.
 *
 * CENTRING. Each integer keyframe's END state is measured (measureAgent) and
 * the frame centres that finished composition; the anchor glides between
 * neighbouring keyframes' centres as the playhead crosses a segment.
 *
 * Every diagram remains a themed reproduction of Justin Schroeder's slides —
 * see CITATIONS. Brand marks are sourced (simple-icons); brands without a
 * sourceable mark are typeset name-only.
 */

import {
  type AgentSpec,
  type BrandRef,
  type Palette,
  SLAB_PITCH,
  accent,
  clamp01,
  drawAgent,
  drawBrace,
  drawBrandEntry,
  drawCursor,
  drawPackageMorph,
  ditherRect,
  packageHull,
  tracePolygon,
  drawSkull,
  drawLink,
  ease,
  gold,
  ink,
  layoutAgent,
  measureAgent,
  MONO,
  SANS,
  seg,
  ss,
} from './scene-kit'

export type Scene = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  p: Palette,
) => boolean | undefined

/** A keyframed track: draw at continuous playhead T in [0, keyframes]. */
export interface TimelineTrack {
  keyframes: number
  /**
   * `dir` is +1 playing forward, -1 rewinding. Scenes are otherwise pure
   * functions of T; a track uses this only where the way out should differ
   * from the way in, rather than being the way in reversed.
   */
  draw: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    T: number,
    p: Palette,
    dir?: number,
  ) => void
  /**
   * Keyframes per second at a given playhead, when one segment carries more
   * than the default pace can tell. The specialist segment builds four agents
   * in turn; at the standard rate that is under a second for the lot.
   */
  rateAt?: (playhead: number, dir?: number) => number
  /**
   * True where the scene keeps moving after the playhead has arrived — the
   * rig otherwise parks the loop the moment a beat settles.
   */
  animatesAt?: (playhead: number) => boolean
}

/**
 * Recording timestamps (Sigil meetup, 2h13m recording) backing each beat.
 * Slide references are frame grabs from that recording; the spoken lines are
 * in the transcript captured alongside them.
 */
export const CITATIONS: Record<string, string> = {
  question:
    'Framing device for the section headline: the empty agent outline ' +
    'precedes the anatomy build that starts at 53:47.',
  definition:
    'Slide "Agents are deterministic software…" at 48:00; spoken 47:41. ' +
    'Stack build "first, we\'ve got your model… a system prompt on top of ' +
    'that… then you get your tools on top of it" 53:47–54:17 (slides 53:50, 54:20).',
  context:
    'Slide at 54:52: Model / System Prompt / Tools / Skill / MCP / Messages ' +
    'with a right-side brace labelled "Context" spanning everything except ' +
    'the Model. Spoken 54:39.',
  inheritance:
    'Slide at 55:52: the same stack grown with service logos and icon-led ' +
    'MCP tool chips; the brace relabels to "Inheritance". Spoken 55:13–55:44.',
  composition:
    'Text slide "Composition over inheritance" (~56:00); spoken 55:44. Lands ' +
    'on the tiny agent of the 56:30 slide: Messages / Tools / System Prompt / Model.',
  specialist:
    'Slide at 56:30: the tiny agent with the Figma mark set into its stack. ' +
    'Spoken 56:21.',
  team:
    'Slide at 57:20: a small coordinator on top, arrows down to four tiny ' +
    'agents, each carrying a service mark. Spoken 56:46–57:22.',
  ideal:
    'Slides 67:00–68:20 ("Let\'s dream a little…" / "What is in an ideal ' +
    'agent?"). Spoken 63:49–68:01.',
  fractal:
    'Slide at 69:00: a coordination agent calling Salesforce, Google Workspace ' +
    'and email-sending agents, one of which calls an agent of its own. Spoken ' +
    '68:01–68:29.',
}

/**
 * The enclosure's own surface: one half-tone, used both for the wash behind
 * the graph and for the interior of the package that graph becomes. It has to
 * be the same colour at the same density in both places, or the fill appears
 * to thicken at the moment the container turns into a mark.
 *
 * At a density of 4 of 16 this averages to roughly a tenth of the gold, which
 * is the weight the flat wash used to carry.
 */
const CONTAINER_FIELD = (p: Palette) => gold(p, p.light ? 0.42 : 0.36)

/** Linear interpolation. Module scope: every beat in this file reaches for
    it, and one of them being a separate function from the anatomy build is
    not a reason for it to be out of reach there. */
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** Where the composition ends up once it is one package. Shared, so the beat
    that follows starts from exactly where this one finished. */
const heroPack = (w: number, h: number) => {
  const side = Math.min(w, h) * 0.34
  return {
    side,
    rect: { x: w / 2 - side / 2, y: h * 0.44 - side * 0.55, w: side, h: side * 1.1 },
  }
}

/**
 * The package's scope, and the services a standard agent gets built for.
 *
 * Once the name has typed itself in, the beat does not stop: it deletes the
 * service off the end and types another, and another. One package with a name
 * is a demo; a name that keeps becoming a different service is the argument —
 * that this is a shape you apply to whatever you work with, not a thing that
 * was made once.
 */
const PACKAGE_SCOPE = '@agents/'
// Names a reader will recognise without thinking about it. Anything they have
// to stop and identify costs more attention than the joke is worth, and the
// joke is only that the list never ends.
const SERVICES = [
  'gmail', 'slack', 'notion', 'figma', 'linear', 'stripe', 'github', 'jira',
  'salesforce', 'hubspot', 'zendesk', 'intercom', 'shopify', 'twilio',
  'mailchimp', 'asana', 'trello', 'dropbox', 'airtable', 'calendly', 'zoom',
  'outlook', 'sheets', 'docs', 'drive', 'confluence', 'gitlab', 'sentry',
  'datadog', 'snowflake', 'tableau', 'quickbooks', 'docusign', 'cloudflare',
  'vercel', 'supabase', 'postgres', 'youtube', 'spotify', 'discord', 'reddit',
  'linkedin', 'instagram', 'whatsapp', 'paypal', 'square', 'zapier', 'canva',
  'wordpress', 'webflow',
]

/**
 * The name at a given moment: hold, backspace the service, type the next one.
 *
 * Driven by the wall clock rather than by the playhead, because it runs on a
 * SETTLED beat — the playhead has arrived and stopped, and there is nothing
 * left for it to drive. `holdOnly` freezes it mid-word for the initial reveal,
 * so the name being typed in for the first time is not also being rewritten.
 */
/**
 * When the cycle's clock started. Zeroed while the name is still being
 * revealed and set the moment it finishes, so the FIRST name always gets a
 * full hold — on a bare wall clock the reveal could finish anywhere in the
 * period, including a hundred milliseconds before the backspace, and the name
 * the reader just watched being typed would immediately be taken apart.
 */
let nameEpoch = 0

const packageCycle = (now: number, holdOnly = false) => {
  const HOLD = 4200
  const SWAP = 520
  const period = HOLD + SWAP
  const i = Math.floor(now / period)
  const t = now % period
  return {
    cur: SERVICES[i % SERVICES.length]!,
    next: SERVICES[(i + 1) % SERVICES.length]!,
    swap: holdOnly || t < HOLD ? 0 : (t - HOLD) / SWAP,
  }
}

/**
 * Where the name sits. The scope is LOCKED: it is the constant half of the
 * name and it must not shuffle sideways every time a longer or shorter service
 * takes the other half. So the lockup is centred on the AVERAGE word rather
 * than on whichever word happens to be showing — most of them then sit close
 * to centred, and none of them moves the part that never changes.
 *
 * The longest word still has to fit, so if centring on the average would push
 * it past the frame the whole lockup slides left until it does.
 */
const packageNameLayout = (ctx: CanvasRenderingContext2D, w: number) => {
  const ch = ctx.measureText('M').width
  const scopeW = PACKAGE_SCOPE.length * ch
  const avg = SERVICES.reduce((s, x) => s + x.length, 0) / SERVICES.length
  const longest = Math.max(...SERVICES.map((x) => x.length))
  const margin = w * 0.06
  let x = w / 2 - (scopeW + avg * ch) / 2
  const overflow = x + scopeW + longest * ch - (w - margin)
  if (overflow > 0) x -= overflow
  return { x, wordX: x + scopeW }
}

/** The registry grid: a wall of published packages, and the six a reader
    picks out of it. Fixed, not random — a beat has to play the same way
    every time it is scrolled through. */
const REGISTRY_COLS = 6
const REGISTRY_ROWS = 4
const PICKED = [7, 15, 3, 20, 10]
/** The stretch of the segment the hand gets, from entering to leaving. */
const PICK_FROM = 0.3
const PICK_TO = 0.99

/**
 * Per-leg variation. Deterministic, from the leg's index — the beat has to
 * play the same way every time it is scrolled through and the same backwards,
 * so this cannot be Math.random(). Two hands never cross the same distance in
 * the same time, and a cursor that does reads as a tween.
 */
const legJitter = (n: number) => {
  const v = Math.sin(n * 78.233 + 3.1) * 43758.5453
  return v - Math.floor(v)
}

/** Slow out of rest, slow into the target, quick through the middle — a
    quartic rather than a smoothstep, whose middle is nearly linear and reads
    as something being dragged at constant speed. */
const glide = (t: number) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2

/** Beat id → its home on a track. */
export const BEAT_TARGETS: Record<string, { track: 'anatomy' | 'team'; kf: number }> = {
  question: { track: 'anatomy', kf: 0 },
  definition: { track: 'anatomy', kf: 1 },
  context: { track: 'anatomy', kf: 2 },
  inheritance: { track: 'anatomy', kf: 3 },
  composition: { track: 'anatomy', kf: 4 },
  specialist: { track: 'anatomy', kf: 5 },
  // Same track as the specialist build, not a scene of its own: the four
  // cards it ends on are the four this beat arranges, so they have to be the
  // same objects moving rather than a fresh panel drawing them again.
  team: { track: 'anatomy', kf: 6 },
  // The coordinator IS this beat's agent: it sheds its coordination slot,
  // subdivides its tools and grows the rest. Same track, so it transforms
  // rather than being replaced by a picture of a different agent.
  ideal: { track: 'anatomy', kf: 7 },
  // The coordination agent at the head of the chain IS the ideal agent the
  // previous beat just finished building, so it travels and shrinks into its
  // place at the left rather than being replaced by a picture of an agent that
  // happens to look like it. That only holds on one track: switching tracks is
  // a hard cut between two canvases, which is what used to make the ideal
  // agent vanish and a finished graph appear in its place.
  fractal: { track: 'anatomy', kf: 8 },
  // The composition is a thing you can ship. Same card, same graph — folded
  // down into the one object you would actually install.
  package: { track: 'anatomy', kf: 9 },
  // Published. The package joins a wall of them, and a reader takes what they
  // need instead of building it — which only works because anything conforming
  // runs anywhere conforming.
  registry: { track: 'anatomy', kf: 10 },
}

// -------------------------------------------------------------------------
// Shared geometry: reserve annotation space while the brace is visible.
// -------------------------------------------------------------------------
/**
 * Type size of the container's own name. Shared by the group transform that
 * has to reserve room above the boundary and by the draw that fills it, so the
 * reserved band and the drawn label can never disagree — which is exactly how
 * the label ended up clipped off the top of the canvas.
 */
const containerLabelSize = (h: number) => Math.min(h * 0.034, 19)

const sceneScale = (h: number) => Math.max(0.52, Math.min(1.9, (h * 0.92) / (14.2 * SLAB_PITCH)))

const layout = (ctx: CanvasRenderingContext2D, w: number, h: number, T = 3) => {
  const scale = sceneScale(h)
  const brace = ease(seg(T, 1.85, 2.05)) * (1 - ease(seg(T, 3.05, 3.3)))
  ctx.save()
  ctx.font = `600 ${Math.max(14, 19 * scale)}px ${SANS}`
  const labelWidth = lerp(
    ctx.measureText('Context').width,
    ctx.measureText('Inheritance').width,
    ss(seg(T, 2.82, 2.98)),
  )
  ctx.restore()
  return {
    cx: w / 2 - (42 * scale + labelWidth) * brace / 2,
    slabW: Math.min(w * 0.52, 250 * scale),
    scale,
  }
}

const CHIP_BRANDS: BrandRef[] = [
  { slug: 'react', name: 'React' },
  { slug: 'github', name: 'GitHub' },
]
// Only servers we can show with a real mark. The house rule is never to
// hand-draw an icon, and a name-only chip in a row of logos reads as a
// missing asset rather than a deliberate choice, so those are simply cut.
const LOGO_ROWS: BrandRef[][] = [
  [{ slug: 'gmail', name: 'Gmail' }, { slug: 'googlesheets', name: 'Sheets' }],
  [{ slug: 'figma', name: 'Figma' }, { slug: 'notion', name: 'Notion' }],
]

// -------------------------------------------------------------------------
// ANATOMY TRACK — T in 0..5.
// Physical order (bottom-up) never changes; presence is what animates, so a
// slab collapsing on the way out is the same motion as it arriving, reversed.
// -------------------------------------------------------------------------
const anatomySpec = (T: number): AgentSpec => {
  const on = (a: number, b: number) => ease(seg(T, a, b))
  const off = (a: number, b: number) => 1 - ease(seg(T, a, b))
  const fig = on(4.1, 4.5)
  // An entry leaves its row the instant its fall begins — the sprite owns it
  // from then on (and for Figma, forever after).
  const hiddenIn = (row: number) =>
    SERVERS.filter((sv) => sv.row === row && T > sv.start).map((sv) => sv.col)
  return {
    // The card has just become the Figma agent, and it holds still for a beat
    // before being renamed for what that makes it. Typed rather than swapped,
    // and finished before the build starts moving it: the rename is the point
    // of the beat, so it does not share the frame with a card in flight.
    header: 'Agent',
    slabs: [
      { label: 'Model', presence: on(0.08, 0.3) },
      {
        brand: { slug: 'figma', name: 'Figma' },
        tone: 'dashed',
        child: true,
        // The sprite draws the mark; the slab only ever opens the slot.
        contentHidden: true,
        presence: fig,
      },
      { label: 'System Prompt', gapBefore: 0.45 * (1 - fig), presence: on(0.34, 0.55) },
      { label: 'Tools', presence: on(0.58, 0.79) },
      { brand: CHIP_BRANDS[0], tone: 'dashed', child: true, presence: on(2.05, 2.3) * off(3.3, 3.65) },
      { brand: CHIP_BRANDS[1], tone: 'dashed', child: true, presence: on(2.25, 2.5) * off(3.35, 3.7) },
      { label: 'Skills', presence: on(1.05, 1.3) * off(3.4, 3.75) },
      { brands: LOGO_ROWS[0], tone: 'plain', child: true, hiddenEntries: hiddenIn(0), presence: on(2.45, 2.65) * off(3.45, 3.8) },
      { brands: LOGO_ROWS[1], tone: 'plain', child: true, hiddenEntries: hiddenIn(1), presence: on(2.6, 2.8) * off(3.5, 3.85) },
      { label: 'MCP', presence: on(1.35, 1.6) * off(3.6, 3.95) },
      // Part of the definition, not of the context beat that follows: an
      // agent has a thread from the moment it exists. Built last of the four
      // and finished ON keyframe 1, so the beat settles complete.
      { label: 'Messages', presence: on(0.82, 1.0) },
    ],
  }
}

// -------------------------------------------------------------------------
// The collapse: between the inheritance and composition keyframes the six
// MCP-server chips detach and FALL — deterministic bounce trajectories, a
// pure function of T, so scrubbing backwards plays them back up into the
// stack. They come to rest in a loose pile at the bottom of the container
// and stay there. At the domain-specific keyframe the Figma chip alone rises
// from the pile into its identity slot; the other five remain behind.
// -------------------------------------------------------------------------

/** name → (row, col) into LOGO_ROWS, plus per-chip character. */
const SERVERS: {
  name: string
  row: number
  col: number
  start: number
  restSlot: number
  /** Which tier of the pile it comes to rest on: 0 floor, 1 on top. */
  layer: number
  tilt: number
  /** Restitution — how lively this chip's bounces are. */
  e: number
}[] = [
  // restSlot fixes where along the floor a chip lands; layer is which of the
  // two tiers it rests on. They are separate so the pile can stack without
  // moving anything sideways. Figma and Notion sit on top, which is why they
  // are the two that leave first.
  { name: 'Gmail', row: 0, col: 0, start: 3.27, restSlot: 0, layer: 0, tilt: -0.1, e: 0.34 },
  { name: 'Sheets', row: 0, col: 1, start: 3.33, restSlot: 2, layer: 0, tilt: 0.08, e: 0.28 },
  { name: 'Figma', row: 1, col: 0, start: 3.29, restSlot: 1, layer: 1, tilt: -0.06, e: 0.38 },
  { name: 'Notion', row: 1, col: 1, start: 3.35, restSlot: 3, layer: 1, tilt: 0.11, e: 0.31 },
]
/**
 * Real ballistic kinematics, closed-form and reversible.
 *
 * The playhead segment is converted to seconds (matching the panel's
 * 1.4 kf/s rate) and each chip free-falls under one gravity, then bounces
 * with its own restitution: bounce height AND duration decay geometrically,
 * exactly as physics does, and a chip's total flight time follows from how
 * far it has to fall — so the top rows land later than the bottom row and
 * the pile assembles as a cascade. Horizontal drift is constant-velocity
 * across the whole flight. Everything is a pure function of T.
 */
// A chip's whole flight has to finish inside the collapse segment. At 1.25 a
// full-height drop plus bounces ran about 1.02 keyframes from a 3.02 start,
// landing at 4.04 — just after the next beat begins, so the pile appeared to
// drop as that beat opened. Everything is down by ~3.7 now.
const KF_PER_SEC = 0.85
const GRAV = 4200 // px/s² — light-cardboard gravity, not lead
const MIN_BOUNCE_V = 260 // px/s — below this the chip stays down

interface ChipFlight {
  /** y offset from launch (px, downward positive), tilt (rad), x progress 0..1,
      done flag. */
  dy: number
  rot: number
  xu: number
  done: boolean
}

const chipFlight = (tKf: number, drop: number, e: number, tilt: number): ChipFlight => {
  const t = Math.max(0, tKf) / KF_PER_SEC
  const v0 = Math.sqrt(2 * GRAV * drop)
  // Phase durations: free fall, then each bounce while it clears the floor.
  const t1 = v0 / GRAV
  let total = t1
  const bounces: { v: number; dur: number }[] = []
  let v = v0 * e
  while (v > MIN_BOUNCE_V && bounces.length < 4) {
    const dur = (2 * v) / GRAV
    bounces.push({ v, dur })
    total += dur
    v *= e
  }
  if (t >= total) return { dy: drop, rot: tilt, xu: 1, done: true }

  const xu = t / total
  // Rotation: eases toward the rest tilt over the flight, with a decaying
  // wobble kicked off by the first impact.
  let rot = tilt * Math.min(1, xu * 1.3)
  if (t > t1) {
    rot += tilt * 0.9 * Math.exp(-(t - t1) * 9) * Math.sin((t - t1) * 34)
  }

  if (t < t1) {
    return { dy: 0.5 * GRAV * t * t, rot, xu, done: false }
  }
  let tb = t - t1
  for (const b of bounces) {
    if (tb < b.dur) {
      // Parabolic arc above the floor: leaves at b.v, returns at b.v.
      return { dy: drop - (b.v * tb - 0.5 * GRAV * tb * tb), rot, xu, done: false }
    }
    tb -= b.dur
  }
  return { dy: drop, rot: tilt, xu: 1, done: true }
}

/** Launch cells: where each chip sits in the FULL inheritance stack. */
const launchCache = new Map<string, Record<string, { x: number; y: number; w: number; h: number }>>()
const launchCellsFor = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const key = `${Math.round(w)}|${Math.round(h)}`
  const hit = launchCache.get(key)
  if (hit) return hit
  const { cx, slabW, scale } = layout(ctx, w, h)
  const cells = layoutAgent(anatomySpec(3), cx, anatomyAnchorAt(3, h, scale), slabW, scale).cells
  launchCache.set(key, cells)
  return cells
}

/** Rest pose in the pile at the container floor. */
const restPose = (
  slot: number,
  w: number,
  h: number,
  cw: number,
  ch: number,
  cx: number,
  layer = 0,
) => {
  // A pile, not a row. The upper tier sits slightly overlapping the lower one
  // and pulled in toward the middle of the heap, so each top chip has
  // something under it to rest on rather than hanging in space.
  const spread = cx + (slot - (SERVERS.length - 1) / 2) * cw * 0.78
  const x = layer ? spread + (cx - spread) * 0.22 : spread
  return {
    x: Math.min(w - cw / 2 - 6, Math.max(cw / 2 + 6, x)),
    y: h - ch / 2 - 6 - layer * ch * 0.52,
  }
}

const drawChipSprite = (
  ctx: CanvasRenderingContext2D,
  p: Palette,
  brand: BrandRef,
  cxq: number,
  cyq: number,
  cw: number,
  ch: number,
  rot: number,
  scale: number,
) => {
  ctx.save()
  ctx.translate(cxq, cyq)
  ctx.rotate(rot)
  ctx.fillStyle = p.panel
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
  ctx.strokeStyle = ink(p, 0.45)
  ctx.lineWidth = 1
  ctx.setLineDash([3, 4])
  ctx.strokeRect(-cw / 2, -ch / 2, cw, ch)
  ctx.setLineDash([])
  drawBrandEntry(ctx, p, brand, 0, 0, ch * 0.6, Math.max(9, 9.5 * scale), 0.82)
  ctx.restore()
}

/** Anchor (Model top) that centres keyframe k's END state; cached. */
const anchorCache = new Map<string, number>()
const anatomyAnchorAt = (k: number, h: number, scale: number) => {
  const key = `${k}|${Math.round(h)}|${scale.toFixed(3)}`
  const hit = anchorCache.get(key)
  if (hit !== undefined) return hit
  const m = measureAgent(anatomySpec(k), scale)
  const anchor = h / 2 + (m.above - m.below) / 2
  anchorCache.set(key, anchor)
  return anchor
}

/**
 * 9→10: the package goes to the registry.
 *
 * The one package the reader just built travels to the head of a grid and the
 * rest of the wall fills in around it — every one of them another published
 * agent. A cursor then picks a handful out: the point of the beat is that you
 * do not have to build them all, and that anything published runs anywhere
 * that conforms to the spec.
 */
const registryDraw = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  T: number,
  p: Palette,
  dir = 1,
) => {
  // Two things differ on the way back, and NEITHER of them is geometry: the
  // cursor is not drawn, and the picks stay picked. A window that moves
  // something jumps the instant the reader turns around — they can turn
  // around anywhere, not only at a keyframe — so every position here is the
  // same function of the playhead in both directions, and the wall retracting
  // and the package growing back are the forward moves played in reverse.
  //
  // What is skipped is the part with no geometry in it: a hand retracing its
  // path and five boxes un-selecting themselves, which is a minute of the
  // reader's life spent watching a decision be undone.
  const back = dir < 0
  const { scale } = layout(ctx, w, h)
  const hero = heroPack(w, h)
  const u = T - 9

  // The grid, sized to leave the frame a margin on every side.
  const marginX = w * 0.08
  const marginY = h * 0.1
  const cellW = (w - marginX * 2) / REGISTRY_COLS
  const cellH = (h - marginY * 2) / REGISTRY_ROWS
  const side = Math.min(cellW, cellH) * 0.56
  const cellAt = (i: number) => {
    const col = i % REGISTRY_COLS
    const row = Math.floor(i / REGISTRY_COLS)
    return {
      x: marginX + col * cellW + cellW / 2 - side / 2,
      y: marginY + row * cellH + cellH / 2 - side * 0.55,
      w: side,
      h: side * 1.1,
    }
  }

  const total = REGISTRY_COLS * REGISTRY_ROWS

  /**
   * The hand's whole route, planned by DISTANCE rather than by clock. Every
   * leg used to get the same slice of the segment whatever it had to cross,
   * so the long entrance flew and a hop between neighbours crawled. Here a
   * leg costs its own length at a fixed speed — jittered a little, because no
   * two are identical — and the finished schedule is mapped onto the window
   * it has. Rate is constant across the beat; only the distances differ.
   */
  const plan = (() => {
    const target = (n: number) => {
      const c = cellAt(PICKED[n]!)
      // Never the same pixel twice: a pointer that lands dead centre on five
      // boxes in a row is a machine visiting coordinates.
      return {
        x: c.x + c.w * (0.34 + legJitter(n * 3 + 1) * 0.36),
        y: c.y + c.h * (0.3 + legJitter(n * 3 + 2) * 0.38),
      }
    }
    // In from the edge NEAREST the first pick. Travel is priced by distance
    // now, so entering from the far corner bought a crossing of the whole
    // frame before anything happened — correctly paced, and far too long a
    // wait for the first click.
    const firstCell = cellAt(PICKED[0]!)
    const entry = { x: -w * 0.06, y: firstCell.y + firstCell.h * 1.4 }
    // Out to the side rather than back the way it came: leaving through the
    // bottom retraces the entrance and reads as the hand changing its mind.
    const exit = { x: w * 1.14, y: h * 0.62 }
    // Quoted in the same units as the distances, so a pause is worth a fixed
    // amount of travel however far the hand had to come to earn it.
    const DWELL = Math.min(w, h) * 0.055
    const REST = Math.min(w, h) * 0.03
    const legs: {
      from: { x: number; y: number }
      to: { x: number; y: number }
      start: number
      arrive: number
      click: number
      bend: number
    }[] = []
    let at = 0
    let from = entry
    for (let n = 0; n < PICKED.length; n += 1) {
      const to = target(n)
      const dur =
        Math.hypot(to.x - from.x, to.y - from.y) * (0.92 + legJitter(n * 3) * 0.16)
      const arrive = at + dur
      const click = arrive + DWELL * (0.7 + legJitter(n + 41) * 0.6)
      legs.push({
        from,
        to,
        start: at,
        arrive,
        click,
        // Shallow. Enough that the path is not a ruled line and the legs are
        // not all the same shape; more than this and the hand looks like it is
        // avoiding something.
        bend: (n % 2 ? -0.09 : 0.07) * (0.6 + legJitter(n + 29) * 0.9),
      })
      at = click + REST * (0.6 + legJitter(n + 7) * 0.9)
      from = to
    }
    const outDur = Math.hypot(exit.x - from.x, exit.y - from.y)
    legs.push({ from, to: exit, start: at, arrive: at + outDur, click: Infinity, bend: 0.05 })
    const span = at + outDur
    const uOf = (d: number) => PICK_FROM + (d / span) * (PICK_TO - PICK_FROM)
    return { legs, uOf }
  })()
  // Backwards the beat is one continuous move that starts the instant the
  // reader turns around and runs the length of the segment: the grid leaving
  // and the package growing back. Windows that stopped short of either end
  // were the problem — one left a stretch where nothing had happened yet, the
  // other finished early and left the rest of the scroll dead.
  const travel = ss(seg(u, 0.06, 0.3))
  const nameOut = 1 - seg(u, 0.0, 0.08)

  // The rest of the wall, filling in from the head outward: each package
  // arrives a beat after the one before it, so the grid populates rather than
  // appearing.
  for (let i = 1; i < total; i += 1) {
    const k = ss(seg(u, 0.08 + i * 0.007, 0.22 + i * 0.007))
    if (k <= 0.01) continue
    const cell = cellAt(i)
    const picked = PICKED.indexOf(i)
    const clickAt = picked < 0 ? 0 : plan.uOf(plan.legs[picked]!.click)
    // Active the moment it is pressed, over a short crossfade — the state
    // change is the RESULT of the click, so it cannot ease in ahead of it.
    const chosen =
      picked < 0 ? 0 : back ? 1 : ss(seg(u, clickAt + 0.004, clickAt + 0.022))
    // And it takes the press: a quick indent under the pointer and back.
    const press =
      picked < 0 || back
        ? 0
        : ss(seg(u, clickAt, clickAt + 0.008)) *
          (1 - ss(seg(u, clickAt + 0.008, clickAt + 0.022)))
    // Grown into place rather than faded in: a package that scales up from
    // nothing is being published, one that fades in was always there.
    const g = (0.6 + 0.4 * k) * (1 - 0.07 * press)
    const box = {
      x: cell.x + (cell.w * (1 - g)) / 2,
      y: cell.y + (cell.h * (1 - g)) / 2,
      w: cell.w * g,
      h: cell.h * g,
    }
    ctx.save()
    ctx.globalAlpha *= k
    drawPackageMorph(ctx, p, box, side * 1.25, 1, 1, {
      shadow: 0,
      lineWidth: lerp(1.6, 2.6, chosen),
      stroke: chosen > 0.5 ? gold(p, p.light ? 0.95 : 0.9) : ink(p, 0.5 + 0.2 * k),
      dither: chosen > 0.02 ? gold(p, (p.light ? 0.42 : 0.36) * chosen) : undefined,
    })
    ctx.restore()

    // The pulse: one square ring leaving the package it was pressed on, in
    // the kit's own shapes. It comes off the BOX, not off the pointer — the
    // thing that responded to the click is what should be seen responding.
    if (picked >= 0 && !back) {
      const ring = ss(seg(u, clickAt, clickAt + 0.04))
      if (ring > 0.01 && ring < 0.999) {
        // The mark's own hull, not a square: the ping is the package
        // answering, so it leaves in the shape of the thing that was clicked.
        const grow = lerp(1.06, 2.3, ring)
        const halo = {
          x: cell.x + cell.w / 2 - (cell.w * grow) / 2,
          y: cell.y + cell.h / 2 - (cell.h * grow) / 2,
          w: cell.w * grow,
          h: cell.h * grow,
        }
        ctx.save()
        ctx.globalAlpha *= 1 - ring
        ctx.strokeStyle = gold(p, 0.9)
        ctx.lineWidth = 2
        tracePolygon(ctx, packageHull(halo, side * 1.25 * grow, 1))
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // The package the reader built, travelling to the head of the grid.
  const head = cellAt(0)
  const box = {
    x: lerp(hero.rect.x, head.x, travel),
    y: lerp(hero.rect.y, head.y, travel),
    w: lerp(hero.rect.w, head.w, travel),
    h: lerp(hero.rect.h, head.h, travel),
  }
  drawPackageMorph(ctx, p, box, lerp(hero.side, side, travel) * 1.25, 1, 1, {
    shadow: 0,
    lineWidth: lerp(5.2, 2.6, travel),
    stroke: gold(p, p.light ? 0.95 : 0.9),
    dither: CONTAINER_FIELD(p),
  })

  // Its name, deleted a character at a time as it leaves the middle of the
  // frame: the package stops being THE subject and becomes one of many.
  if (nameOut > 0.001) {
    // Whatever the cycle happens to be showing, held still while it goes: the
    // name should not still be rotating itself as it is being taken away. Laid
    // out from the same fixed origin, so it does not shift as it shortens.
    const { cur } = packageCycle(performance.now() - nameEpoch, true)
    const full = PACKAGE_SCOPE + cur
    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `600 ${Math.max(20, hero.side * 0.17)}px ${MONO}`
    ctx.fillStyle = ink(p, 0.92)
    ctx.fillText(
      full.slice(0, Math.round(full.length * nameOut)),
      packageNameLayout(ctx, w).x,
      hero.rect.y + hero.rect.h + Math.max(36, hero.side * 0.26),
    )
    ctx.restore()
  }

  // The cursor, walking the planned route. Arcs between targets, eases at both
  // ends of every leg, and leaves the frame when it is done.
  const first = plan.legs[0]!
  if (!back && u > plan.uOf(first.start)) {
    const arc = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      t: number,
      bend: number,
    ) => {
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dx = b.x - a.x
      const dy = b.y - a.y
      const cxp = mx - dy * bend
      const cyp = my + dx * bend
      const it = 1 - t
      return {
        x: it * it * a.x + 2 * it * t * cxp + t * t * b.x,
        y: it * it * a.y + 2 * it * t * cyp + t * t * b.y,
      }
    }
    let pos = first.from
    for (const leg of plan.legs) {
      const from = plan.uOf(leg.start)
      const to = plan.uOf(leg.arrive)
      if (u >= to) {
        pos = leg.to
        continue
      }
      pos = arc(leg.from, leg.to, glide(ss(seg(u, from, to))), leg.bend)
      break
    }
    // Offset so the pointer's TIP is on the package, not its top-left corner.
    drawCursor(ctx, p, pos.x - 1.2 * scale, pos.y - 1.2 * scale, Math.max(1.6, 2 * scale))
  }
}

const anatomyDraw: TimelineTrack['draw'] = (ctx, w, h, T, p, dir = 1) => {
  const { cx, slabW, scale } = layout(ctx, w, h, T)
  // Past the fold the stage holds nothing but packages, so the beat is drawn
  // on its own rather than as another branch of the anatomy build.
  if (T > 9.001) {
    registryDraw(ctx, w, h, T, p, dir)
    return
  }

  // The headline's question mark is keyframe 0; it dissolves as the Model
  // arrives and returns when scrolling back up.
  const q = 1 - ease(seg(T, 0.02, 0.3))
  if (q > 0.004) {
    ctx.save()
    ctx.globalAlpha = q
    ctx.textAlign = 'center'
    ctx.font = `600 ${Math.min(h * 0.32, 190)}px ui-monospace, Menlo, monospace`
    ctx.fillStyle = ink(p, 0.2)
    ctx.fillText('?', w / 2, h / 2 + h * 0.11)
    ctx.restore()
  }
  if (T <= 0.02) return

  // Centre each beat's finished composition; glide between neighbouring
  // keyframes' centres while a segment plays.
  const lo = Math.floor(T)
  const hi = Math.min(5, lo + 1)
  // 4→5 glides on the MOVES, not on the playhead. The anchor otherwise creeps
  // the whole length of the segment, and the segment now holds still for a
  // rename played at an eighth of the pace — a card sliding a few pixels a
  // second under type that is being rewritten is the most distracting thing
  // on the panel. Every other segment is one continuous move, so linear
  // playhead progress is right for them.
  // Segments whose content does NOT fill their whole span glide on their own
  // moves rather than on the playhead. Otherwise the card creeps toward the
  // next keyframe's centre from the instant the segment opens — under a
  // rename being typed (4→5), or under a blast that is supposed to happen
  // before anything else moves (3→4).
  const frac =
    lo === 3
      ? ss(seg(T, 3.3, 3.95))
      : lo === 4
        ? ss(seg(T, 4.22, 4.62))
        : ease(T - lo)
  const anchorY =
    anatomyAnchorAt(lo, h, scale) * (1 - frac) + anatomyAnchorAt(hi, h, scale) * frac

  const pose = teamPose(w, h)

  // The multiplication (segment 4→5). One cycle per agent, in turn: a card
  // stands at centre, its chip flies up off the floor into the slot, the card
  // travels to its quadrant, and the next card fades in behind it. Four
  // cycles, so the beat shows agents being made rather than appearing made.
  // Starts are staggered, not queued: a card begins while the one before it
  // is still settling. Waiting for each to finish made the sequence read as
  // four separate events rather than one build, and left no room to give any
  // single move enough time to be smooth.
  // Figma runs a longer cycle than the three that follow it, because its cycle
  // carries the rename: chip lands, the card holds, the header is retyped, and
  // only then does it travel. The others start after all of that and inherit
  // the finished name, so nothing is renamed twice.
  // The rename comes FIRST: the card is renamed for what it is about to
  // become, and the chip arriving is what makes the new name true. Renaming it
  // afterwards described a change the reader had already watched happen.
  const FIGMA_RENAME: [number, number] = [4.05, 4.19]
  const FIGMA_CHIP: [number, number] = [4.24, 4.42]
  const FIGMA_TRAVEL: [number, number] = [4.46, 4.6]
  // Staggered so the LAST chip lands before the keyframe, not on it. The beat
  // settles when the playhead arrives, and a chip still in the air at that
  // moment is left hanging there until the reader scrolls again.
  const CYCLE_AT = (i: number) => 4.46 + (i - 1) * 0.12
  const forwardCycle = (i: number) => {
    if (i === 0) {
      return {
        // Continuously present: this is the card the previous branch was
        // drawing, handed straight over at 4.02. Ramping its presence from
        // zero blinked it out of existence for the frames either side of the
        // handover.
        appear: 1,
        chip: ss(seg(T, FIGMA_CHIP[0], FIGMA_CHIP[1])),
        chipT: seg(T, FIGMA_CHIP[0], FIGMA_CHIP[1]),
        travel: ss(seg(T, FIGMA_TRAVEL[0], FIGMA_TRAVEL[1])),
      }
    }
    const s = CYCLE_AT(i)
    // Smoothstep rather than ease-out: it leaves and arrives at zero
    // velocity, so a card does not lurch into motion the instant its window
    // opens. Ease-out starts at full speed, which is what makes a staggered
    // sequence feel like a series of jerks.
    return {
      /** The card is present: at centre for Figma, in its quadrant after. */
      appear: ss(seg(T, s, s + 0.14)),
      /** Its chip climbs from the pile into the slot, opening it as it lands. */
      chip: ss(seg(T, s + 0.05, s + 0.24)),
      /** Unshaped, so the sprite can carry its own arc and settle. */
      chipT: seg(T, s + 0.05, s + 0.24),
      /** Figma alone travels: the others are born where they belong. */
      travel: ss(seg(T, s + 0.2, s + 0.34)),
    }
  }

  // Rewinding does not replay four build cycles backwards — at this length
  // that is a long wait to get back to the previous beat. All four cards go
  // at once: the three born in their quadrants fade and shrink where they
  // stand, their chips drop back to the pile together, and only Figma travels
  // home to centre, because that is the state the previous beat needs.
  const reverseCycle = (i: number) => {
    const away = ss(seg(T, 4.18, 4.6))
    if (i === 0) {
      return {
        appear: 1,
        chip: ss(seg(T, 4.1, 4.5)),
        chipT: seg(T, 4.1, 4.5),
        travel: ss(seg(T, 4.06, 4.46)),
      }
    }
    return { appear: away, chip: away, chipT: seg(T, 4.18, 4.6), travel: 1 }
  }

  const cycle = dir < 0 ? reverseCycle : forwardCycle

  /** Where card i is right now, and how big. */
  const cardAt = (i: number, travel: number, spec: AgentSpec) => {
    const s = lerp(scale, pose.scale, travel)
    const m = measureAgent(spec, s)
    return {
      x: lerp(cx, pose.x(i), travel),
      y: lerp(anchorY, pose.cy(i) + (m.above - m.below) / 2, travel),
      w: lerp(slabW, pose.width, travel),
      s,
    }
  }

  const chipSlots: Record<string, { x: number; y: number; w: number; h: number }> = {}
  const childBoxes: (ReturnType<typeof drawAgent> | null)[] = []
  let box: ReturnType<typeof drawAgent> | null = null

  if (T <= 4.02) {
    box = drawAgent(ctx, p, cx, anchorY, slabW, anatomySpec(T), scale)
  } else {
    for (let i = 0; i < pose.count; i += 1) {
      const brand = pose.brands[i]!
      const c = cycle(i)
      if (c.appear <= 0.002) continue
      // The stack was the previous beat's subject, so it arrives whole; the
      // slot is the only part that grows, and it grows as its chip lands.
      // Only Figma is renamed, and only after its chip has landed: it is the
      // card the reader watched become a Figma agent, so it is the one whose
      // name is allowed to change. The three that follow are born already
      // carrying it.
      const spec = teamSpec(
        brand,
        c.chip,
        i === 0
          ? typeSwap(T, 'Agent', 'Domain-Specific Agent', FIGMA_RENAME[0], FIGMA_RENAME[1])
          : undefined,
      )
      // Selected before it is rewritten and released after, the way you would
      // do it by hand.
      if (i === 0) spec.headerHighlight = swapSelect(T, FIGMA_RENAME[0], FIGMA_RENAME[1])
      // The slab only opens the slot while the sprite is still flying; once
      // the chip has landed the slab draws it, so the two never double up.
      spec.slabs[1]!.contentHidden = c.chip < 0.999

      // Segment 5→6: the grid becomes a row under a coordinator. The cards
      // are the same objects, so they travel rather than being redrawn.
      const toRow = ss(seg(T, 5.0, 5.72))
      // Segment 6→7: the four leave. The beat is about the coordinator alone,
      // so they sink and fade rather than lingering as scenery.
      // Cleared while the coordinator travels, so the stage is empty before
      // anything about the card itself starts to change.
      const shed = ss(seg(T, 6.0, 6.3))
      if (shed >= 0.999) continue

      let at: { x: number; y: number; w: number; s: number }
      let alpha = 1
      if (toRow > 0.001) {
        const row = rowPose(w, h)
        const s = lerp(pose.scale, row.scale, toRow)
        const m = measureAgent(spec, s)
        at = {
          x: lerp(pose.x(i), row.x(ROW_ORDER[i]!), toRow),
          y: lerp(pose.cy(i), row.cy(), toRow) + (m.above - m.below) / 2,
          w: lerp(pose.width, row.width, toRow),
          s,
        }
      } else if (i === 0) {
        // Figma is already on stage from the previous beat, so it is the one
        // that shrinks and travels into its quadrant.
        at = cardAt(0, c.travel, spec)
      } else {
        // The rest are born where they belong: scale up and fade in on their
        // own quadrant while their chip climbs toward them.
        const grow = 0.82 + 0.18 * c.appear
        const s = pose.scale * grow
        const m = measureAgent(spec, s)
        at = {
          x: pose.x(i),
          y: pose.cy(i) + (m.above - m.below) / 2,
          w: pose.width * grow,
          s,
        }
        alpha = c.appear
      }

      ctx.save()
      ctx.globalAlpha *= alpha * (1 - shed)
      const drawn = drawAgent(
        ctx,
        p,
        at.x,
        at.y + shed * 40 * pose.scale,
        at.w,
        spec,
        at.s,
      )
      ctx.restore()
      const cell = drawn.chipRects[brand.name]
      if (cell) chipSlots[brand.name] = cell
      childBoxes[i] = drawn
      if (i === 0) box = drawn
    }

    // The coordinator, and the traffic between it and each specialist. It
    // arrives once the row is most of the way formed, so the move reads as
    // the four settling into place and then being given someone to report to.
    const coordIn = ss(seg(T, 5.45, 5.95))
    if (coordIn > 0.004) {
      const row = rowPose(w, h)
      const c = row.coordinator
      // Same kind of thing as the four below it — one job, stated in its
      // prompt — so it wears the same label and the same slot, carrying
      // instructions where a specialist carries its service.
      //
      // Segment 6→7 turns it into the ideal agent in place: the coordination
      // slot closes, Tools subdivides into its three shapes under a brace,
      // and Hooks, Agent Rules and the two capability rows grow in.
      const grow = (a: number, b: number) => ss(seg(T, a, b))
      // One thing at a time, in the order the argument is made: the card takes
      // the stage on its own, sheds the part that was only ever about
      // coordinating, is renamed for what it is about to become, then
      // subdivides its tools, and only afterwards grows the capabilities —
      // each in its own band with a rest between. The gaps are the point. Run
      // together, the eye sees one blurred mutation rather than five
      // decisions, which is what this beat is made of.
      const takeStage = grow(6.0, 6.26)
      // Closes on the way in rather than after the card has settled: the slot
      // was only ever there to coordinate the four that just left, so it goes
      // with them instead of being taken away from a card at rest.
      const shedCoord = grow(6.02, 6.22)
      // Three stages inside one move (label out, bar parts, labels in), so it
      // gets twice the band the single-property changes around it get.
      const bisect = grow(6.44, 6.68)
      // Segment 7→8: the same card travels left and shrinks into the head of
      // the chain. It keeps every row it has — this is the agent the reader
      // just watched being built, so nothing about it may be redrawn.
      const toChain = grow(7.02, 7.5)
      // Once the whole graph exists it is wrapped and stepped back, because the
      // graph is itself an agent: the thing the reader has been watching get
      // built is one of the parts it is built from.
      const wrap = grow(7.86, 8.0)
      const spec: AgentSpec = {
        // Nothing is lost in the change but the coordination prompt: this is
        // the same agent, so it keeps its messages and every row it already
        // had. The one thing that does change is its name, and it changes
        // FIRST — the card is renamed for what it is about to become, and
        // then earns the name as the rows the specification asks for
        // propagate in beneath it. Everything is finished, and the selection
        // released, before the keyframe: anything still ramping when the
        // playhead lands is frozen part-way there for as long as the reader
        // stays on the beat.
        header: typeSwap(T, 'Domain-Specific Agent', 'Standard Agent', 6.24, 6.38),
        headerHighlight: swapSelect(T, 6.24, 6.38),
        // Plain, in the graph as everywhere else. The plated treatment made a
        // card in the chain shout the name at the size where the whole point is
        // that every card wears it equally, and the black-on-gold band read as a
        // different KIND of card rather than the same one, smaller.
        headerTone: 'neutral',
        // Sized for the lockup it ends up in, not for the card. The graph is
        // fitted to the frame after the fact, so by the time this card has
        // travelled it is small and its name — the one name on screen still
        // meant to be read — had shrunk with it.
        headerScale: 1 + 0.55 * toChain,
        slabs: [
          // Renamed rather than joined by a second slab: provider and model
          // are one pinned unit in the spec, so the card says so in one row.
          // First of the additions — core anatomy changes before the dreamed
          // capabilities arrive. The accent lands as the new name finishes
          // typing, marking the moment the row becomes provider-bound.
          {
            label: typeSwap(T, 'Model', 'Provider + Model', 6.68, 6.76),
            accent: T >= 6.72 ? 'provider' : undefined,
          },
          {
            label: 'Coordination instructions',
            tone: 'dashed',
            child: true,
            presence: 1 - shedCoord,
          },
          { label: 'System Prompt' },
          // Always the chip row, drawn at whatever fraction of the division it
          // has reached. Undivided it is identical to the plain Tools slab, so
          // there is no swap in either direction: scrolling back closes the
          // gaps and the row becomes one bar again.
          // Each kind the row divides into gets its own colour as it separates,
          // which is what makes the division read as three different things
          // rather than one bar with gaps cut in it. Functions stays plain: a
          // tool being a function is the assumption the beat is arguing past.
          {
            label: 'Tools',
            chips: ['Functions', 'Sub-prompts', 'Sub-agents'],
            chipAccents: { 'Sub-prompts': 'prompts', 'Sub-agents': 'gold' },
            split: bisect,
          },
          { label: 'Hooks', accent: 'hooks', presence: grow(6.76, 6.81) },
          { label: 'Agent Rules', accent: 'rules', presence: grow(6.82, 6.86) },
          { label: 'Messages' },
        ],
        footers: [
          { label: 'Storage', accent: 'files', presence: grow(6.87, 6.91) },
          { label: 'Code Execution', accent: 'exec', presence: grow(6.92, 6.96) },
        ],
      }
      // Alone on the stage it can afford to be read at full size, so it grows
      // as it travels rather than staying at the size it needed when four
      // cards sat under it.
      // Alone at full size for the ideal beat, then down to chain size as it
      // takes its place at the head of the graph.
      const chain = chainPose(w, h)
      const cScale = lerp(c.scale * (1 + 0.34 * takeStage), chain.coord.scale, toChain)
      const cWidth = lerp(c.width * (1 + 0.34 * takeStage), chain.coord.width, toChain)
      const m = measureAgent(spec, cScale)
      // Centred on its designed line, but never above the top of the frame.
      // measureAgent reports the stack, and the card wraps that in padding
      // plus a header band, so predicting the card's top from the stack's is
      // guesswork. Lay it out once invisibly, read the card it actually drew,
      // and shift by whatever it overhangs.
      // Once the four are gone it is the only card, so it takes the middle of
      // the frame rather than staying at the top of a hierarchy that no
      // longer has a bottom half.
      const homeY = lerp(c.cy, h * 0.5, takeStage)
      const wanted = homeY + (m.above - m.below) / 2 - (1 - coordIn) * 22 * c.scale
      ctx.save()
      ctx.globalAlpha = 0
      const probe = drawAgent(ctx, p, c.x, wanted, cWidth, spec, cScale)
      ctx.restore()
      const topMargin = h * 0.05
      const anchorFix = Math.max(0, topMargin - probe.card.y)

      // Lerped as final coordinates rather than as pose inputs, so the card is
      // exactly where the ideal beat leaves it at T=7 and exactly where the
      // graph wants it at T=8, with no seam at either end.
      const coordX = lerp(c.x, chain.coord.x, toChain)
      const coordY = lerp(wanted + anchorFix, chain.coord.anchor, toChain)

      // The container's extent, worked out from the layout pass rather than
      // from what has been painted: its fill has to go down BEFORE the cards
      // so it sits behind them, which rules out measuring the cards first.
      // layoutAgent takes the same arguments as drawAgent, so the rect it
      // reports is the rect that will be drawn.
      const containerRect = () => {
        const boxes = [
          layoutAgent(spec, coordX, coordY, cWidth, cScale).cardRect,
          ...chainCards(w, h),
        ]
        // chainPose already solved the fit, and it reports the padding that
        // solve assumed. Recomputing it here from a different constant would
        // let the drawn container drift outside the space reserved for it.
        const pad = chain.pad
        const x1 = Math.min(...boxes.map((r) => r.x)) - pad
        const y1 = Math.min(...boxes.map((r) => r.y)) - pad
        return {
          x: x1,
          y: y1,
          w: Math.max(...boxes.map((r) => r.x + r.w)) + pad - x1,
          h: Math.max(...boxes.map((r) => r.y + r.h)) + pad - y1,
        }
      }
      const container = wrap > 0.001 ? containerRect() : null
      const labelSize = containerLabelSize(h)

      // ---- 8→9: the card becomes a package. ----
      // Not a crossfade to a picture of a box. The card ALREADY is a box —
      // panel fill, hairline border, dithered shadow — so it becomes the mark
      // by being reproportioned into one: the interior empties, the frame
      // draws down to the icon's squarer proportions, its line weight comes up
      // to icon weight as it loses the size that made a hairline read, and the
      // lid seam and tape are struck across it at the end. Nothing is
      // substituted for anything; one object changes shape.
      // Staggered left to right across the graph, each card starting before
      // the one before it has finished: the coordinator on the left goes
      // first, then the column of children, then the pair hanging off the
      // branch. Queued rather than simultaneous, so the beat reads as a
      // sequence of things being packed rather than as one global effect.
      const PACK_STEP = 0.025
      const packAt = (order: number) => {
        const d = order * PACK_STEP
        // Two moves, not three. The card empties, then the shrink and the
        // corner travel run as ONE move — they are the same act, and splitting
        // them left the shape changing proportion and identity at different
        // times. The interior edges wait for that to land: drawn while the
        // hull was still travelling they appeared to bend, because each one is
        // extending toward a corner that is itself still moving. Once the cube
        // is still they are straight lines on a fixed shape, and they can go
        // in quickly.
        const settle = 8.03 + d
        return {
          empty: ss(seg(T, 8.0 + d, 8.13 + d)),
          shrink: ss(seg(T, settle, settle + 0.2)),
          morph: ss(seg(T, settle, settle + 0.2)),
          // Straight off the back of the hull landing. A pause here read as
          // the shape finishing and then something else starting; the edges
          // are part of the same drawing.
          lines: ss(seg(T, settle + 0.21, settle + 0.3)),
        }
      }

      // Once every card is a package, the thing holding them is packed too:
      // the composition is itself one shippable object, which is the whole
      // claim of the beat. Same move, one rank up — the container's own
      // rectangle is drawn out into the same mark, in its own gold, at the
      // size something you are meant to install deserves.
      // The last card's edges land at 8.45. Nothing moves for the tenth of a
      // keyframe after that: the reader gets a moment to see six finished
      // packages sitting inside one container before the container itself
      // turns out to be the seventh.
      const shipOut = ss(seg(T, 8.56, 8.72))
      const hold = 1 - shipOut
      const boxLabel = 1 - ss(seg(T, 8.5, 8.58))
      const boxShrink = ss(seg(T, 8.56, 8.82))
      const boxLines = ss(seg(T, 8.83, 8.91))
      const boxName = seg(T, 8.86, 8.98)

      /**
       * Draw a card, packing it if the beat has reached it. Returns the shape
       * drawAgent returns, EXCEPT that `card` is the box as it stands right
       * now rather than the card's full rect — every link on the stage anchors
       * to that, so the wiring stays attached to a shape that is shrinking
       * instead of pointing at where the card used to be.
       */
      const packedAgent = (
        aSpec: AgentSpec,
        ax: number,
        anchor: number,
        aWidth: number,
        aScale: number,
        alpha: number,
        order: number,
      ): ReturnType<typeof drawAgent> => {
        const st = packAt(order)
        if (st.shrink <= 0.001) {
          ctx.save()
          ctx.globalAlpha *= alpha
          const drawn = drawAgent(ctx, p, ax, anchor, aWidth, aSpec, aScale)
          ctx.restore()
          return drawn
        }
        const laid = layoutAgent(aSpec, ax, anchor, aWidth, aScale)
        const full = laid.cardRect
        const side = Math.min(full.w, full.h) * 0.6
        const bw = lerp(full.w, side, st.shrink)
        const bh = lerp(full.h, side * 1.1, st.shrink)
        const box = {
          x: full.x + full.w / 2 - bw / 2,
          y: full.y + full.h / 2 - bh / 2,
          w: bw,
          h: bh,
        }
        ctx.save()
        ctx.globalAlpha *= alpha
        drawPackageMorph(ctx, p, box, side * 1.25, st.morph, st.lines, {
          shadow: 7 * aScale,
          // Hairline at card size, icon weight at icon size: a thin outline on
          // a mark this small disappears, and the weight is most of what makes
          // it read as a glyph rather than as a small diagram.
          lineWidth: lerp(1.2, 3.4, st.shrink),
          stroke: ink(p, 0.88),
        })
        if (st.empty < 0.999) {
          ctx.save()
          ctx.globalAlpha *= 1 - st.empty
          ctx.beginPath()
          ctx.rect(box.x, box.y, box.w, box.h)
          ctx.clip()
          drawAgent(ctx, p, ax, anchor, aWidth, { ...aSpec, card: false }, aScale)
          ctx.restore()
        }
        ctx.restore()
        return {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          card: box,
          stackTop: box.y,
          slabCentres: [],
          chipRects: laid.cells,
        }
      }
      if (container) {
        // A wash rather than a solid: the cards inside are the subject, and a
        // saturated panel behind them would flatten every stack it holds.
        ctx.save()
        ctx.globalAlpha *= wrap * (boxShrink > 0.001 ? 0 : 1)
        // The same half-tone the mark's interior carries, at the same colour
        // and the same density. It used to be a flat wash at a tenth alpha —
        // near enough in weight while it was a big rectangle, but the moment
        // that rectangle became a package the surface changed under it, which
        // reads as the fill getting denser rather than as the shape changing.
        ditherRect(ctx, container.x, container.y, container.w, container.h, CONTAINER_FIELD(p), 4)
        ctx.restore()
      }

      // The container as a package, drawn BEHIND everything it holds: its own
      // rectangle is what is being drawn out into the mark, so the contents
      // have to sit on top of it and leave, not be painted over mid-thought.
      const hero = heroPack(w, h)
      const packSide = hero.side
      const packTarget = hero.rect
      if (container && boxShrink > 0.001) {
        const boxRect = {
          x: lerp(container.x, packTarget.x, boxShrink),
          y: lerp(container.y, packTarget.y, boxShrink),
          w: lerp(container.w, packTarget.w, boxShrink),
          h: lerp(container.h, packTarget.h, boxShrink),
        }
        ctx.save()
        ctx.globalAlpha *= wrap
        drawPackageMorph(ctx, p, boxRect, packSide * 1.25, boxShrink, boxLines, {
          // No shadow: the enclosure never cast one, and a mark you can see
          // through does not sit on top of the scene the way a card does.
          shadow: 0,
          lineWidth: lerp(1.4, 5.2, boxShrink),
          stroke: gold(p, p.light ? 0.95 : 0.9),
          // Gold line work over a gold half-tone: the enclosure was a dithered
          // gold field before it was a mark, and it keeps that surface rather
          // than flattening into a solid the moment it becomes an icon.
          dither: CONTAINER_FIELD(p),
        })
        ctx.restore()
      }

      // Everything inside travels with the container as it closes: the cards
      // shrink toward the same centre and fade, rather than being covered by
      // the shape they are supposed to be going into.
      const packing = container && boxShrink > 0.001
      if (packing) {
        const s0 = lerp(1, packTarget.w / container!.w, boxShrink)
        const ox = container!.x + container!.w / 2
        const oy = container!.y + container!.h / 2
        ctx.save()
        // Clipped to the closing hull, in scene space and BEFORE the shrink
        // transform. The outline reaches the mark faster than its contents
        // can be scaled into it, so without this the cards spill back out
        // through the sides of the box they are going into.
        tracePolygon(
          ctx,
          packageHull(
            {
              x: lerp(container!.x, packTarget.x, boxShrink),
              y: lerp(container!.y, packTarget.y, boxShrink),
              w: lerp(container!.w, packTarget.w, boxShrink),
              h: lerp(container!.h, packTarget.h, boxShrink),
            },
            packSide * 1.25,
            boxShrink,
          ),
        )
        ctx.clip()
        ctx.translate(
          lerp(ox, packTarget.x + packTarget.w / 2, boxShrink),
          lerp(oy, packTarget.y + packTarget.h / 2, boxShrink),
        )
        ctx.scale(s0, s0)
        ctx.translate(-ox, -oy)
      }

      const coord = packedAgent(spec, coordX, coordY, cWidth, cScale, coordIn * hold, 0)

      // The Tools brace: the deck's own annotation device, spanning that row
      // alone. Built from the chips the row actually drew, so it tracks the
      // row wherever the stack puts it.
      const fnCell = coord.chipRects.Functions
      if (fnCell) {
        const braceX = coord.card.x + coord.card.w + 9 * cScale
        // Arrives with the division it annotates, and leaves with it — and
        // again as the chain forms, where the space to its right stops being
        // margin and becomes the graph.
        drawBrace(
          ctx, p, braceX, fnCell.y, fnCell.y + fnCell.h, 'Tools', cScale,
          coordIn * bisect * (1 - toChain),
        )
      }

      // The chain (slide 69:00). Each child is the coordinator's own anatomy at
      // a smaller size with its domain in the identity slot, because the claim
      // of the beat is that an agent calling an agent calls the same kind of
      // thing. They arrive in turn, each one hanging off the Sub-agents chip of
      // the agent that calls it, so the reader can follow the nesting one link
      // at a time instead of meeting a finished graph.
      if (toChain > 0.01) {
        /** Centred on its own line: a child carrying the full anatomy is
            several rows taller than a sketch of one, and anchoring it by a row
            of its parent put its head outside the frame. */
        const placeChild = (
          s: AgentSpec, x: number, cy: number, width: number, scale: number, k: number,
          order: number,
        ) => {
          const m = measureAgent(s, scale)
          return packedAgent(s, x, cy + (m.above - m.below) / 2, width, scale, k * hold, order)
        }

        /**
         * Card to card, not chip to card: at this size the Sub-agents chip is
         * an unlabelled sliver, so a line leaving it read as starting from a
         * random point on the parent's face. Two whole agents talking to each
         * other is also the truer picture — the chip is where the call is
         * declared, not where the conversation happens.
         *
         * No arrowhead. Messages go both ways, and the packets say so: one
         * runs out while the other runs back, at a fixed speed in pixels so a
         * long hop does not look busier than a short one.
         */
        const talk = (
          from: ReturnType<typeof drawAgent>,
          to: ReturnType<typeof drawAgent>,
          alpha: number,
        ) => {
          const a1 = { x: from.card.x + from.card.w, y: from.card.y + from.card.h / 2 }
          const b1 = { x: to.card.x, y: to.card.y + to.card.h / 2 }
          ctx.save()
          ctx.globalAlpha *= alpha * hold
          drawLink(ctx, p, a1, b1, -1, 'gold', false)
          const len = Math.hypot(b1.x - a1.x, b1.y - a1.y)
          if (len > 6) {
            const speed = 120 * chain.child.scale
            const travelled = (performance.now() / 1000) * speed
            const dot = Math.max(2, 3.2 * chain.child.scale)
            const at = (d: number) => ({
              x: a1.x + ((b1.x - a1.x) * d) / len,
              y: a1.y + ((b1.y - a1.y) * d) / len,
            })
            ctx.fillStyle = gold(p, 0.95)
            for (const d of [travelled % len, len - ((travelled + len * 0.45) % len)]) {
              const q = at(d)
              ctx.fillRect(q.x - dot / 2, q.y - dot / 2, dot, dot)
            }
          }
          ctx.restore()
        }

        // The coordinator's three children, arriving in turn. One at a time, so
        // the reader follows the nesting link by link instead of meeting a
        // finished graph.
        let branchBox: ReturnType<typeof drawAgent> | null = null
        chain.children.forEach((kid, i) => {
          const k = ease(seg(T, 7.36 + i * 0.1, 7.56 + i * 0.1))
          if (k <= 0.01) return
          const drawn = placeChild(
            fractalSpec(kid.brand),
            chain.child.x, kid.cy, chain.child.width, chain.child.scale, k, i + 1,
          )
          if (i === chain.branchAt) branchBox = drawn
          talk(coord, drawn, k)
        })

        // The turn of the beat: one of those three has children of its own.
        // The move repeating one rank down is what makes the nesting read as
        // fractal rather than as two levels.
        if (branchBox) {
          const parent = branchBox as ReturnType<typeof drawAgent>
          chain.leaves.forEach((leaf, i) => {
            const k = ease(seg(T, 7.66 + i * 0.08, 7.86 + i * 0.08))
            if (k <= 0.01) return
            const leafBox = placeChild(
              fractalSpec(leaf.brand), leaf.x, leaf.cy, leaf.width, leaf.scale, k, 4 + i,
            )
            talk(parent, leafBox, k)
          })
        }

        // The container's border and its name. The name is set large and sits
        // OUTSIDE the boundary, breaking the top edge as it crosses it, so it
        // reads as the label of the whole enclosure rather than as one more
        // caption belonging to a card inside it. The break is a real gap in
        // the stroke, not a knockout patch: the fill is gold on one side of
        // that line and the scene on the other, so any patch would show its
        // own edge.
        if (container) {
          ctx.save()
          ctx.globalAlpha *= wrap * boxLabel * (boxShrink > 0.001 ? 0 : 1)
          const size = labelSize * (0.6 + 0.4 * wrap)
          // The same treatment every label in the scene wears — small caps,
          // SANS, wide tracking — at the size the outermost thing on screen
          // deserves. A different face here would read as chrome rather than
          // as the diagram naming itself.
          // The container names the ARRANGEMENT, not its members. Each card
          // inside is a standard agent and says so on its own header; what the
          // enclosure adds is that they have been composed into one system.
          const label = 'Standard Agent Composition'.toUpperCase()
          ctx.font = `600 ${size}px ${SANS}`
          ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${size * 0.08}px`
          const tw = ctx.measureText(label).width
          const tx = container.x + 26 * chain.coord.scale
          const gapPad = size * 0.3

          ctx.strokeStyle = gold(p, p.light ? 0.75 : 0.55)
          ctx.lineWidth = 1.4
          ctx.setLineDash([5, 6])
          ctx.beginPath()
          // Top edge in two runs, with the label's span left open.
          ctx.moveTo(container.x, container.y)
          ctx.lineTo(Math.max(container.x, tx - gapPad), container.y)
          ctx.moveTo(Math.min(container.x + container.w, tx + tw + gapPad), container.y)
          ctx.lineTo(container.x + container.w, container.y)
          // The other three, unbroken.
          ctx.moveTo(container.x + container.w, container.y)
          ctx.lineTo(container.x + container.w, container.y + container.h)
          ctx.lineTo(container.x, container.y + container.h)
          ctx.lineTo(container.x, container.y)
          ctx.stroke()
          ctx.setLineDash([])

          // Sat on the boundary rather than above it: the glyphs' lower
          // quarter crosses the line, which is what makes the break read as
          // the label interrupting the border instead of floating over it.
          ctx.fillStyle = gold(p, p.light ? 0.95 : 0.9)
          ctx.textBaseline = 'alphabetic'
          ctx.fillText(label, tx, container.y + size * 0.26)
          ctx.restore()
        }
      }
      if (packing) ctx.restore()

      // The name the package earns by becoming what it is — and then keeps
      // earning: the scope holds still while the service after the slash is
      // rotated out and another rotated in.
      if (container && boxName > 0) {
        const settled = boxName >= 1
        if (!settled) nameEpoch = 0
        else if (nameEpoch === 0) nameEpoch = performance.now()
        const cycle = packageCycle(performance.now() - nameEpoch, !settled)
        ctx.save()
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        // Set to the mark, not to the diagram it came from: the name is the
        // other half of the object the reader is left holding, so it is sized
        // against the package rather than against a caption.
        const size = Math.max(20, packSide * 0.17)
        ctx.font = `600 ${size}px ${MONO}`
        const baseline = packTarget.y + packTarget.h + Math.max(36, packSide * 0.26)
        const at = packageNameLayout(ctx, w)

        // The whole name types in as one string — scope AND first service. The
        // rotation is what happens to a name that already exists; sliding the
        // first word in as though it were a replacement means the reader never
        // sees the name arrive, only sees it already changing.
        const full = PACKAGE_SCOPE + cycle.cur
        ctx.fillStyle = ink(p, 0.92)
        if (!settled) {
          ctx.fillText(full.slice(0, Math.round(full.length * boxName)), at.x, baseline)
        } else {
          ctx.fillText(PACKAGE_SCOPE, at.x, baseline)
        }

        // The service rides in from below and leaves upward: one word going up
        // and out while the next comes up into its place, so the line reads as
        // a slot being refilled rather than as text being retyped.
        const lift = size * 0.85
        const word = (text: string, dy: number, alpha: number) => {
          if (alpha <= 0.01) return
          ctx.save()
          ctx.globalAlpha *= alpha
          ctx.fillText(text, at.wordX, baseline + dy)
          ctx.restore()
        }
        if (!settled) {
          // Already drawn, as part of the typed string.
        } else if (cycle.swap <= 0) {
          word(cycle.cur, 0, 1)
        } else {
          const u = ease(cycle.swap)
          word(cycle.cur, -lift * u, 1 - u)
          word(cycle.next, lift * (1 - u), u)
        }
        ctx.restore()
      }

      // Routed as a bus, not a starburst. Four long diagonals from one point
      // cross a lot of empty frame and land at four different angles; a trunk
      // down to a rail with short drops reads as wiring and keeps every line
      // either vertical or horizontal.
      //
      // Anchors are card centres and card edges. drawAgent returns x as the
      // stack's LEFT edge, so a link built from it alone leaves from a corner.
      const kids = childBoxes.filter(Boolean) as ReturnType<typeof drawAgent>[]
      if (kids.length) {
        const centreOf = (b: ReturnType<typeof drawAgent>) => b.card.x + b.card.w / 2
        const trunkX = coord.card.x + coord.card.w / 2
        const coordBottom = coord.card.y + coord.card.h
        const childTop = Math.min(...kids.map((b) => b.card.y))
        const railY = coordBottom + (childTop - coordBottom) * 0.52
        const xs = kids.map(centreOf)

        ctx.save()
        ctx.globalAlpha *= coordIn * (1 - ss(seg(T, 6.0, 6.3)))
        // The wiring, drawn without packets: a dot riding one segment would
        // appear out of nowhere at a corner. Every message travels the whole
        // route instead, so it can only ever enter or leave at a card.
        drawLink(ctx, p, { x: trunkX, y: coordBottom }, { x: trunkX, y: railY }, -1, 'gold')
        drawLink(
          ctx,
          p,
          { x: Math.min(...xs), y: railY },
          { x: Math.max(...xs), y: railY },
          -1,
          'gold',
        )
        kids.forEach((kid) => {
          const x = centreOf(kid)
          drawLink(ctx, p, { x, y: railY }, { x, y: kid.card.y }, -1, 'gold')
        })

        // Coordinator → child, corner to corner, as one path.
        const routeFor = (kid: ReturnType<typeof drawAgent>) => {
          const x = centreOf(kid)
          return [
            { x: trunkX, y: coordBottom },
            { x: trunkX, y: railY },
            { x, y: railY },
            { x, y: kid.card.y },
          ]
        }
        /** Point at a distance in pixels along a polyline. */
        const atDistance = (pts: { x: number; y: number }[], d: number) => {
          let want = d
          for (let i = 0; i < pts.length - 1; i += 1) {
            const leg = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y)
            if (want <= leg) {
              const f = leg > 0 ? want / leg : 0
              return {
                x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f,
                y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f,
              }
            }
            want -= leg
          }
          return pts[pts.length - 1]!
        }
        const lengthOf = (pts: { x: number; y: number }[]) =>
          pts.slice(1).reduce((sum, q, i) => sum + Math.hypot(q.x - pts[i]!.x, q.y - pts[i]!.y), 0)

        // Traffic waits for the wiring to stop moving. The position along a
        // route is `travelled % total`, and `travelled` is wall-clock distance
        // — tens of thousands of pixels in. While the cards are still sliding
        // into the row, `total` changes every frame, and a small change in the
        // divisor throws that remainder right across the path: the dots look
        // like they are tearing around until the layout settles.
        const flow = ss(seg(T, 5.82, 6.0)) * (1 - ss(seg(T, 6.0, 6.2)))
        if (flow > 0.01) {
          // Distance travelled, not fraction of the route. The outer children
          // sit on longer paths, so a shared 0..1 phase would send their
          // messages across the frame faster than the inner ones — the eye
          // reads that as the far agents being busier.
          const SPEED = 210 * row.scale
          const travelled = (performance.now() / 1000) * SPEED
          const dot = 3.4 * row.scale
          ctx.globalAlpha *= flow
          ctx.fillStyle = gold(p, 0.95)
          kids.forEach((kid, i) => {
            const route = routeFor(kid)
            const total = lengthOf(route)
            if (total <= 0) return
            // Offsets in pixels too, so the spacing between messages holds
            // whatever the route length.
            const down = (travelled + i * 120) % total
            const up = total - ((travelled + 260 + i * 150) % total)
            for (const d of [down, up]) {
              const q = atDistance(route, d)
              ctx.fillRect(q.x - dot / 2, q.y - dot / 2, dot, dot)
            }
          })
        }
        ctx.restore()
      }
    }
  }
  // No fallback card here. Past the specialist build the subject is whatever
  // the branch above drew — four cards, or the coordinator alone once they
  // have shed. Drawing the plain anatomy stack "just in case" painted an
  // opaque card over the coordinator at the end of segment 6→7, which is what
  // the reader saw instead of the ideal agent. `box` is only wanted for the
  // brace below, and the brace only exists while the first branch is live.

  // The fallen servers: launch from their inheritance cells, bounce to the
  // container floor, rest in a pile. Each one then rises in its turn into the
  // card being built at centre — the same climb Figma makes, once per agent.
  if (T > 2.98) {
    const launch = launchCellsFor(ctx, w, h)
    for (const sv of SERVERS) {
      if (T <= sv.start) continue
      const cell = launch[sv.name]
      if (!cell) continue
      const brand = LOGO_ROWS[sv.row]![sv.col]!
      const lx = cell.x + cell.w / 2
      const ly = cell.y + cell.h / 2
      const rest = restPose(sv.restSlot, w, h, cell.w, cell.h, w / 2, sv.layer)
      const order = pose.brands.findIndex((b) => b.name === sv.name)
      const c = order < 0 ? null : cycle(order)
      const rise = c ? c.chip : 0
      let sx: number, sy: number, rot: number
      let cw = cell.w
      let ch = cell.h
      if (rise <= 0) {
        const fl = chipFlight(T - sv.start, rest.y - ly, sv.e, sv.tilt)
        sx = lx + (rest.x - lx) * fl.xu
        sy = ly + fl.dy
        rot = fl.rot
      } else {
        // Chase the live slot: the card's identity cell moves as the card
        // travels, so the target is re-read every frame and the chip
        // converges on wherever it ends up.
        const slot = chipSlots[sv.name]
        const tx = slot ? slot.x + slot.w / 2 : lx
        const ty = slot ? slot.y + slot.h / 2 : ly
        // Shaped from the raw progress rather than one eased number for
        // everything: the horizontal drifts and settles, the vertical
        // overshoots slightly and drops back, and the arc peaks early. One
        // eased value driving both axes is what reads as stiff.
        const k = clamp01(c!.chipT)
        const kx = ease(k)
        const ky = 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2
        const arc = Math.sin(k ** 0.78 * Math.PI) * 34 * scale
        sx = rest.x + (tx - rest.x) * kx
        sy = rest.y + (ty - rest.y) * ky - arc
        // Straightens as it climbs, with a wobble that decays on the way.
        rot = sv.tilt * (1 - ss(k)) + 0.16 * Math.exp(-k * 4.5) * Math.sin(k * 24)
        // Grows into the slot it is heading for, so it arrives the size of
        // the row rather than popping to full width on landing.
        const grow = ss(clamp01((k - 0.15) / 0.85))
        cw = cell.w + ((slot ? slot.w : cell.w) - cell.w) * grow
        ch = cell.h + ((slot ? slot.h : cell.h) - cell.h) * grow
      }
      // Hand off to the slab once landed, so the chip is never drawn twice.
      if (rise > 0.999) continue
      drawChipSprite(ctx, p, brand, sx, sy, cw, ch, rot, scale)
    }
  }

  // The brace: "Context" (54:52), renamed "Inheritance" (55:52), gone once
  // the stack sheds. Same span throughout — everything except the Model.
  const ctxA = ease(seg(T, 1.85, 2.05)) * (1 - ease(seg(T, 2.85, 3.0)))
  const inhA = ease(seg(T, 2.85, 3.0)) * (1 - ease(seg(T, 3.05, 3.3)))
  // The skull outlives the brace: it holds through the inheritance keyframe,
  // then blows apart as the stack sheds into the composition beat. Its own
  // window therefore gates this block too, or the particles would vanish the
  // moment the brace finished fading.
  const skullIn = ss(seg(T, 2.98, 3.0))
  // The blast leads the beat. It starts on the keyframe itself and everything
  // the stack does — the chips detaching, the rows shedding — is held back by
  // about a quarter of a keyframe, which at this pace is the ~200ms that makes
  // the explosion read as the CAUSE of the collapse rather than as one more
  // thing happening at the same time.
  //
  // Nearly the whole segment. The playhead crosses 3.0→3.5 at the story's
  // standard pace, so a window measured in tenths of a keyframe here is a few
  // hundred milliseconds on screen — which is why this read as a pop no matter
  // how the velocities were tuned. Dust needs the time more than it needs the
  // distance.
  const burst = ss(seg(T, 3.02, 3.92))
  // Cut, not faded. By the end of the burst every piece is below the panel, so
  // there is nothing left to see and nothing to dim — and stopping here keeps
  // a dead mark from reporting its bounds at every later beat.
  const skullAlpha = T < 3.96 ? skullIn : 0
  if (box && (ctxA > 0.01 || inhA > 0.01 || skullAlpha > 0.01)) {
    const bx = box.card.x + box.card.w + 10 * scale
    // The top of the topmost DRAWN slab, not the top of the laid-out stack.
    // The stack reserves room for rows that have not arrived yet, so anchoring
    // to it left the brace opening in empty card above Messages and wrapping
    // nothing.
    const by1 = box.stackTop - 2
    const by2 = anchorY - 0.45 * 26 * scale - 4
    // One brace, relabelling itself. Two braces crossfading put both words on
    // screen at once in the middle of the move, which read as a stutter; typed,
    // the same change says the reader is watching one thing get renamed.
    const label = typeSwap(T, 'Context', 'Inheritance', 2.82, 2.98)
    const lab = drawBrace(ctx, p, bx, by1, by2, label, scale, Math.max(ctxA, inhA))!
    // The verdict on the word, once it has finished being typed: inheritance
    // is the problem this whole beat is naming. It blinks because a thing that
    // blinks is a warning, and it is the only red in the scene. It arrives
    // only after the last character lands — a warning next to half a word is
    // just a decoration — and reaches full strength ON the keyframe rather
    // than on the way past it, or the beat settles with it part-way in.
    if (skullAlpha > 0.01) {
      // Fully off, not faint: a low-alpha off-phase reads as a smudge sitting
      // beside the word rather than as something blinking, and at this size a
      // half-visible 8x8 grid stops resolving into a skull at all.
      const cell = 1.9 * scale
      // Stops blinking once it is coming apart: a warning that is still
      // flashing while its pieces fall reads as two effects fighting.
      //
      // The off-phase keeps a trace rather than going dark. At zero the mark
      // leaves the composition entirely for a third of every cycle and the eye
      // reads the gap as a hole beside the word; at 20% the shape is still
      // there, and what blinks is its weight.
      const blink = burst > 0.002 || performance.now() % 1150 < 820 ? 1 : 0.2
      drawSkull(
        ctx,
        lab.x + lab.w + 11 * scale,
        lab.y - 6 * cell,
        cell,
        accent(p, 'exec', 1),
        skullAlpha * blink,
        burst,
      )
    }
  }
}

// -------------------------------------------------------------------------
// TEAM — standalone arc (slide 57:20), plays on arrival.
// -------------------------------------------------------------------------
// Every brand carries a real mark, so the row reads as four products rather
// than three products and a placeholder.
// Build order, which is also pile order: Figma is the specialist already on
// screen, and Notion is the other chip resting on the top layer. Taking the
// top two first is the only order the pile can actually be unstacked in.
const TEAM: BrandRef[] = [
  { slug: 'figma', name: 'Figma' },
  { slug: 'notion', name: 'Notion' },
  { slug: 'gmail', name: 'Gmail' },
  { slug: 'googlesheets', name: 'Sheets' },
]

/**
 * Where the four specialists sit once the team exists.
 *
 * The anatomy track builds toward this pose and this scene starts from it, so
 * the two must agree exactly or the panels visibly jump at the handoff. One
 * function, both callers — the seam cannot drift.
 */
/**
 * Grid index → slot in the row. Reading order into the row would send the
 * top-right card across the whole frame to slot 1 while the bottom-left card
 * crosses back the other way; keeping each column on its own side (1 2 3 4 →
 * 1 3 2 4) means no two cards swap places on the way down.
 */
const ROW_ORDER = [0, 2, 1, 3]

/**
 * Where the four end up once a coordinator sits above them: a single row
 * along the bottom, small enough that the coordinator reads as the thing in
 * charge. The 2x2 grid tweens into this over the last segment.
 */
export const rowPose = (w: number, h: number) => {
  const base = sceneScale(h)
  const scale = base * 0.54
  return {
    base,
    scale,
    // Narrow enough that the pitch below leaves a real gap. A card carries a
    // dithered drop shadow offset to its lower right, so cards sized to the
    // pitch do not merely touch — each one's shadow lands on the next card's
    // face and the row reads as one ruled block.
    width: Math.min(w * 0.185, 136 * base),
    // Spread across most of the frame rather than bunched in the middle: four
    // small cards in a narrow band leave the panel looking half-empty.
    x: (i: number) => w * (0.5 + (i - 1.5) * 0.235),
    cy: () => h * 0.78,
    coordinator: {
      // Bigger than the specialists it directs: it is the smarter model, and
      // the hierarchy should be legible from size alone.
      scale: base * 0.95,
      width: Math.min(w * 0.34, 240 * base),
      x: w / 2,
      // Closer to the row than the frame's top edge: the gap between the two
      // tiers is the diagram, and a tall empty middle reads as a mistake.
      cy: h * 0.26,
    },
  }
}

/**
 * The coordinator as it stands once the graph has formed — the same rows the
 * anatomy track's own spec carries at T=8, for measuring only. The coordination
 * slab is gone by then (presence 0 contributes nothing to measureAgent), so it
 * is simply omitted here.
 */
const chainCoordSpec = (): AgentSpec => ({
  header: 'Standard Agent',
  title: 'coordination agent',
  slabs: [
    { label: 'Provider + Model' },
    { label: 'System Prompt' },
    { label: 'Tools', chips: ['Functions', 'Sub-prompts', 'Sub-agents'], goldChips: ['Sub-agents'], split: 1 },
    { label: 'Hooks' },
    { label: 'Agent Rules' },
    { label: 'Messages' },
  ],
  footers: [{ label: 'Storage' }, { label: 'Code Execution' }],
})

/**
 * Where the fractal graph sits (slide 69:00): the coordinator at the left, the
 * three agents it calls in a column beside it, and — hanging off the third of
 * those — one more agent again. Each rank is smaller than the rank that calls
 * it, so depth is legible from size alone without a single label being read.
 *
 * The fourth agent is the reason the beat works. Three children alone is an
 * org chart, which every reader has already accepted; a child that turns out
 * to have children of its own is the claim being made, so the graph has to
 * carry at least one branch that goes deeper than the reader expects.
 */
/** What the branching child calls. Two of them: one deeper node is a claim
    about depth, two is a claim about shape, and the shape is the point. */
const LEAF_BRANDS: BrandRef[] = [
  { slug: 'legal', name: 'Legal' },
  // Name only: there is no sourced mark for this one, and the house rule is
  // never to hand-draw an icon. Nothing is lost — these cards are wordless, so
  // the identity slot is a dashed box either way.
  { name: 'Invoices' },
]

export const chainPose = (w: number, h: number) => {
  const base = sceneScale(h)
  const branchAt = 2

  // ---- Pass 1: the graph's natural proportions, at an arbitrary size. ----
  // Nothing here is chosen against the frame; the fit below is what places it.
  const nat = {
    // Bigger than a third of the graph's width would suggest, because it is
    // the one card here whose rows are still meant to be READ. The children
    // are wordless shapes making a point about repetition; this one is the
    // agent the reader just built, and the whole lockup is fitted to the frame
    // afterwards, so its size is a share of the graph rather than of the panel.
    coord: { scale: base * 0.73, x: w * 0.14 },
    child: { scale: base * 0.36, x: w * 0.52 },
    leaf: { scale: base * 0.3, x: w * 0.86 },
  }
  const natCoordW = Math.min(w * 0.5, 250 * nat.coord.scale)
  const natChildW = Math.min(w * 0.16, 118 * base)
  const natLeafW = Math.min(w * 0.135, 98 * base)

  // The column's spacing is MEASURED, never a fraction of the frame. Every
  // child carries the full anatomy, so its height depends on the slab count and
  // the scale; picking cy fractions by eye works at one frame size and collides
  // at the next, and what collides first is a card's foot with the next card's
  // caption, which sits outside the card and so is invisible to any spacing
  // rule written in terms of the cards alone.
  const probe = fractalSpec({ name: 'Probe' })
  const pm = measureAgent(probe, nat.child.scale)
  const cardH = layoutAgent(probe, nat.child.x, pm.above, natChildW, nat.child.scale).cardRect.h
  // drawAgent sets a caption baseline 8*scale above the card, at font size
  // max(9, 10*scale); this is the band that has to clear the card above it.
  const captionH = 8 * nat.child.scale + 0.72 * Math.max(9, 10 * nat.child.scale)
  const pitch = cardH + captionH + 14 * base
  const cys = [-1, 0, 1].map((i) => h / 2 + i * pitch)
  // The branch carries two of its own, measured the same way: a leaf's card
  // height plus a gap, split either side of its parent's line so the pair
  // reads as belonging to that one child rather than as a fourth column.
  const leafProbe = layoutAgent(probe, nat.leaf.x, 0, natLeafW, nat.leaf.scale).cardRect.h
  const leafPitch = leafProbe + 16 * base
  const leafCys = [-0.5, 0.5].map((i) => cys[branchAt]! + i * leafPitch)

  // ---- Pass 2: fit that arrangement to the frame. ----
  // Done in SCENE coordinates rather than as a canvas transform. The kit's
  // primitives report the coordinates they were handed, so the rig's own
  // overflow fit (scene-canvas absorb()) never sees a ctx transform — two fits
  // then compete, and the rig recentres against geometry that is not what
  // reached the screen. Baking the fit into the pose leaves exactly one.
  const rectOf = (spec: AgentSpec, x: number, cy: number, cw: number, s: number) => {
    const m = measureAgent(spec, s)
    return layoutAgent(spec, x, cy + (m.above - m.below) / 2, cw, s).cardRect
  }
  const kidSpecs = [
    fractalSpec({ name: 'Salesforce' }),
    fractalSpec({ slug: 'google', name: 'Workspace' }),
    fractalSpec({ slug: 'email', name: 'Email' }),
  ]
  const natRects = [
    rectOf(chainCoordSpec(), nat.coord.x, h / 2, natCoordW, nat.coord.scale),
    ...kidSpecs.map((s, i) => rectOf(s, nat.child.x, cys[i]!, natChildW, nat.child.scale)),
    ...LEAF_BRANDS.map((brand, i) =>
      rectOf(fractalSpec(brand), nat.leaf.x, leafCys[i]!, natLeafW, nat.leaf.scale),
    ),
  ]
  const pad = 30 * nat.coord.scale
  const x1 = Math.min(...natRects.map((r) => r.x)) - pad
  const x2 = Math.max(...natRects.map((r) => r.x + r.w)) + pad
  const y1 = Math.min(...natRects.map((r) => r.y)) - pad
  const y2 = Math.max(...natRects.map((r) => r.y + r.h)) + pad
  // Only the container's own name sits above the boundary — each card's
  // caption is already inside the padding. Reserving for both over-reserved by
  // most of a caption and pushed the whole graph down the frame.
  const top = y1 - containerLabelSize(h) * 0.95
  const margin = Math.min(w, h) * 0.03
  // Free to scale UP as well as down: capping at 1 was what left the graph
  // sitting in a wide margin instead of filling the frame it was given.
  const k = Math.min((w - margin * 2) / (x2 - x1), (h - margin * 2) / (y2 - top))
  const mx = (x: number) => (x - (x1 + x2) / 2) * k + w / 2
  const my = (y: number) => (y - (top + y2) / 2) * k + h / 2

  // The coordinator is drawn by anchor (its model line) rather than by centre,
  // so convert once here and let the scene stay in one idiom.
  const coordScale = nat.coord.scale * k
  const coordM = measureAgent(chainCoordSpec(), coordScale)

  return {
    /** Padding between the outermost card and the container's edge. */
    pad: pad * k,
    coord: {
      scale: coordScale,
      width: natCoordW * k,
      x: mx(nat.coord.x),
      anchor: my(h / 2) + (coordM.above - coordM.below) / 2,
    },
    child: {
      scale: nat.child.scale * k,
      // Big enough for the tool row to be read rather than suggested: the chips
      // are the part that makes a child the same kind of thing as its parent,
      // so they cannot degrade into texture.
      width: natChildW * k,
      x: mx(nat.child.x),
    },
    // Salesforce is typeset name-only on purpose: simple-icons dropped the
    // mark upstream, and drawing their cloud from memory is the one thing the
    // house rule forbids. The other three carry a sourced glyph.
    children: [
      { brand: { name: 'Salesforce' } as BrandRef, title: 'salesforce agent', cy: my(cys[0]!) },
      {
        brand: { slug: 'google', name: 'Workspace' } as BrandRef,
        title: 'google workspace agent',
        cy: my(cys[1]!),
      },
      {
        brand: { slug: 'email', name: 'Email' } as BrandRef,
        title: 'email sending agent',
        cy: my(cys[2]!),
      },
    ],
    /** Which of them turns out to have a child of its own. */
    branchAt,
    /** Straddling their parent's line, so the branch reads as one step
        sideways rather than as another column of the same rank. */
    leaves: LEAF_BRANDS.map((brand, i) => ({
      scale: nat.leaf.scale * k,
      width: natLeafW * k,
      x: mx(nat.leaf.x),
      cy: my(leafCys[i]!),
      brand,
    })),
  }
}

/**
 * Every card below the coordinator, laid out without being drawn. The
 * container behind the graph has to be filled before any card goes down, so
 * its extent cannot come from what has already been painted. layoutAgent takes
 * the same arguments as drawAgent, so these are the rects the cards will
 * occupy.
 */
const chainCards = (w: number, h: number) => {
  const chain = chainPose(w, h)
  const place = (
    spec: AgentSpec,
    x: number,
    cy: number,
    width: number,
    scale: number,
  ) => {
    const m = measureAgent(spec, scale)
    return layoutAgent(spec, x, cy + (m.above - m.below) / 2, width, scale).cardRect
  }
  const rects = chain.children.map((kid) =>
    place(
      fractalSpec(kid.brand),
      chain.child.x,
      kid.cy,
      chain.child.width,
      chain.child.scale,
    ),
  )
  for (const leaf of chain.leaves) {
    rects.push(place(fractalSpec(leaf.brand), leaf.x, leaf.cy, leaf.width, leaf.scale))
  }
  return rects
}

export const teamPose = (w: number, h: number) => {
  const base = sceneScale(h)
  // A 2x2 grid rather than a row: four agents across a panel this wide leaves
  // each one too narrow to read its stack, and the square reads as a set.
  // Each cell takes close to half the frame in both axes, so the four fill it.
  const scale = base * 0.82
  const colX = [w * 0.27, w * 0.73]
  const rowCY = [h * 0.29, h * 0.75]
  return {
    base,
    scale,
    width: Math.min(w * 0.4, 230 * base),
    /** Centre x of the i-th specialist: 0,1 top row; 2,3 bottom. */
    x: (i: number) => colX[i % 2]!,
    /** Vertical centre of the i-th cell; the stack is centred on it. */
    cy: (i: number) => rowCY[Math.floor(i / 2)]!,
    count: TEAM.length,
    brands: TEAM,
  }
}

/**
 * A header rewriting itself: the old name backspaced a character at a time,
 * then the new one typed in its place. Linear, not eased — an eased typewriter
 * hesitates at each end and stops reading as typing.
 *
 * This is a rename, not a replacement, and it has to be legible as one. A
 * crossfade between two words says a different card arrived; watching the
 * letters go and new ones come says the card you have been reading all along
 * has just been given a better name.
 */
const swapSelect = (T: number, a: number, b: number, lead = 0.04) =>
  ss(seg(T, a - lead, a)) * (1 - ss(seg(T, b, b + lead)))

const typeSwap = (T: number, from: string, to: string, a: number, b: number) => {
  const u = seg(T, a, b)
  if (u <= 0) return from
  if (u >= 1) return to
  return u < 0.5
    ? from.slice(0, Math.round(from.length * (1 - u * 2)))
    : to.slice(0, Math.round(to.length * (u - 0.5) * 2))
}

/**
 * One specialist, built in the same order the anatomy track builds its agent:
 * model first, then the stack upward, and the identity chip last — the chip
 * is what makes it that agent, so it lands as the punchline.
 */
const teamSpec = (brand: BrandRef, chip: number, header = 'Domain-Specific Agent'): AgentSpec => ({
  header,
  slabs: [
    { label: 'Model' },
    { brand, tone: 'dashed', child: true, presence: chip },
    // The gap above the model closes as the slot opens, so the card grows to
    // make room for the chip instead of the chip appearing in space that was
    // already reserved for it.
    { label: 'System Prompt', gapBefore: 0.45 * (1 - chip) },
    { label: 'Tools' },
    { label: 'Messages' },
  ],
})

/** Seconds one specialist takes to build, and the gap before the next starts. */
const TEAM_BUILD = 1.15
const TEAM_STAGGER = 0.62

export const sceneTeam: Scene = (ctx, w, h, t, p) => {
  const pose = teamPose(w, h)
  let building = false

  // Four agents made one at a time, each one built the way the specialist was
  // — the point of the beat is that you make more of them, so the making is
  // what has to be on screen, not four finished boxes fading up.
  TEAM.forEach((brand, i) => {
    const from = i * TEAM_STAGGER
    const u = ease(seg(t, from, from + TEAM_BUILD))
    if (u <= 0.002) return
    if (u < 1) building = true
    const spec = teamSpec(brand, u)
    // Centre each stack on its cell as it grows, the same measure-and-centre
    // the anatomy track uses, so an agent does not drift while building.
    const m = measureAgent(spec, pose.scale)
    const anchorY = pose.cy(i) + (m.above - m.below) / 2
    drawAgent(ctx, p, pose.x(i), anchorY, pose.width, spec, pose.scale)
  })

  return building
}

/**
 * A child in the chain: the same agent as the one at the root, at a smaller
 * size, with its domain in the identity slot. That is the whole claim of this
 * beat — an agent calling an agent calls the same kind of thing — so the
 * children are the root's anatomy rather than a reduced sketch of it.
 */
const fractalSpec = (_brand: BrandRef): AgentSpec => ({
  // Every card in the graph descends from the one that renamed itself at the
  // end of the previous beat, so each arrives already carrying the name. It
  // used to be withheld until the container closed, which made the cards look
  // like they were being promoted one by one into something they already were.
  header: 'Standard Agent',
  headerTone: 'neutral',
  // Shape only. The coordinator is the card being read here; the ones it calls
  // are making the point that they are the SAME card, which their outline and
  // their colours already say. Repeating six labels on each of them at this
  // size is texture that competes with the card that has something to say.
  wordless: true,
  // Same colours as the agent they descend from. A kind of capability keeps
  // one colour wherever it appears, so the reader can see at a glance that
  // every card in the graph is built from the same parts.
  // No identity slot on this slide: the root card carries none, and the
  // children are the SAME card, so they carry none either. (The brand param
  // stays — callers use it to key each child, and the graph may want it back
  // if identities ever return.)
  slabs: [
    { label: 'Provider + Model', accent: 'provider' },
    { label: 'System Prompt' },
    {
      label: 'Tools',
      chips: ['Functions', 'Sub-prompts', 'Sub-agents'],
      chipAccents: { 'Sub-prompts': 'prompts', 'Sub-agents': 'gold' },
    },
    { label: 'Hooks', accent: 'hooks' },
    { label: 'Agent Rules', accent: 'rules' },
    // Every agent in the graph has a thread of its own. Leaving this off made
    // the children a different card from the one they descend from, which is
    // the one thing this beat cannot afford.
    { label: 'Messages' },
  ],
  footers: [
    { label: 'Storage', accent: 'files' },
    { label: 'Code Execution', accent: 'exec' },
  ],
})

export const TRACKS: Record<'anatomy', TimelineTrack> = {
  anatomy: {
    keyframes: 10,
    draw: anatomyDraw,
    // The coordinator's traffic keeps moving after the playhead has stopped,
    // so this segment asks the rig to keep painting.
    // Two ranges keep painting after the playhead lands: the coordinator's
    // bus traffic, and the message dots running between the cards of the
    // graph. Both are wall-clock animations on a settled beat.
    animatesAt: (playhead) =>
      (playhead > 2.95 && playhead < 3.35) ||
      (playhead > 5.8 && playhead < 6.2) ||
      playhead > 7.3,
    // The specialist segment carries four build cycles; at the standard pace
    // the whole sequence would be over in under a second. Rewinding is
    // quicker: everything leaves at once, so there is less to watch.
    //
    // Ramped across the approach rather than switched at a threshold — a
    // step change in playhead speed is a visible lurch partway through a
    // move, and the eye reads it as a dropped frame.
    rateAt: (playhead, dir) => {
      // 4→5 builds four agents in turn and needs the room. 5→6 is one move —
      // the grid becoming a row — so it goes back to something near the pace
      // of every other segment instead of inheriting the build's crawl.
      const build = dir && dir < 0 ? 0.75 : 0.34
      const arrange = 0.95
      // 6→7 is four separate decisions with rests between them. At the
      // arrange pace the whole lot is over in a second and reads as one
      // blurred mutation, so it plays at roughly a third of the speed.
      const transform = dir && dir < 0 ? 0.5 : 0.3
      // 7→8 is a travel followed by three arrivals in turn. It needs more room
      // than a single move but less than the transform, and going back is
      // quicker because the chain collapses together rather than in sequence.
      const chain = dir && dir < 0 ? 0.72 : 0.45
      // The brace relabelling itself, between the context and inheritance
      // keyframes. Same reasoning as every other typed rename here.
      const relabel =
        ss(seg(playhead, 2.76, 2.82)) * (1 - ss(seg(playhead, 2.99, 3.05)))
      const into = ss(seg(playhead, 3.55, 3.95))
      // The first rename, held between the chip landing and the build starting.
      // Same reasoning as the one at the end of the ideal beat: typing read at
      // the build's pace is a substitution, not typing.
      const naming =
        ss(seg(playhead, 3.99, 4.05)) * (1 - ss(seg(playhead, 4.19, 4.25)))
      const outOf = ss(seg(playhead, 4.9, 5.1))
      const last = ss(seg(playhead, 5.88, 6.02))
      // The rename is 35 characters typed one at a time. Playing it at the
      // transform pace put the whole thing inside a quarter of a second, which
      // reads as a substitution rather than as typing.
      const rename = ss(seg(playhead, 6.82, 6.88))
      // Typing is worth watching once. Coming back up the page the reader has
      // already read both names, so the erase-and-retype runs at a clip.
      const typeRate = dir && dir < 0 ? 0.24 : 0.09
      const out = ss(seg(playhead, 7.0, 7.12))
      // 8→9 is a fold: cards become cartons, the container closes on itself,
      // one package is named. Nearer the chain's pace than the transform's,
      // and quicker on the way back because a box opening does not need to be
      // studied twice.
      const ship = ss(seg(playhead, 8.0, 8.1))
      // 9→10 is a wall filling in and a cursor working across it. Slower than
      // the fold, because most of it is waiting to see what gets picked.
      // Slower still. Most of this beat is a hand moving between things and
      // pausing, and pauses only read as pauses if the playhead is crossing
      // them slowly enough for the eye to notice nothing happened.
      const shelf = ss(seg(playhead, 9.0, 9.08))
      const slowed = 1.25 + (build - 1.25) * into
      const braced = slowed + ((dir && dir < 0 ? 0.34 : 0.16) - slowed) * relabel
      const named = braced + ((dir && dir < 0 ? 0.3 : 0.12) - braced) * naming
      const arranged = named + (arrange - named) * outOf
      const transformed = arranged + (transform - arranged) * last
      const typing = transformed + (typeRate - transformed) * rename
      const chained = typing + (chain - typing) * out
      const shipped = chained + ((dir && dir < 0 ? 0.7 : 0.42) - chained) * ship
      const shelved = shipped + ((dir && dir < 0 ? 0.45 : 0.3) - shipped) * shelf
      // Only the PICKING is slow. The wall filling in is a fast, mechanical
      // thing and reads as broken when drawn out; the hand moving between
      // packages is the part that has to be watchable. Slowing the segment as
      // a whole to fix the second made the first glacial.
      // Going back, the stretch from the last pick up to the top of the beat
      // holds nothing but a cursor retracing its path, so it is crossed at
      // speed; below that the grid and the package are moving and it plays at
      // a watchable pace. Shaping the RATE rather than the windows is what
      // keeps it continuous — the states are identical in both directions, so
      // there is nothing to jump to when the reader turns around.
      const picking = ss(seg(playhead, 9.22, 9.3))
      return shelved + ((dir && dir < 0 ? 1.1 : 0.085) - shelved) * picking
    },
  },
}

export const SCENES: Record<string, Scene> = {
  team: sceneTeam,
}
