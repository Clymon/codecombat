const CabinDrafts = require('./lesson-drafts')
// Classroom controls overlay the native game; the editor remains available for saving.
module.exports = class LessonGame {
  constructor (root, design, surface, guide) {
    this.root = root; this.design = design; this.surface = surface; this.guide = guide; this.closedHints = new Set(); this.disposed = false
    this.slug = design.slug || `local-python-${String(design.index).padStart(2, '0')}`
    this.shell = document.createElement('section'); this.shell.className = 'lesson-game-bar'; this.shell.hidden = true
    this.shell.innerHTML = '<span class="lesson-game-status"></span><button class="lesson-reopen" hidden>重看教师提示</button><div class="lesson-hint" hidden><strong>老师给你的提示</strong><p></p><pre hidden></pre><button>我已查看</button></div><div class="lesson-spot" hidden></div>'
    this.call = document.createElement('aside'); this.call.className = 'lesson-cabin-call'; this.call.hidden = true
    this.call.setAttribute('role', 'status')
    this.call.innerHTML = '<img src="/teaching/assets/characters/deepseek.png" alt="DeepSeek"><div><strong>DeepSeek</strong><p></p><button>回小屋</button></div>'
    root.appendChild(this.call)
    this.call.querySelector('button').onclick = () => this.leave()
    root.appendChild(this.shell)
    this.style = document.createElement('style'); this.style.textContent = 'body.lesson-classroom .ds-guide-toggle{display:none!important}body.lesson-cabin-active .village-dialogue,body.lesson-cabin-active .vn-toggle{display:none!important}.lesson-cabin-call{position:fixed;z-index:1400;bottom:80px;left:24px;display:flex;align-items:center;gap:16px;max-width:min(480px,85vw);background:#243c36f5;border:2px solid #d7b77a;padding:14px 20px;color:#f6e7c4;box-shadow:0 10px 40px #0007;font:15px/1.6 sans-serif}.lesson-cabin-call[hidden]{display:none}.lesson-cabin-call img{width:74px;height:100px;object-fit:contain}.lesson-cabin-call strong{color:#ecc784}.lesson-cabin-call p{margin:5px 0 12px}.lesson-cabin-call button{background:#476752;border:1px solid #d7b77a;color:#fff0cf;padding:8px 14px;border-radius:4px}.lesson-game-bar{display:contents;font:14px/1.5 sans-serif}.lesson-game-bar[hidden]{display:none}.lesson-game-status{position:fixed;z-index:1300;left:20px;bottom:100px;max-width:min(420px,45vw);padding:10px;background:#193c39f2;color:#fff0ce;border:1px solid #c5a66a;border-radius:8px}.lesson-game-status:empty{display:none}.lesson-reopen{position:fixed;right:24px;top:68px;z-index:1300}.lesson-restore{position:fixed;right:24px;bottom:140px;z-index:1300}.lesson-game-bar button{margin:0 5px;padding:5px 9px;background:#35564c;color:#fff;border:1px solid #a08d62;border-radius:4px}.lesson-hint{position:fixed;top:54px;right:0;width:min(420px,85vw);background:#263b36;padding:16px;border:2px solid #edc981;border-radius:8px;box-shadow:0 12px 30px #0008}.lesson-hint pre{white-space:pre-wrap;color:#fff;background:#152b2b;padding:10px}.lesson-spot{position:fixed;border:3px solid #ffce73;border-radius:10px;pointer-events:none;box-shadow:0 0 15px #ffd27a}.lesson-game-bar [hidden]{display:none!important}body.lesson-frozen #cast-button-view .cast-button,body.lesson-frozen #cast-button-view .submit-button{opacity:.4;pointer-events:none}'
    document.head.appendChild(this.style)
    this.shell.querySelector('.lesson-reopen').onclick = () => this.showHint(this.latestHint)
    this.shell.querySelector('.lesson-hint button').onclick = async () => {
      const h = this.latestHint; if (!h) return
      try { await this.post('/teaching/room/ack', { hintId: h.id, kind: 'seen' }); this.closedHints.add(h.id); this.hideHint() } catch (e) { this.status(e.message) }
    }
    this.onRun = () => this.hideHint()
    this.onProblem = e => {
      if (!this.state || this.state.status !== 'live') return
      const problem = e.problem || e.problems?.[0]
      const message = problem?.message || problem?.get?.('message') || ''
      if (message && message !== this.lastError) { this.lastError = message; this.post('/teaching/room/error', { message }).catch(() => {}) }
    }
    this.onClick = e => {
      if (e.target.closest('a.levels-link,#teaching-task > a')) { e.preventDefault(); e.stopImmediatePropagation(); this.leave(); return }
      if (window.teachingClassroomPaused && e.target.closest('.cast-button,.submit-button,#continue-button')) { e.preventDefault(); e.stopImmediatePropagation(); this.status('老师正在讲解，请稍后运行或提交。') }
    }
    document.addEventListener('click', this.onClick, true)
    Backbone.Mediator.subscribe('tome:manual-cast', this.onRun, this)
    Backbone.Mediator.subscribe('tome:problems-updated', this.onProblem, this)
    Backbone.Mediator.subscribe('god:user-code-problem', this.onProblem, this)
    fetch(`/db/level/${this.slug}/session`).then(r => r.ok ? r.json() : null).then(s => { this.sessionId = s?._id }).catch(() => {})
    this.returnToCabin = () => this.leave()
    window.teachingReturnToCabin = this.returnToCabin
    this.restoreButton = document.createElement('button'); this.restoreButton.className = 'lesson-restore'; this.restoreButton.hidden = true; this.restoreButton.textContent = '恢复上次未保存的草稿'
    this.shell.appendChild(this.restoreButton)
    this.restoreButton.onclick = () => {
      const draft = CabinDrafts.read(window, this.state?.studentId, this.slug)
      const editor = document.querySelector('#code-area .ace_editor')?.env?.editor
      if (!draft || !editor) return
      editor.setValue(draft.code, -1); this.restoreButton.hidden = true; this.draftOffered = true
      this.status('本地草稿已恢复到编辑器，请检查后再运行。')
    }
    this.poll()
  }

  status (message) { this.shell.querySelector('.lesson-game-status').textContent = message }
  async post (url, data) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, roomId: this.state.id, formToken: this.state.formToken }) })
    if (!response.ok) throw new Error('操作尚未保存，请检查连接后重试。')
    return response.json()
  }

  freeze (paused) {
    if (paused && !this.frozen) {
      this.wasPlaying = this.surface.playing
      window.teachingClassroomPaused = true
      Backbone.Mediator.publish('level:set-playing', { playing: false })
    } else if (!paused && this.frozen) {
      window.teachingClassroomPaused = false
      if (this.wasPlaying) Backbone.Mediator.publish('level:set-playing', { playing: true })
    }
    this.frozen = paused
    document.body.classList.toggle('lesson-frozen', paused)
  }

  async poll () {
    try {
      const response = await fetch('/teaching/room/state', { cache: 'no-store' })
      if (!response.ok) throw new Error('课堂连接中断，现场已暂停。连接恢复后会同步老师安排。')
      const state = await response.json()
      if (this.disposed) return
      this.state = state
      if (!this.draftOffered) this.restoreButton.hidden = !CabinDrafts.read(window, state.studentId, this.slug)
      const active = state.status === 'live'
      document.body.classList.toggle('lesson-classroom', active)
      const mapLink = document.querySelector('a.levels-link .home-text'); if (mapLink) { mapLink.removeAttribute('data-i18n'); mapLink.textContent = '回小屋' }
      this.shell.hidden = !active && !this.everActive && this.restoreButton.hidden
      if (active) {
        this.everActive = true
        const home = document.querySelector('a.levels-link .home-text'); if (home) { home.removeAttribute('data-i18n'); home.textContent = '回小屋' }
        this.guide?.close(false, false)
        if (this.guide?.toggle) this.guide.toggle.hidden = true
        const assigned = state.task?.slug === this.slug
        this.freeze(state.paused || state.gathered || !assigned)
        this.call.hidden = !state.gathered && !state.offeredTask && assigned
        this.call.querySelector('p').textContent = state.gathered ? '老师叫我们回小屋集合啦。先把代码保存好，我陪你回去。' : '老师送来了新任务。先保存代码，回小屋看看任务板，再一起出发。'
        this.status(state.gathered ? '小屋集合 · 游戏已暂停，代码可以继续编辑' : !assigned ? '老师已安排新任务。先保存，再返回本节课。' : state.paused ? '一起看这里 · 游戏已暂停，代码仍可编辑保存' : '')
        const hint = state.hints.at(-1)
        if (hint) {
          if (!hint.deliveredAt) await this.post('/teaching/room/ack', { hintId: hint.id, kind: 'delivered' })
          this.latestHint = hint; this.shell.querySelector('.lesson-reopen').hidden = false
          if (!hint.seenAt && !this.closedHints.has(hint.id) && this.shownHint !== hint.id) this.showHint(hint)
        }
      } else if (this.everActive) { this.freeze(true); this.status('本节课已结束，保存代码后回小屋。'); this.call.hidden = false; this.call.querySelector('p').textContent = '今天辛苦啦，炉火还暖着。把代码保存好，一起回家吧。' } else this.freeze(false)
      document.body.classList.toggle('lesson-cabin-active', !this.call.hidden)
    } catch (error) {
      if (!this.disposed && (this.everActive || this.design.classroomTask)) { this.shell.hidden = false; this.freeze(true); this.status(error.message) }
    }
    if (!this.disposed) this.timer = setTimeout(() => this.poll(), 1000)
  }

  showHint (hint) {
    if (!hint) return
    this.shownHint = hint.id
    const box = this.shell.querySelector('.lesson-hint'); box.hidden = false
    box.querySelector('p').textContent = hint.text; box.querySelector('pre').textContent = hint.code; box.querySelector('pre').hidden = !hint.code
    const target = hint.target === 'tag' ? this.design.sensor?.tag?.at : null
    const spot = this.shell.querySelector('.lesson-spot'); const bar = this.shell.getBoundingClientRect()
    let r
    if (target) {
      const canvas = this.surface.normalCanvas[0].getBoundingClientRect(); const camera = this.surface.camera; const p = camera.worldToCanvas({ x: target[0], y: target[1] })
      r = { left: canvas.left + p.x * canvas.width / camera.canvasWidth - 75, top: canvas.top + p.y * canvas.height / camera.canvasHeight - 60, width: 150, height: 100 }
    } else {
      const editor = document.querySelector('#code-area .ace_editor')
      r = editor?.getBoundingClientRect()
      const ace = editor?.env?.editor
      if (ace) { const line = ace.getValue().split('\n').findIndex(text => text.includes('label')); if (line >= 0) ace.gotoLine(line + 1, 0, false) }
    }
    spot.hidden = !r
    if (r) Object.assign(spot.style, { left: `${r.left - bar.left}px`, top: `${r.top - bar.top}px`, width: `${r.width}px`, height: `${r.height}px` })
  }

  hideHint () { this.shell.querySelector('.lesson-hint').hidden = true; this.shell.querySelector('.lesson-spot').hidden = true }
  async leave () {
    if (this.leaving) return
    this.leaving = true
    this.call.querySelector('button').disabled = true
    const editor = document.querySelector('#code-area .ace_editor')?.env?.editor
    const code = editor?.getValue()
    const draft = typeof code === 'string' ? CabinDrafts.save(window, this.state?.studentId, this.slug, code) : null
    let outcome = typeof code === 'string' ? (draft ? 'local-draft' : 'unsaved') : 'editor-unavailable'
    const controller = new AbortController(); let timer
    try {
      if (typeof code !== 'string' || !this.sessionId) throw new Error('会话或编辑器暂不可用')
      const saved = await Promise.race([
        fetch(`/db/level.session/${this.sessionId}`, { method: 'PUT', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: { 'hero-placeholder': { plan: code } }, codeLanguage: 'python' }) }),
        new Promise((resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('保存超时')) }, 2000) }),
      ])
      if (saved.ok) { outcome = 'saved'; CabinDrafts.remove(window, this.state?.studentId, this.slug, draft?.savedAt) }
    } catch (_) {
      // A stale session or an unavailable server must not gate classroom navigation.
    } finally {
      clearTimeout(timer)
      window.location.assign('/teaching/room?return=' + outcome)
    }
  }

  destroy () {
    this.disposed = true; clearTimeout(this.timer); this.freeze(false)
    document.removeEventListener('click', this.onClick, true)
    Backbone.Mediator.unsubscribe('tome:manual-cast', this.onRun, this)
    Backbone.Mediator.unsubscribe('tome:problems-updated', this.onProblem, this)
    Backbone.Mediator.unsubscribe('god:user-code-problem', this.onProblem, this)
    if (window.teachingReturnToCabin === this.returnToCabin) delete window.teachingReturnToCabin
    document.body.classList.remove('lesson-cabin-active', 'lesson-classroom')
    this.shell.remove(); this.call.remove(); this.style.remove()
  }
}
