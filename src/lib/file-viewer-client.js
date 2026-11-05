// Client code for file viewers. rehype-file-viewers.mjs inlines it once in a page,
// and each viewer then calls fileViewer() right after its markup, so the viewer is
// ready before it paints. Without this script, every file stays in the page.
//
// The client router runs this script again each time a reader returns to a page,
// and the guard keeps one set of listeners. The router handles a viewer link as a
// hash link, so it owns the history entry and keeps back and forward in step.
window.fileViewer ??= (() => {
  const count = (text, pattern) => (text.match(pattern) ?? []).length

  const markDefinition = (panel, mark) => {
    const pre = panel.querySelector('pre')
    if (!pre) return
    panel.querySelectorAll('.fv-mark').forEach((line) => line.classList.remove('fv-mark'))
    pre.scrollTop = 0
    if (!mark) return
    const lines = [...pre.querySelectorAll('.line')]
    let index = lines.findIndex((line) => line.textContent.includes(mark))
    if (index === -1) return
    const first = lines[index]
    // A definition runs until its brackets close.
    let depth = 0
    do {
      const text = lines[index].textContent
      depth += count(text, /[[{(]/g) - count(text, /[\]})]/g)
      lines[index].classList.add('fv-mark')
      index += 1
    } while (depth > 0 && index < lines.length)
    pre.scrollTop = Math.max(0, first.offsetTop - 40)
  }

  const show = (viewer, view, mark) => {
    let open
    viewer.querySelectorAll('.fv-panel').forEach((panel) => {
      const isOpen = panel.dataset.fvView === view
      panel.classList.toggle('is-open', isOpen)
      if (isOpen) open = panel
    })
    if (!open) return
    viewer.querySelector('.fv-select').value = view
    document.querySelectorAll(`a[data-fv-viewer="${viewer.id}"]`).forEach((link) => {
      const inNav = link.closest('.fv-nav')
      const current =
        link.dataset.fvView === view && (inNav || (link.dataset.fvMark ?? '') === (mark ?? ''))
      if (current) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    })
    markDefinition(open, mark)
    return open
  }

  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1))
    const panel = id ? document.getElementById(id) : null
    return panel?.classList.contains('fv-panel') ? panel : null
  }

  // The router scrolls to a hash link's target, and a view change must not move
  // the page, so this listener saves the position before the router runs.
  let before = { x: 0, y: 0 }
  document.addEventListener('click', () => {
    before = { x: scrollX, y: scrollY }
  }, true)

  // This window listener runs after the router's document listener.
  addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-fv-view]')
    if (!link || !event.defaultPrevented) return
    const viewer = document.getElementById(link.dataset.fvViewer)
    if (!viewer?.classList.contains('fv-ready')) return
    const mark = link.dataset.fvMark
    const panel = show(viewer, link.dataset.fvView, mark)
    scrollTo({ left: before.x, top: before.y, behavior: 'instant' })
    history.replaceState({ ...history.state, mark, scrollX: before.x, scrollY: before.y }, '')
    viewer.scrollIntoView({ block: 'nearest' })
    // A keyboard click has no detail, or in Firefox no position. Only that reader's
    // focus moves to the new view.
    const byKeyboard = event.detail === 0 || (event.clientX === 0 && event.clientY === 0)
    if (byKeyboard && !link.closest('.fv-nav')) (panel.querySelector('pre') ?? panel).focus({ preventScroll: true })
  })

  document.addEventListener('change', (event) => {
    if (!event.target.matches?.('.fv-select')) return
    const viewer = event.target.closest('.fv')
    const panel = show(viewer, event.target.value)
    history.replaceState({ ...history.state, mark: undefined }, '', `#${panel.id}`)
  })

  addEventListener('popstate', (event) => {
    const panel = fromHash()
    if (panel) show(panel.closest('.fv'), panel.dataset.fvView, event.state?.mark)
    else if (!location.hash) document.querySelectorAll('.fv').forEach((viewer) => show(viewer, viewer.querySelector('.fv-panel').dataset.fvView))
  })

  return (viewer) => {
    viewer.classList.add('fv-ready')
    const first = viewer.querySelector('.fv-panel')
    const linked = fromHash()
    const isLinked = linked?.closest('.fv') === viewer
    show(viewer, isLinked ? linked.dataset.fvView : first.dataset.fvView, isLinked ? history.state?.mark : undefined)
    // A history move has a saved scroll position, and the router restored it.
    if (isLinked && !history.state?.scrollY) viewer.scrollIntoView()
  }
})()
