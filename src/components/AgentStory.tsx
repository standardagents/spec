/**
 * The "how can we make our agents portable?" scrolling story, ported from
 * standardagentbuilder.com (AgentStorySection, StoryFrame, TimelinePanel and
 * StoryPanel). The copy, tween constants and step logic are unchanged; fonts
 * and colors follow this site. The story splits into copy and a pinned stage
 * at one viewport width, STAGE_QUERY, and stacks below it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { agentStory, type StoryBullet } from '../story/agent-story-content'
import { BEAT_TARGETS, SCENES, TRACKS, type Scene } from '../story/agent-story-scenes'
import { createSceneCanvas, type SceneHandle } from '../story/scene-canvas'
import { paletteFor, resetDitherCaches } from '../story/scene-kit'

const beats = agentStory.beats.filter((b) => BEAT_TARGETS[b.id])

interface RichPart {
  text: string
  accent?: boolean
  em?: boolean
  code?: boolean
}

const rich = (text: string): RichPart[] =>
  text
    .split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      if (chunk.startsWith('**')) return { text: chunk.slice(2, -2), accent: true }
      if (chunk.startsWith('_')) return { text: chunk.slice(1, -1), em: true }
      if (chunk.startsWith('`')) return { text: chunk.slice(1, -1), code: true }
      return { text: chunk }
    })

const plain = (text: string) => rich(text).map((p) => p.text).join('')

const stepBeats = [{ id: 'question' }, ...beats.map((b) => ({ id: b.id }))]

/** Keep equal to the `stage` custom variant in global.css. */
const STAGE_QUERY = '(min-width: 75rem)'
const SWITCH_AT = 0.62
/** The pinned stage's scenes keep every label whole from this width up. */
const STAGE_SCENE_WIDTH = 800

const isLight = () => !document.documentElement.classList.contains('dark')

/**
 * Repaints a panel when the theme flips, and once when the web fonts arrive so
 * a parked canvas cannot keep its fallback-font labels.
 */
const watchPanelInputs = (invalidate: () => void) => {
  let light = isLight()
  const themeObserver = new MutationObserver(() => {
    if (isLight() === light) return
    light = isLight()
    resetDitherCaches()
    invalidate()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  let disposed = false
  void document.fonts.ready.then(() => {
    if (!disposed) invalidate()
  })
  return () => {
    disposed = true
    themeObserver.disconnect()
  }
}

const StoryFrame = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={`story-frame ${className ?? ''}`}>
    {['tl', 'tr', 'bl', 'br'].map((corner) => (
      <i key={corner} className="story-frame-handle" data-corner={corner} aria-hidden="true" />
    ))}
    {children}
  </div>
)

const PANEL_CLASS =
  'relative aspect-[5/4] w-full stage:absolute stage:inset-[14px] stage:aspect-auto stage:h-auto stage:w-auto'

/** Keyframes per second of playback. Matches KF_PER_SEC in the scenes' physics. */
const RATE = 1.25
const CATCH_UP_TAU = 0.42
const CATCH_UP_MAX = 8

interface TimelinePanelProps {
  track: 'anatomy'
  target: number
  label: string
  idle?: boolean
  inline?: boolean
}

const TimelinePanel = ({ track, target, label, idle, inline }: TimelinePanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<SceneHandle | null>(null)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const trackDef = TRACKS[track]
    let playhead: number | null = null
    let lastT = 0

    const handle = createSceneCanvas(
      canvas,
      (ctx, w, h, t, p) => {
        const goal = targetRef.current
        if (t > 900) {
          trackDef.draw(ctx, w, h, goal, p, 1)
          return false
        }
        if (playhead === null) playhead = Math.max(0, goal - 1)
        if (t < lastT) lastT = t
        const dt = Math.min(0.1, Math.max(0, t - lastT))
        lastT = t
        const d = goal - playhead
        const dir = d < 0 ? -1 : 1
        const authored = trackDef.rateAt?.(playhead, dir) ?? RATE
        const surplus = Math.max(0, Math.abs(d) - 1)
        const rate = Math.min(CATCH_UP_MAX, authored + surplus / CATCH_UP_TAU)
        const step = Math.sign(d) * Math.min(Math.abs(d), dt * rate)
        playhead += step
        trackDef.draw(ctx, w, h, playhead, p, dir)
        return playhead !== goal || (trackDef.animatesAt?.(playhead) ?? false)
      },
      () => paletteFor(isLight()),
      {
        label: `${track} track`,
        fps: 60,
        revealFraction: inline ? 0.6 : 0.15,
        topInset: inline ? 72 : 0,
        minWidth: inline ? undefined : STAGE_SCENE_WIDTH,
      },
    )
    handleRef.current = handle
    const stopWatching = watchPanelInputs(() => handle.invalidate())
    return () => {
      stopWatching()
      handle.destroy()
      handleRef.current = null
    }
  }, [track, inline])

  useEffect(() => {
    handleRef.current?.invalidate()
  }, [target])

  return (
    <div className={PANEL_CLASS}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        role="img"
        aria-label={label}
        data-idle={idle ? '' : undefined}
      />
    </div>
  )
}

