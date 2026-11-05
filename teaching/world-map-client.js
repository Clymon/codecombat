/* global document, window, history, location */
// Progressive enhancement: without JS every task and scene form remains available.
(() => {
  const root = document.querySelector('.world-campaign')
  if (!root) return
  const viewport = root.querySelector('.map-viewport'); const canvas = root.querySelector('.map-canvas')
  const cards = [...root.querySelectorAll('.level-card')]; const nodes = [...root.querySelectorAll('.map-node')]
  const sections = [...root.querySelectorAll('.world-details .chapter')]
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const behavior = motionPreference.matches ? 'auto' : 'smooth'
  const drawer = root.querySelector('.world-details')
  let motionPaused = false; let mapInView = true; let idleTimer
  try { motionPaused = window.localStorage.getItem('teaching-world-motion') === 'paused' } catch (_) {}
  const motionButton = document.createElement('button')
  motionButton.type = 'button'
  motionButton.dataset.mapMotion = ''
  root.querySelector('.map-toolbar > div').prepend(motionButton)
  function resetIdle () {
    clearTimeout(idleTimer)
    root.classList.remove('map-idle')
    if (root.classList.contains('map-animated')) idleTimer = setTimeout(() => root.classList.add('map-idle'), 12000)
  }
  function syncMotion () {
    const enabled = !motionPaused && !motionPreference.matches
    root.classList.toggle('map-animated', enabled && !document.hidden && mapInView && !drawer.classList.contains('is-open'))
    motionButton.textContent = enabled ? '动效：开' : '动效：关'
    motionButton.setAttribute('aria-label', enabled ? '关闭地图动效' : '开启地图动效')
    motionButton.setAttribute('aria-pressed', String(enabled))
    motionButton.disabled = motionPreference.matches
    motionButton.title = motionPreference.matches ? '已遵循系统“减少动态效果”设置' : '关闭后保留静态地图与全部关卡功能'
    resetIdle()
  }
  motionButton.addEventListener('click', () => {
    motionPaused = !motionPaused
    try { window.localStorage.setItem('teaching-world-motion', motionPaused ? 'paused' : 'on') } catch (_) {}
    syncMotion()
  })
  document.addEventListener('visibilitychange', syncMotion)
  motionPreference.addEventListener('change', syncMotion)
  for (const event of ['pointerdown', 'keydown', 'wheel']) root.addEventListener(event, resetIdle, { passive: true })
  const visibilityObserver = new window.IntersectionObserver(entries => {
    mapInView = entries[0].isIntersecting
    syncMotion()
  })
  visibilityObserver.observe(viewport)
  syncMotion()
  const backdrop = document.createElement('div')
  backdrop.className = 'map-drawer-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')
  root.append(backdrop)
  drawer.setAttribute('role', 'dialog')
  drawer.setAttribute('aria-modal', 'true')
  drawer.setAttribute('aria-labelledby', 'map-task-title')
  drawer.setAttribute('aria-hidden', 'true')
  let returnFocus; let previousOverflow
  const closeDrawer = () => {
    if (!drawer.classList.contains('is-open')) return
    drawer.classList.remove('is-open')
    backdrop.classList.remove('is-open')
    drawer.setAttribute('aria-hidden', 'true')
    syncMotion()
    document.body.style.overflow = previousOverflow
    returnFocus?.focus({ preventScroll: true })
  }
  const openDrawer = () => {
    if (!drawer.classList.contains('is-open')) {
      returnFocus = document.activeElement
      previousOverflow = document.body.style.overflow
    }
    drawer.classList.add('is-open')
    backdrop.classList.add('is-open')
    drawer.setAttribute('aria-hidden', 'false')
    syncMotion()
    drawer.scrollTop = 0
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      if (drawer.classList.contains('is-open')) drawer.querySelector('[data-map-close]').focus({ preventScroll: true })
    })
  }
  backdrop.addEventListener('click', closeDrawer)
  drawer.addEventListener('transitionend', event => {
    if (event.target === drawer && event.propertyName === 'transform' && drawer.classList.contains('is-open') && !drawer.contains(document.activeElement)) {
      drawer.querySelector('[data-map-close]').focus({ preventScroll: true })
    }
  })
  document.addEventListener('keydown', event => {
    if (!drawer.classList.contains('is-open')) return
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); return }
    if (event.key !== 'Tab') return
    const controls = [...drawer.querySelectorAll('button, a[href], input, summary')].filter(el => !el.disabled && el.getClientRects().length)
    const first = controls[0]; const last = controls.at(-1)
    if (!drawer.contains(document.activeElement)) { event.preventDefault(); first.focus(); return }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
  let selected; let zoom = 1
  const bySlug = slug => cards.find(c => c.id === slug)
  const pan = node => {
    if (!node) return
    viewport.scrollTo({ left: node.offsetLeft - viewport.clientWidth / 2, top: node.offsetTop - viewport.clientHeight / 2, behavior })
  }
  function select (slug, { updateUrl = true, moveMap = true, showDetails = false } = {}) {
    const card = bySlug(slug)
    if (!card) return false
    selected = slug
    for (const c of cards) c.classList.toggle('is-selected', c === card)
    for (const section of sections) section.classList.toggle('is-selected', section.contains(card))
    for (const n of nodes) { n.classList.toggle('is-selected', n.dataset.level === slug); n.setAttribute('aria-current', n.dataset.level === slug ? 'step' : 'false') }
    const node = nodes.find(n => n.dataset.level === slug)
    const section = card.closest('.chapter')
    root.querySelector('.selected-region').textContent = section.querySelector('.chapter-heading h2').textContent + ' · ' + card.querySelector('h3').textContent
    for (const link of root.querySelectorAll('[data-region]')) link.classList.toggle('is-selected', link.dataset.region === section.id.slice(8))
    if (updateUrl) history.replaceState(null, '', `?level=${encodeURIComponent(slug)}#${slug}`)
    if (moveMap) pan(node)
    if (showDetails) openDrawer()
    return true
  }
  function region (id, options = {}) {
    const section = sections.find(s => s.id === `chapter-${id}`)
    const available = section && [...section.querySelectorAll('.level-card')]
    const card = available?.find(c => c.classList.contains('unlocked') && !c.classList.contains('completed')) || available?.[0]
    if (card) select(card.id, options)
  }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-map-close]')) { closeDrawer(); return }
    const level = event.target.closest('[data-level]'); const area = event.target.closest('[data-region]')
    if (level) { event.preventDefault(); select(level.dataset.level, { showDetails: true }); return }
    if (area) { event.preventDefault(); region(area.dataset.region); return }
    if (event.target.closest('[data-map-home]')) { select(canvas.dataset.next || cards[0]?.id); return }
    const control = event.target.closest('[data-map-zoom]')
    if (control) {
      zoom = Math.max(1, Math.min(1.6, zoom + (control.dataset.mapZoom === 'in' ? 0.2 : -0.2)))
      canvas.style.width = `${Math.max(900, viewport.clientWidth) * zoom}px`
      pan(nodes.find(n => n.dataset.level === selected))
    }
  })
  function fromAddress () {
    const hash = location.hash.slice(1); const query = new URLSearchParams(location.search).get('level')
    if (bySlug(hash)) return select(hash, { updateUrl: false })
    if (/^chapter-[1-5]$/.test(hash)) { region(hash.slice(8), { updateUrl: false }); return }
    select(bySlug(query)?.id || canvas.dataset.next || cards[0]?.id, { updateUrl: false })
  }
  root.classList.add('map-ready')
  if (!cards.length) root.querySelector('.map-selection-empty').hidden = false
  fromAddress()
  window.addEventListener('hashchange', fromAddress)
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload() })
  let timer
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { canvas.style.width = zoom === 1 ? '' : `${Math.max(900, viewport.clientWidth) * zoom}px`; pan(nodes.find(n => n.dataset.level === selected)) }, 150) })
})()
