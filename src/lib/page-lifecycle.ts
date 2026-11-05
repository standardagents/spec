type Cleanup = void | (() => void)

declare global {
  interface Window {
    __pageSetups?: Map<string, () => Cleanup>
  }
}

/**
 * Runs `setup` on every page view, on a hard load and after each client-side
 * navigation. The function that `setup` returns runs before the next page swaps
 * in, and it must remove anything attached to `document` or `window`.
 *
 * The client router runs a bundled script only once, but it can run an inlined
 * script again on later pages. The key keeps one setup for each script either way.
 */
export function onPage(key: string, setup: () => Cleanup) {
  const isFirst = !window.__pageSetups
  const setups = (window.__pageSetups ??= new Map())
  setups.set(key, setup)
  if (!isFirst) return

  let cleanups: Cleanup[] = []
  document.addEventListener('astro:page-load', () => {
    cleanups = [...setups.values()].map((run) => run())
  })
  document.addEventListener('astro:before-swap', () => {
    cleanups.forEach((cleanup) => cleanup?.())
    cleanups = []
  })
}
