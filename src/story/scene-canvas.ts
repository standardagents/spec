/**
 * Canvas rig for scene panels.
 *
 * Everything here is a measured lesson from profiling the hero canvas, the
 * god-rays curtain and the Say More layer on an iPhone 17 Pro Max. Scenes get
 * these behaviours for free so no individual illustration has to remember
 * them, which matters because this page is about to carry a lot of canvas.
 *
 * WHAT WE MEASURED, AND WHAT IT MEANS FOR SCENES
 *
 * 1. A canvas that repaints every frame costs a full texture upload every
 *    frame, whether or not its pixels changed. The single biggest saving
 *    available is to STOP. Most story panels play a short arc and then hold a
 *    still image, so `draw` returns true only while it still wants frames;
 *    the loop parks itself the moment it returns falsy and restarts on
 *    invalidate(). A settled panel costs nothing at all.
 *
 * 2. Display rate is usually wasted. The curtain was repainting 60x/second to
 *    change 0.06% of its pixels; capped to 30 it is visually identical and
 *    halves the work. Scenes default to 30fps and may opt lower.
 *
 * 3. Pattern fills MUST happen in device space. Under the fractional scale a
 *    scene draws at, filling a 4px dither tile minifies it and the browser
 *    resamples into uneven blotches; it is also ~1.4x slower than mapping the
 *    rect to device pixels first. scene-kit's ditherRect does this. Do not
 *    reintroduce a scene-space pattern fill.
 *
 * 4. Backing stores are the memory cost, and they are not free just because
 *    the panel is off screen. Two Say More canvases held 31.6MB on a phone for
 *    a layer that never painted. Panels here allocate on first reveal, and the
 *    dpr is capped against a total pixel budget so eight panels at 3x cannot
 *    add up to a hundred megabytes.
 *
 * 5. Rendering below devicePixelRatio is visible. The hero sat at 1.5x on a 3x
 *    phone and read as soft against the same scene on desktop. Render at the
 *    real ratio when the budget allows, and spend the budget on the panel the
 *    reader is actually looking at.
 *
 * 6. Offscreen work must actually stop. `position: fixed` defeats an
 *    IntersectionObserver, and a hover-capability flag is not a hover state.
 *    Gate on real visibility, and honour the crossfade's `data-idle`.
 *
 * 7. Caching a static layer into an offscreen canvas did NOT pay off on
 *    device: one full-canvas blit cost about what redrawing 150 thin strokes
 *    cost. Do not add a cache layer without measuring it on a phone first.
 *
 * 8. `performance.now()` is clamped to 1ms on iOS. Never time a single frame;
 *    average over many. Animation timing uses the rAF timestamp, which is
 *    fine.
 */

import type { Palette } from './scene-kit'
import { beginBounds, readBounds } from './scene-kit'
import { isSceneVisible, SCENE_VISIBILITY_THRESHOLDS } from './scene-visibility'

/**
 * @returns `true` while the scene still needs frames. Return falsy to let the
 *   rig park the loop until something invalidates it.
 */
export type SceneDraw = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  /** Seconds since this scene last started or was reset. */
  t: number,
  p: Palette,
) => boolean | undefined

export interface SceneOptions {
  /** Visible fraction of the frame, capped to the available viewport height. */
  revealFraction?: number
  /** Fixed header space excluded from the visible viewport. */
  topInset?: number
  /** Repaint ceiling. 30 is plenty for everything on this page. */
  fps?: number
  /**
   * Total device pixels any single panel may allocate. 3x on a 440pt phone
   * across a full-width panel is ~1.3MP; the cap keeps a tall panel on a
   * large display from running away.
   */
  maxPixels?: number
  /**
   * Shrink the frame when a scene draws outside it, so an illustration can
   * never clip. Measured from what the kit primitives report, applied on the
   * next paint, and only ever downward — a scene that fits is untouched.
   * Set false for a scene that bleeds off the edge deliberately.
   */
  fit?: boolean
  /** Breathing room kept between the content and the canvas edge, in CSS px. */
  fitMargin?: number
  /**
   * Narrowest width a scene lays itself out at, in CSS px. A narrower canvas
   * draws at this width and scales down, so labels shrink and stay whole.
   */
  minWidth?: number
  /** Named in the dev overflow warning. Defaults to the canvas's data-scene. */
  label?: string
}

const DEFAULT_MAX_PIXELS = 2_400_000

export interface SceneHandle {
  /** Ask for frames again — scroll-driven scenes call this on scroll. */
  invalidate(): void
  /** Restart the arc from t=0. The crossfade calls this on taking the stage. */
  reset(): void
  destroy(): void
}

