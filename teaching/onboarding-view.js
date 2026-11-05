const { stepsFor, placeCard } = require('./onboarding-content')
const { portraits } = require('./dialogue-content')

module.exports = class DeepSeekGuide {
  constructor (root, design, surface, task, dialogue) {
    this.surface = surface; this.task = task; this.dialogue = dialogue
    this.steps = stepsFor(design); this.active = false; this.index = 0
    this.seenKey = `deepseek-guide-v1:${design.slug || design.index}:${design.scenarioIndex || 0}`
    this.shell = document.createElement('section'); this.shell.className = 'deepseek-guide'; this.shell.hidden = true
    this.shell.innerHTML = '<div class="ds-guide-spot" aria-hidden="true"></div><div class="ds-guide-pointer" aria-hidden="true"></div><div class="ds-guide-card" role="dialog" aria-label="DeepSeek 操作引导"><div class="ds-guide-heading"><img alt="DeepSeek"><div><span>DeepSeek · 操作引导</span><h3 aria-live="polite"></h3></div></div><p class="ds-guide-text"></p><pre class="ds-guide-code"></pre><p class="ds-guide-note"></p><div class="ds-guide-footer"><button type="button" class="ds-guide-skip">跳过引导</button><span class="ds-guide-count"></span><button type="button" class="ds-guide-back">上一步</button><button type="button" class="ds-guide-next">下一步</button></div></div>'
    this.toggle = document.createElement('button'); this.toggle.className = 'ds-guide-toggle'; this.toggle.type = 'button'; this.toggle.textContent = 'DeepSeek 带路'; this.toggle.hidden = true
    this.toggle.setAttribute('aria-expanded', 'false')
    root.append(this.shell, this.toggle)
    this.card = this.shell.querySelector('.ds-guide-card'); this.spot = this.shell.querySelector('.ds-guide-spot')
    this.pointer = this.shell.querySelector('.ds-guide-pointer')
    this.card.querySelector('img').src = portraits.hero.image
    this.next = this.shell.querySelector('.ds-guide-next'); this.back = this.shell.querySelector('.ds-guide-back')
    this.next.onclick = () => this.index < this.steps.length - 1 ? this.show(this.index + 1) : this.close()
    this.back.onclick = () => this.show(this.index - 1)
    this.shell.querySelector('.ds-guide-skip').onclick = () => this.close()
    this.toggle.onclick = () => this.open()
    this.onKey = e => { if (this.active && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close() } }
    document.addEventListener('keydown', this.onKey, true)
    this.onRun = () => { if (this.active) this.close(false, false) }
    this.onPlaying = e => { if (this.active && e?.playing) Backbone.Mediator.publish('level:set-playing', { playing: false }) }
    this.onReady = () => {
      if (this.ready) return
      this.ready = true; this.toggle.hidden = false
      let seen = false
      try { seen = sessionStorage.getItem(this.seenKey) === 'seen' } catch (_) {}
      if (!seen) this.open()
      this.layout()
    }
    Backbone.Mediator.subscribe('level:loading-view-unveiled', this.onReady, this)
    Backbone.Mediator.subscribe('tome:manual-cast', this.onRun, this)
    Backbone.Mediator.subscribe('level:set-playing', this.onPlaying, this)
    this.onResize = () => this.layout(); window.addEventListener('resize', this.onResize)
    surface.on?.('resize', this.onResize, this)
    const loader = document.getElementById('level-loading-view')
    if (!loader || (loader.classList.contains('unveiled') && !loader.classList.contains('preview-screen'))) this.onReady()
  }

  open () {
    if (!this.ready || this.active) return
    this.previousFocus = document.activeElement
    this.wasPlaying = this.surface.playing && this.surface.currentFrame < (this.surface.world?.totalFrames || 0) - 5
    this.taskWasOpen = this.task?.open
    if (this.task) this.task.open = false
    this.active = true; this.shell.hidden = false; this.toggle.hidden = true
    document.body.classList.add('deepseek-guiding')
    this.toggle.setAttribute('aria-expanded', 'true')
    this.dialogue?.setGuideActive(true)
    Backbone.Mediator.publish('level:set-playing', { playing: false })
    this.show(0)
    this.next.focus({ preventScroll: true })
    // The camera can finish fitting the level after the loader disappears.
    this.timer = setInterval(() => this.layout(), 150)
  }

  show (index) {
    this.index = Math.max(0, Math.min(index, this.steps.length - 1))
    const step = this.steps[this.index]
    this.card.querySelector('h3').textContent = step.title
    this.card.querySelector('.ds-guide-text').textContent = step.text
    const code = this.card.querySelector('.ds-guide-code'); code.textContent = step.code || ''; code.hidden = !step.code
    const note = this.card.querySelector('.ds-guide-note'); note.textContent = step.note || ''; note.hidden = !step.note
    this.card.querySelector('.ds-guide-count').textContent = `${this.index + 1} / ${this.steps.length}`
    this.back.disabled = this.index === 0
    this.next.textContent = this.index === this.steps.length - 1 ? '我来试试' : '下一步'
    this.layout()
  }

  elementRect (selector) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden') return rect
    }
    return null
  }

  targetRect () {
    const step = this.steps[this.index]
    const selectors = { editor: '#code-area #spell-view .ace_editor', run: '#cast-button-view .cast-button', submit: '#cast-button-view .submit-button' }
    if (step.target !== 'map') {
      const rect = this.elementRect(selectors[step.target])
      if (rect) return rect
      // Some native layouts hide submit until the first run. Point to goals instead.
      return this.elementRect(step.target === 'submit' ? '#goals-view' : '#code-area')
    }
    const canvas = this.surface.normalCanvas?.[0]?.getBoundingClientRect()
    const camera = this.surface.camera
    if (!canvas?.width || !camera || !step.point) return null
    const p = camera.worldToCanvas({ x: step.point[0], y: step.point[1] })
    const x = canvas.left + p.x * canvas.width / camera.canvasWidth
    const y = canvas.top + p.y * canvas.height / camera.canvasHeight
    const width = step.pointKind === 'label' ? 220 : 74
    const height = step.pointKind === 'label' ? 40 : 86
    const left = Math.max(canvas.left + 2, Math.min(x - width / 2, canvas.right - width - 2))
    const top = Math.max(canvas.top + 2, Math.min(y - (step.pointKind === 'label' ? 20 : 64), canvas.bottom - height - 2))
    return { left, top, right: left + width, bottom: top + height, width, height }
  }

  layout () {
    const canvas = this.surface.normalCanvas?.[0]?.getBoundingClientRect()
    const hud = document.getElementById('thang-hud')?.getBoundingClientRect()
    const top = Math.min((hud?.bottom || canvas?.bottom || 400) + 18, window.innerHeight - 46)
    this.toggle.style.left = `${Math.max(130, (canvas?.left || 0) + 130)}px`; this.toggle.style.top = `${top}px`
    if (!this.active) return
    let rect = this.targetRect()
    this.spot.hidden = !rect
    if (!rect) rect = { left: 12, top: 60, right: 12, bottom: 60 }
    this.spot.style.left = `${rect.left - 5}px`; this.spot.style.top = `${rect.top - 5}px`
    this.spot.style.width = `${rect.right - rect.left + 10}px`; this.spot.style.height = `${rect.bottom - rect.top + 10}px`
    const cardRect = this.card.getBoundingClientRect()
    const avoid = ['run', 'submit'].includes(this.steps[this.index].target) ? [this.elementRect('#cast-button-view .cast-button'), this.elementRect('#cast-button-view .submit-button')].filter(Boolean) : []
    const position = placeCard(rect, cardRect.width, cardRect.height, { width: window.innerWidth, height: window.innerHeight }, avoid)
    this.card.style.left = `${position.left}px`; this.card.style.top = `${position.top}px`
    this.card.dataset.side = position.side
    const anchor = position.side === 'left' || position.side === 'right'
      ? (rect.top + rect.bottom) / 2 - position.top
      : (rect.left + rect.right) / 2 - position.left
    const dimension = position.side === 'left' || position.side === 'right' ? cardRect.height : cardRect.width
    const offset = Math.max(24, Math.min(anchor, dimension - 24))
    const horizontal = position.side === 'left' || position.side === 'right'
    this.pointer.hidden = this.spot.hidden
    this.pointer.dataset.side = position.side
    this.pointer.style.left = `${position.left + (horizontal ? (position.side === 'left' ? 0 : cardRect.width) : offset) - 6}px`
    this.pointer.style.top = `${position.top + (horizontal ? offset : (position.side === 'top' ? 0 : cardRect.height)) - 6}px`
    if (this.steps[this.index].target === 'submit') {
      const available = this.elementRect('#cast-button-view .submit-button')
      this.card.querySelector('.ds-guide-text').textContent = available ? this.steps[this.index].text : '先完成地图左上角的目标。运行后会出现“提交”按钮，再点它验证；通过后进入下一关或下一场景。'
    }
  }

  close (resume = true, restoreFocus = true) {
    if (!this.active) return
    this.active = false; clearInterval(this.timer)
    document.body.classList.remove('deepseek-guiding')
    this.shell.hidden = true; this.toggle.hidden = false; this.toggle.setAttribute('aria-expanded', 'false')
    if (this.task) this.task.open = this.taskWasOpen
    this.dialogue?.setGuideActive(false)
    try { sessionStorage.setItem(this.seenKey, 'seen') } catch (_) {}
    if (resume && this.wasPlaying) Backbone.Mediator.publish('level:set-playing', { playing: true })
    if (restoreFocus) (this.previousFocus?.isConnected && this.previousFocus !== document.body ? this.previousFocus : this.toggle).focus({ preventScroll: true })
  }

  destroy () {
    document.body.classList.remove('deepseek-guiding')
    clearInterval(this.timer)
    this.active = false
    Backbone.Mediator.unsubscribe('level:loading-view-unveiled', this.onReady, this)
    Backbone.Mediator.unsubscribe('tome:manual-cast', this.onRun, this)
    Backbone.Mediator.unsubscribe('level:set-playing', this.onPlaying, this)
    document.removeEventListener('keydown', this.onKey, true)
    window.removeEventListener('resize', this.onResize); this.surface.off?.('resize', this.onResize, this)
    this.shell.remove(); this.toggle.remove()
  }
}
