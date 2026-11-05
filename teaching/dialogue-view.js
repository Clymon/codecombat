const { portraits, introFor, replayLines } = require('./dialogue-content')
const { storyLine, storyEvents, StoryMemory } = require('./story-dialogue')

module.exports = class VillageDialogue {
  constructor (root, design, surface, options = {}) {
    this.root = root; this.design = design; this.surface = surface
    this.storyEnabled = options.story === true
    let storage
    try { storage = sessionStorage } catch (_) {}
    this.story = new StoryMemory(design, storage)
    this.entry = storyLine(design, 'entry', null)
    this.introPending = this.storyEnabled && !this.story.has(this.entry)
    this.intro = introFor(design); this.history = []; this.mode = null; this.index = 0
    this.seenKey = `village-dialogue-v1:${design.slug || design.index}`
    this.shell = document.createElement('section'); this.shell.className = 'village-dialogue'; this.shell.hidden = true
    this.shell.setAttribute('aria-label', '人物对话')
    this.shell.innerHTML = '<img class="vn-portrait vn-hero" alt="DeepSeek立绘"><img class="vn-portrait vn-partner" alt="" hidden><div class="vn-box"><div class="vn-heading"><strong class="vn-name"></strong><span class="vn-role"></span><button class="vn-close" type="button">收起</button></div><p class="vn-line"></p><div class="vn-footer"><span class="vn-count"></span><button class="vn-next" type="button">继续</button></div></div>'
    this.toggle = document.createElement('button'); this.toggle.className = 'vn-toggle'; this.toggle.type = 'button'; this.toggle.textContent = '人物对话'
    this.toggle.setAttribute('aria-expanded', 'false')
    root.append(this.shell, this.toggle)
    this.heroImage = this.shell.querySelector('.vn-hero'); this.heroImage.src = portraits.hero.image
    this.partnerImage = this.shell.querySelector('.vn-partner'); this.line = this.shell.querySelector('.vn-line')
    this.next = this.shell.querySelector('.vn-next'); this.closeButton = this.shell.querySelector('.vn-close')
    this.next.onclick = () => this.advance()
    this.line.onclick = () => this.reveal()
    this.closeButton.onclick = () => { this.muted = !['intro', 'story'].includes(this.mode); this.hide(); this.rememberIntro(); this.toggle.focus() }
    this.toggle.onclick = () => {
      if (!this.shell.hidden) { this.hide(); return }
      this.muted = false
      this.open([...this.story.shown, ...this.intro, ...this.history], 'history')
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
      this.entryTimer = setTimeout(() => this.showEntry(), 0)
    }
    this.onRun = () => {
      // Running is an explicit handoff to the student's code. Never replay the greeting.
      this.cancelEntry(); this.storyPlaybackMuted = false; this.hide()
    }
    this.onScrub = () => {
      // Native level startup also resets the timeline before the loader opens.
      if (!this.ready || this.guideActive) return
      this.cancelEntry(); this.storyPlaybackMuted = true; this.hide()
    }
    Backbone.Mediator.subscribe('tome:manual-cast', this.onRun, this)
    Backbone.Mediator.subscribe('level:set-time', this.onScrub, this)
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
    if (!active) this.showEntry()
  }

  cancelEntry () {
    clearTimeout(this.entryTimer)
    if (this.introPending) this.story.remember(this.entry, false)
    this.introPending = false
  }

  showEntry () {
    if (!this.introPending || !this.ready || this.guideActive || this.muted || this.storyPlaybackMuted) return
    this.introPending = false
    this.showStory(this.entry)
  }

  showStory (line) {
    if (this.story.has(line)) return false
    this.story.remember(line)
    this.open([line], 'story')
    return true
  }

  rememberIntro () {
    try { sessionStorage.setItem(this.seenKey, 'seen') } catch (_) {}
  }

  layout () {
    const canvas = this.surface.normalCanvas?.[0]?.getBoundingClientRect()
    if (!canvas) return
    const playback = document.getElementById('playback-view')?.getBoundingClientRect()
    const bottom = playback?.height ? Math.min(canvas.bottom, playback.top) : canvas.bottom
    const height = Math.min(210, (bottom - (canvas.top || 0)) * 0.48)
    this.shell.style.left = `${canvas.left}px`
    this.shell.style.top = `${bottom - height}px`
    this.shell.style.width = `${canvas.width}px`
    this.shell.style.height = `${height}px`
    this.shell.style.setProperty('--vn-portrait-width', `${Math.max(82, Math.min(166, canvas.width * 0.18))}px`)
    this.toggle.style.left = `${Math.max(canvas.left + 8, canvas.left + canvas.width - 220)}px`
    this.toggle.style.top = `${(canvas.top || 0) + 88}px`
  }

  open (lines, mode) {
    if (!lines.length) return
    this.lines = lines; this.mode = mode; this.index = 0
    this.shell.hidden = false; this.toggle.hidden = true; this.toggle.setAttribute('aria-expanded', 'true')
    this.onVisibilityChange?.(true)
    this.layout(); this.showLine()
  }

  showLine () {
    clearInterval(this.timer); clearTimeout(this.dismissTimer)
    const entry = this.lines[this.index]; const actor = portraits[entry.speaker]
    const partner = entry.speaker !== 'hero' ? entry.speaker : entry.partner
    const other = portraits[partner]
    this.partnerImage.hidden = !other
    this.shell.dataset.paired = String(!!other)
    this.shell.dataset.side = entry.speaker === 'hero' ? 'left' : 'right'
    this.heroImage.classList.toggle('is-speaking', entry.speaker === 'hero')
    this.partnerImage.classList.toggle('is-speaking', entry.speaker !== 'hero')
    if (other) {
      this.partnerImage.src = other.image; this.partnerImage.alt = `${other.name}立绘`
      this.partnerImage.dataset.character = partner
    } else {
      this.partnerImage.removeAttribute('src'); this.partnerImage.alt = ''
      delete this.partnerImage.dataset.character
    }
    this.shell.dataset.speaker = entry.speaker
    this.shell.dataset.kind = entry.source === 'story' ? entry.kind : ''
    this.shell.querySelector('.vn-name').textContent = actor.name
    this.shell.querySelector('.vn-role').textContent = entry.source === 'story' ? '随行碎碎念' : entry.speaker === 'hero' ? '你的代码发言' : actor.role
    this.shell.querySelector('.vn-count').textContent = entry.source === 'story' ? `${entry.label} · ${this.mode === 'history' ? '对话回顾' : '稍后自动收起'}` : entry.time == null ? '入场提示' : '当前回放中的对话'
    this.closeButton.textContent = this.mode === 'intro' ? '跳过引导' : '收起'
    this.currentEntry = entry
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
    if (this.mode === 'story') {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = setTimeout(() => this.hide(), Math.max(5000, Math.min(8500, this.characters.length * 160)))
    }
  }

  advance () {
    if (this.cursor < this.characters.length) { this.reveal(); return }
    if (this.index < this.lines.length - 1) { this.index++; this.showLine(); return }
    if (this.mode === 'intro') this.rememberIntro()
    this.hide(); this.toggle.focus()
  }

  hide () {
    clearInterval(this.timer); clearTimeout(this.dismissTimer); this.shell.hidden = true; this.toggle.hidden = !!this.guideActive
    this.toggle.setAttribute('aria-expanded', 'false'); this.mode = null
    this.onVisibilityChange?.(false)
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
    const changed = key !== this.lastKey
    this.lastKey = key
    if (rewound) { this.hide(); return }
    if (!this.ready || this.guideActive || this.muted) return
    if (this.storyEnabled && !this.storyPlaybackMuted) {
      const events = storyEvents(this.design, hero, guards, now)
      const fresh = events.find(line => !this.story.has(line) && now - line.time < 2)
      if (fresh && (this.mode !== 'story' || fresh.kind === 'complete' || (this.currentEntry?.kind === 'entry' && ['wall', 'gate', 'door', 'spikes', 'hurt', 'down'].includes(fresh.kind)))) {
        this.cancelEntry(); this.showStory(fresh); return
      }
    }
    if (this.mode === 'story') return
    if (!latest) { if (this.mode === 'runtime') this.hide(); return }
    if (changed && now - latest.time < 8) {
      this.rememberIntro(); this.open([latest], 'runtime')
    }
  }

  destroy () {
    clearInterval(this.timer); clearTimeout(this.dismissTimer); clearTimeout(this.entryTimer)
    Backbone.Mediator.unsubscribe('tome:manual-cast', this.onRun, this)
    Backbone.Mediator.unsubscribe('level:set-time', this.onScrub, this)
    Backbone.Mediator.unsubscribe('level:loading-view-unveiled', this.onReady, this)
    window.removeEventListener('resize', this.onResize)
    this.surface.off?.('resize', this.onResize, this)
    this.shell.removeEventListener('keydown', this.onKey)
    this.shell.remove(); this.toggle.remove()
  }
}