export const createSceneCanvas = (
  canvas: HTMLCanvasElement,
  draw: SceneDraw,
  palette: () => Palette,
  options: SceneOptions = {},
): SceneHandle => {
  const fps = options.fps ?? 30
  const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS
  const interval = 1000 / fps - 1

  const ctx = canvas.getContext('2d')
  let width = 0
  let height = 0
  let scale = 1
  let sceneWidth = 0
  let sceneHeight = 0
  let frame: number | null = null
  let lastDrawAt = -Infinity
  let startedAt = 0
  let visible = false
  /** Lesson 4: nothing is allocated until the panel is first revealed. */
  let allocated = false
  let disposed = false

  const motion = matchMedia('(prefers-reduced-motion: reduce)')

  const idle = () => canvas.hasAttribute('data-idle')
  const active = () => visible && !idle() && !disposed

  const measure = () => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    // A new frame size is a fresh question: the scene relays out, so whatever
    // it needed at the old size says nothing about what it needs now.
    if (rect.width !== width || rect.height !== height) resetFit()
    width = rect.width
    height = rect.height
    sceneWidth = Math.max(width, options.minWidth ?? 0)
    sceneHeight = height * (sceneWidth / width)
    // Lesson 5 tempered by lesson 4: real density, then pulled back only if
    // this particular panel would blow the pixel budget.
    const want = Math.min(window.devicePixelRatio || 1, 3)
    const capped = Math.sqrt(maxPixels / Math.max(1, width * height))
    scale = Math.max(1, Math.min(want, capped))
    const bw = Math.round(width * scale)
    const bh = Math.round(height * scale)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    ctx?.setTransform(scale, 0, 0, scale, 0, 0)
    allocated = true
    return true
  }

  // Fit state. `k` shrinks toward whatever the widest frame of the arc needs
  // and never climbs back, so a scene cannot oscillate between sizes as its
  // keyframes come and go. Reset on resize, where the question is fresh.
  const wantsFit = options.fit !== false
  const fitMargin = options.fitMargin ?? 8
  let k = 1
  let offsetX = 0
  let offsetY = 0
  let warned = false

  const resetFit = () => {
    k = 1
    offsetX = 0
    offsetY = 0
    warned = false
  }

  const label = () => options.label ?? canvas.dataset.scene ?? 'scene'

  /**
   * Fold this frame's overflow into the fit transform, and report it once.
   * @returns true when the transform moved, so the caller can repaint.
   */
  const absorb = () => {
    const b = readBounds()
    if (!b) return false
    // Primitives report the coordinates they were handed, which the fit
    // transform never touches, so these are always pre-fit scene space. The
    // measurement is therefore stable frame to frame and the fit converges.
    const { x1, y1, x2, y2 } = b
    const overLeft = Math.max(0, fitMargin - x1)
    const overTop = Math.max(0, fitMargin - y1)
    const overRight = Math.max(0, x2 - (sceneWidth - fitMargin))
    const overBottom = Math.max(0, y2 - (sceneHeight - fitMargin))
    if (overLeft + overTop + overRight + overBottom < 0.5) return false

    if (import.meta.env.DEV && !warned) {
      warned = true
      const over = (n: number) => `${Math.round(n)}px`
      console.warn(
        `[scene:${label()}] content overflows its canvas — ` +
          [
            overLeft && `left ${over(overLeft)}`,
            overTop && `top ${over(overTop)}`,
            overRight && `right ${over(overRight)}`,
            overBottom && `bottom ${over(overBottom)}`,
          ]
            .filter(Boolean)
            .join(', ') +
          `. Canvas ${Math.round(width)}×${Math.round(height)}, content ` +
          `${Math.round(x2 - x1)}×${Math.round(y2 - y1)} at (${Math.round(x1)}, ${Math.round(y1)}).` +
          (wantsFit ? ' Scaling to fit; give the layout the room instead.' : ''),
      )
    }
    if (!wantsFit) return false

    const contentW = Math.max(1, x2 - x1)
    const contentH = Math.max(1, y2 - y1)
    const room = (span: number, content: number) =>
      Math.min(1, (span - fitMargin * 2) / content)
    const next = Math.min(k, Math.max(0.35, Math.min(room(sceneWidth, contentW), room(sceneHeight, contentH))))
    if (next >= k - 0.001) return false
    k = next
    // Re-centre what the scene drew inside the frame it actually has.
    offsetX = (sceneWidth - contentW * k) / 2 - x1 * k
    offsetY = (sceneHeight - contentH * k) / 2 - y1 * k
    return true
  }

  const paint = (now: number) => {
    if (!ctx || !allocated) return false
    lastDrawAt = now
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, width, height)
    // Reduced motion gets the settled frame, never the arc.
    const t = motion.matches ? 999 : (now - startedAt) / 1000
    if (sceneWidth !== width) ctx.scale(width / sceneWidth, width / sceneWidth)
    if (k !== 1 || offsetX || offsetY) ctx.transform(k, 0, 0, k, offsetX, offsetY)
    beginBounds()
    const more = draw(ctx, sceneWidth, sceneHeight, t, palette()) === true
    // Only the settled frame is measured. Mid-arc, pieces fall away and fly in
    // from outside the frame on purpose; judging the fit against a transient
    // state would shrink the scene to accommodate motion that is meant to
    // leave. A keyframe that has come to rest is the thing that must fit.
    // A settled frame that then gets re-fitted needs one more paint, or the
    // new transform would be computed and never drawn.
    if (!more) return absorb()
    return more
  }

  /** Set false by a paint that reports the scene has settled. */
  let wantsFrames = true

  const tick = (now: number) => {
    if (!active()) { frame = null; return }
    // Lesson 2: gate on elapsed time. A skipped frame costs a comparison and
    // leaves the canvas untouched, so the compositor reuses its texture.
    // A throw inside a scene used to kill the loop outright: the rAF callback
    // unwound, `frame` kept the id of a frame that had already fired, and
    // start() then refused to re-arm because it looked like the loop was
    // running. The scene froze mid-move with no error anyone would connect to
    // it. One bad frame is survivable; a dead panel is not.
    if (now - lastDrawAt >= interval) {
      try {
        wantsFrames = paint(now)
      } catch (err) {
        if (import.meta.env.DEV) console.error(`[scene:${label()}] draw threw`, err)
        wantsFrames = true
      }
    }
    // Lesson 1: park the moment the scene says it has settled.
    frame = wantsFrames ? requestAnimationFrame(tick) : null
  }

  const start = () => {
    if (!active()) return
    cancelRelease()
    if (!allocated && !measure()) return
    // Reduced motion never animates: paint the settled frame once and park.
    if (motion.matches) { stop(); paint(performance.now()); return }
    if (frame === null) { wantsFrames = true; frame = requestAnimationFrame(tick) }
  }

  const stop = () => {
    if (frame !== null) { cancelAnimationFrame(frame); frame = null }
  }

  /**
   * Hand the backing store back. A panel that has scrolled past, or that the
   * crossfade has parked, is holding megabytes for a picture nobody is looking
   * at — the same waste the Say More layer was carrying on a phone. Deferred a
   * beat so scrubbing back and forth across a hand-off does not thrash.
   */
  let releaseTimer: ReturnType<typeof setTimeout> | null = null
  const release = () => {
    if (releaseTimer) clearTimeout(releaseTimer)
    releaseTimer = setTimeout(() => {
      releaseTimer = null
      if (active() || !allocated) return
      canvas.width = 0
      canvas.height = 0
      allocated = false
    }, 1200)
  }
  const cancelRelease = () => {
    if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
  }

  const invalidate = () => { lastDrawAt = -Infinity; start() }

  const reset = () => {
    startedAt = performance.now()
    invalidate()
  }

  // Lesson 6: gate on real visibility, and re-arm the arc on arrival so a
  // panel is never joined mid-flight or already finished.
  const io = new IntersectionObserver(([entry]) => {
    const now = isSceneVisible(entry, options.revealFraction ?? 0.15)
    if (now === visible) return
    visible = now
    // Allocation is start()'s job, and start() refuses while the panel is
    // idle. Measuring here instead would allocate every panel on a stacked
    // sticky stage, where all of them intersect the viewport at once — eight
    // full-size backing stores for the one the reader can actually see.
    if (visible) reset()
    else { stop(); release() }
  }, {
    threshold: SCENE_VISIBILITY_THRESHOLDS,
    rootMargin: `-${options.topInset ?? 0}px 0px 0px 0px`,
  })
  io.observe(canvas)

  const ro = new ResizeObserver(() => {
    if (!visible) { allocated = false; return }
    if (measure()) invalidate()
  })
  ro.observe(canvas)

  // The crossfade toggles data-idle on the outgoing panel; stop with it.
  const mo = new MutationObserver(() => {
    if (idle()) { stop(); release() } else start()
  })
  mo.observe(canvas, { attributes: true, attributeFilter: ['data-idle'] })

  const onMotion = () => { reset() }
  motion.addEventListener('change', onMotion)

  return {
    invalidate,
    reset,
    destroy() {
      disposed = true
      stop()
      cancelRelease()
      io.disconnect()
      ro.disconnect()
      mo.disconnect()
      motion.removeEventListener('change', onMotion)
      // Release the backing store rather than leaving megabytes parked.
      canvas.width = 0
      canvas.height = 0
    },
  }
}