interface StoryPanelProps {
  scene: Scene
  label: string
  idle?: boolean
  inline?: boolean
}

const StoryPanel = ({ scene, label, idle, inline }: StoryPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handle = createSceneCanvas(
      canvas,
      (ctx, w, h, t, p) => sceneRef.current(ctx, w, h, t, p),
      () => paletteFor(isLight()),
      {
        fps: 60,
        revealFraction: inline ? 0.6 : 0.15,
        topInset: inline ? 72 : 0,
        minWidth: inline ? undefined : STAGE_SCENE_WIDTH,
      },
    )
    const stopWatching = watchPanelInputs(() => handle.invalidate())
    return () => {
      stopWatching()
      handle.destroy()
    }
  }, [inline])

  return (
    <div className={`${PANEL_CLASS} stage:will-change-[opacity,transform]`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        role="img"
        aria-label={label}
        data-idle={idle ? '' : undefined}
      />
    </div>
  )
}

const Accented = ({ text }: { text: string }) => (
  <>
    {rich(text).map((part, i) =>
      part.accent ? (
        <span key={i} className="text-blue-600 dark:text-blue-400">{part.text}</span>
      ) : part.em ? (
        <em key={i}>{part.text}</em>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    )}
  </>
)

const HEADING_CLASS =
  'font-heading text-[1.375rem] stage:text-[clamp(1.75rem,9cqw,2.5rem)] leading-[1.15] font-light tracking-[0.01em] text-balance text-gray-900 dark:text-gray-100'
const SUBHEAD_CLASS =
  'mt-[1.1rem] text-base leading-[1.5] text-balance text-gray-700 dark:text-gray-300'
const STEP_MOTION_CLASS =
  'stage:motion-safe:transition-opacity stage:motion-safe:duration-[350ms] stage:motion-safe:ease-[ease]'

export default function AgentStory() {
  const rootRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [isWide, setIsWide] = useState(false)
  const isWideRef = useRef(false)

  const activeTarget = BEAT_TARGETS[(stepBeats[active] ?? stepBeats[0]!).id]!
  // A track keeps its last keyframe while inactive, so returning resumes it.
  const anatomyTarget = useRef(0)
  if (activeTarget.track === 'anatomy') anatomyTarget.current = activeTarget.kf

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      if (!isWideRef.current) return
      const steps = rootRef.current
        ? [...rootRef.current.querySelectorAll<HTMLElement>('.story-step')]
        : []
      if (steps.length < 2) return

      const line = window.innerHeight * 0.5
      const centres = steps.map((s) => {
        const r = s.getBoundingClientRect()
        return r.top + r.height / 2
      })

      let pos = 0
      if (line <= centres[0]!) pos = 0
      else if (line >= centres[centres.length - 1]!) pos = centres.length - 1
      else {
        for (let i = 0; i < centres.length - 1; i += 1) {
          const a = centres[i]!
          const b = centres[i + 1]!
          if (line >= a && line <= b) {
            pos = i + (line - a) / Math.max(1, b - a)
            break
          }
        }
      }

      const next = Math.floor(pos) + (pos - Math.floor(pos) >= SWITCH_AT ? 1 : 0)
      setActive(next)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const media = window.matchMedia(STAGE_QUERY)
    const syncLayout = () => {
      const wide = media.matches
      isWideRef.current = wide
      setIsWide(wide)
      kick()
    }

    media.addEventListener('change', syncLayout)
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    syncLayout()
    setMounted(true)

    return () => {
      media.removeEventListener('change', syncLayout)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const inlineFrames = mounted && !isWide
  const stepState = (index: number) =>
    !isWide || active === index ? 'is-active stage:opacity-100' : 'stage:motion-safe:opacity-[0.32]'

  return (
    <section
      id="agent-story"
      ref={rootRef}
      className="agent-story scroll-mt-28"
    >
      <div className="grid gap-6 stage:grid-cols-[minmax(27.25rem,0.72fr)_minmax(0,1.28fr)] stage:gap-12">
        {/* The bottom padding keeps the stage pinned until the last slide's copy
            has reached the centre of the window. */}
        <div className="@container stage:pb-[24vh]">
          <header
            className={`story-step py-7 stage:mt-16 stage:flex stage:min-h-[70vh] stage:flex-col stage:justify-center stage:py-4 ${STEP_MOTION_CLASS} ${stepState(0)}`}
          >
            <h3 className={HEADING_CLASS}>
              <Accented text={agentStory.headline} />
            </h3>
            {inlineFrames && (
              <StoryFrame className="my-5">
                <TimelinePanel inline track="anatomy" target={0} label={plain(agentStory.headline)} />
              </StoryFrame>
            )}
          </header>

          {beats.map((beat, i) => (
            <div
              key={beat.id}
              className={`story-step py-7 stage:flex stage:min-h-[32vh] stage:flex-col stage:justify-center stage:py-4 ${STEP_MOTION_CLASS} ${stepState(i + 1)}`}
            >
              <h3 className={HEADING_CLASS}>
                <Accented text={beat.headline} />
              </h3>

              {beat.subhead?.split(/\n\n+/).map((para) => (
                <p key={para} className={SUBHEAD_CLASS}>
                  <Accented text={para} />
                </p>
              ))}

              {inlineFrames && (
                <StoryFrame className="my-5">
                  {BEAT_TARGETS[beat.id]!.track !== 'team' ? (
                    <TimelinePanel
                      inline
                      track="anatomy"
                      target={BEAT_TARGETS[beat.id]!.kf}
                      label={plain(beat.headline)}
                    />
                  ) : (
                    <StoryPanel inline scene={SCENES.team!} label={plain(beat.headline)} />
                  )}
                </StoryFrame>
              )}

              {Array.isArray(beat.body) ? (
                <ul className="mt-[0.9rem] grid max-w-[30rem] list-disc gap-[0.45rem] pl-5 text-base leading-[1.5] text-gray-700 marker:text-blue-600 dark:text-gray-300 dark:marker:text-blue-400">
                  {beat.body.map((item) => (
                    <BodyItem key={typeof item === 'string' ? item : item.text} item={item} />
                  ))}
                </ul>
              ) : (
                beat.body?.split(/\n\n+/).map((para) => (
                  <p
                    key={para}
                    className="mt-[1.1rem] max-w-[30rem] text-base leading-[1.5] text-pretty text-gray-700 dark:text-gray-300"
                  >
                    {rich(para).map((part, j) =>
                      part.accent ? (
                        <span key={j} className="text-blue-600 dark:text-blue-400">{part.text}</span>
                      ) : part.em ? (
                        <em key={j} className="text-gray-900 dark:text-gray-100">{part.text}</em>
                      ) : part.code ? (
                        <code key={j} className="rounded bg-gray-900/[0.06] px-1.5 py-0.5 font-mono text-[0.88em] text-gray-900 dark:bg-white/10 dark:text-gray-100">
                          {part.text}
                        </code>
                      ) : (
                        <span key={j}>{part.text}</span>
                      ),
                    )}
                  </p>
                ))
              )}
            </div>
          ))}
        </div>

        {mounted && isWide && (
          // Half the frame's height is held in `top`, so the frame starts just
          // below the divider and then pins at the centre of the window.
          <div className="@container py-24">
            <div className="sticky top-[calc(50vh-min(41.667cqw,38vh))]">
            <StoryFrame className="relative aspect-[6/5] max-h-[76vh] w-full">
              <div className="contents" style={{ display: activeTarget.track === 'anatomy' ? undefined : 'none' }}>
                <TimelinePanel
                  track="anatomy"
                  target={anatomyTarget.current}
                  idle={activeTarget.track !== 'anatomy'}
                  label={plain(agentStory.headline)}
                />
              </div>
              <div className="contents" style={{ display: activeTarget.track === 'team' ? undefined : 'none' }}>
                <StoryPanel
                  scene={SCENES.team!}
                  idle={activeTarget.track !== 'team'}
                  label="A coordinator over four service agents"
                />
              </div>
            </StoryFrame>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const BodyItem = ({ item }: { item: string | StoryBullet }) => {
  const swatch = typeof item !== 'string' ? item.swatch : undefined
  return (
    <li className={swatch ? '-ml-5 flex list-none items-start gap-[0.6rem]' : ''}>
      {swatch && (
        <span
          className="mt-[0.25em] h-[0.85em] w-[0.85em] flex-none border border-[color:rgb(from_var(--swatch)_r_g_b_/_0.55)] bg-[conic-gradient(var(--swatch)_0_25%,transparent_0)] bg-[length:2px_2px]"
          style={{ '--swatch': `var(--ui-scene-${swatch})` } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1">
        {rich(typeof item === 'string' ? item : item.text).map((part, j) =>
          part.accent ? (
            <strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">{part.text}</strong>
          ) : part.em ? (
            <em key={j} className="text-gray-900 dark:text-gray-100">{part.text}</em>
          ) : (
            <span key={j}>{part.text}</span>
          ),
        )}
      </span>
    </li>
  )
}
