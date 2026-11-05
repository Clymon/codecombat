const { portraits, introFor, replayLines } = require('./dialogue-content')

module.exports = class VillageDialogue {
  constructor (root, design, surface, options = {}) {
    this.root = root; this.design = design; this.surface = surface
    this.intro = introFor(design); this.history = []; this.mode = null; this.index = 0
    this.seenKey = `village-dialogue-v1:${design.slug || design.index}`
    this.shell = document.createElement('section'); this.shell.className = 'village-dialogue'; this.shell.hidden = true
    this.shell.setAttribute('aria-label', '人物对话')
    this.shell.innerHTML = '<img class="vn-portrait" alt=""><div class="vn-box"><div class="vn-heading"><strong class="vn-name"></strong><span class="vn-role"></span><button class="vn-close" type="button">收起</button></div><p class="vn-line"></p><div class="vn-footer"><span class="vn-count"></span><button class="vn-next" type="button">继续</button></div></div>'
    this.toggle = document.createElement('button'); this.toggle.className = 'vn-toggle'; this.toggle.type = 'button'; this.toggle.textContent = '人物对话'
    this.toggle.setAttribute('aria-expanded', 'false')
    root.append(this.shell, this.toggle)
    this.image = this.shell.querySelector('.vn-portrait'); this.line = this.shell.querySelector('.vn-line')
    this.next = this.shell.querySelector('.vn-next'); this.closeButton = this.shell.querySelector('.vn-close')
    this.next.onclick = () => this.advance()
    this.line.onclick = () => this.reveal()
    this.closeButton.onclick = () => { this.muted = this.mode !== 'intro'; this.hide(); this.rememberIntro(); this.toggle.focus() }
    this.toggle.onclick = () => {
      if (!this.shell.hidden) { this.hide(); return }
      this.muted = false
      this.open([...this.intro, ...this.history], 'history')
    }
    this.onKey = e => {
      if (e.key === 'Escape' && !this.shell.hidden && this.shell.contains(document.activeElement)) { e.stopPropagation(); this.hide(); this.toggle.focus() }
    }
    this.shell.addEventListener('keydown', this.onKey)
    this.onReady = () => {
      if (this.ready) return
      this.ready = true
      let seen = false
      try { seen = sessionStorage.getItem(this.seenKey) === 'seen' } catch (_) {}
      if (options.autoIntro !== false && !seen && this.intro.length) this.open(this.intro, 'intro')
      this.layout()
    }
    Backbone.Mediator.subscribe('level:loading-view-unveiled', this.onReady, this)
    this.onResize = () => this.layout(); window.addEventListener('resize', this.onResize)
    surface.on?.('resize', this.onResize, this)
    const loader = document.getElementById('level-loading-view')
    if (!loader || (loader.classList.contains('unveiled') && !loader.classList.contains('preview-screen'))) this.onReady()
    this.layout()
  }

  setGuideActive (active) {
    this.guideActive = active
    if (active) this.hide()
    this.toggle.hidden = active
  }

  rememberIntro () {
    try { sessionStorage.setItem(this.seenKey, 'seen') } catch (_) {}
  }

  layout () {
    const canvas = this.surface.normalCanvas?.[0]?.getBoundingClientRect()
    if (!canvas) return
    const hud = document.getElementById('thang-hud')?.getBoundingClientRect()
    const top = Math.min((hud?.bottom || canvas.bottom) + 10, window.innerHeight - 156)
    this.shell.style.left = `${Math.max(8, canvas.left + 12)}px`
    this.shell.style.top = `${top}px`
    this.shell.style.width = `${Math.max(280, canvas.width - 24)}px`
    this.shell.style.height = `${Math.max(140, Math.min(252, window.innerHeight - top - 12))}px`
    this.toggle.style.left = `${Math.max(8, canvas.left + 16)}px`
    this.toggle.style.top = `${top + 8}px`
  }

  open (lines, mode) {
    if (!lines.length) return
    this.lines = lines; this.mode = mode; this.index = 0
    this.shell.hidden = false; this.toggle.hidden = true; this.toggle.setAttribute('aria-expanded', 'true')
    this.layout(); this.showLine()
  }

  showLine () {
    clearInterval(this.timer)
    const entry = this.lines[this.index]; const actor = portraits[entry.speaker]
    this.image.src = actor.image; this.image.alt = `${actor.name}立绘`
    this.shell.dataset.speaker = entry.speaker
    this.shell.querySelector('.vn-name').textContent = actor.name
    this.shell.querySelector('.vn-role').textContent = entry.speaker === 'hero' ? '你的代码发言' : actor.role
    this.shell.querySelector('.vn-count').textContent = entry.time == null ? '入场提示' : '当前回放中的对话'
    this.closeButton.textContent = this.mode === 'intro' ? '跳过引导' : '收起'
    this.fullText = entry.text; this.line.textContent = ''; this.cursor = 0
    this.characters = Array.from(entry.text)
    this.next.textContent = '显示全文'
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || this.mode === 'history') this.reveal()
    else {
      this.timer = setInterval(() => {
        this.cursor += 2
        this.line.textContent = this.characters.slice(0, this.cursor).join('')
        if (this.cursor >= this.characters.length) this.reveal()
      }, 45)
    }
  }

  reveal () {
    clearInterval(this.timer); this.line.textContent = this.fullText; this.cursor = this.characters?.length || 0
    this.next.textContent = this.index < this.lines.length - 1 ? '下一句' : this.mode === 'intro' ? '开始动手' : '收起对话'
  }

  advance () {
    if (this.cursor < this.characters.length) { this.reveal(); return }
    if (this.index < this.lines.length - 1) { this.index++; this.showLine(); return }
    if (this.mode === 'intro') this.rememberIntro()
    this.hide(); this.toggle.focus()
  }

  hide () {
    clearInterval(this.timer); this.shell.hidden = true; this.toggle.hidden = !!this.guideActive
    this.toggle.setAttribute('aria-expanded', 'false'); this.mode = null
  }

  update (hero, world) {
    const now = world.age || 0
    const guards = (this.design.gates || []).map(g => world.getThangByID(g.id))
    const lines = replayLines(this.design, hero, guards, now)
    const rewound = now < (this.lastTime || 0)
    this.lastTime = now
    // Rebuild from the displayed replay frame, never from the simulated final world.
    this.history = lines
    const latest = lines[lines.length - 1]
    const key = latest?.key || ''
    if (key === this.lastKey && !rewound) return
    this.lastKey = key
    if (rewound || !latest) {
      if (this.mode && this.mode !== 'intro') this.hide()
      return
    }
    if (this.ready && !this.guideActive && !this.muted && now - latest.time < 8) {
      this.rememberIntro(); this.open([latest], 'runtime')
    }
  }

  destroy () {
    clearInterval(this.timer)
    Backbone.Mediator.unsubscribe('level:loading-view-unveiled', this.onReady, this)
    window.removeEventListener('resize', this.onResize)
    this.surface.off?.('resize', this.onResize, this)
    this.shell.removeEventListener('keydown', this.onKey)
    this.shell.remove(); this.toggle.remove()
  }
}
