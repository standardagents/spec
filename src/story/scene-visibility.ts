/** Observer checkpoints also cover illustrations taller than the viewport. */
export const SCENE_VISIBILITY_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)

/** Require a readable part of the available viewport before playback begins. */
export const isSceneVisible = (entry: IntersectionObserverEntry | undefined, fraction: number) => {
  if (!entry?.isIntersecting) return false
  const { width, height } = entry.boundingClientRect
  const availableHeight = Math.min(height, entry.rootBounds?.height ?? height)
  return width > 0 && availableHeight > 0 &&
    entry.intersectionRect.height >= availableHeight * fraction &&
    entry.intersectionRect.width >= width * fraction
}
