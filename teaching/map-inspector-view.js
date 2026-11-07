const { mapObjects, describeObject, hitObject } = require('./map-inspection')
module.exports = class MapInspector {
  constructor (root, design, surface) {
    this.root = root; this.design = design; this.surface = surface; this.selected = 'environment'
    if (!document.getElementById('map-inspector-style')) {
      const style = document.createElement('style'); style.id = 'map-inspector-style'
      style.textContent = '.map-inspector-toggle{position:fixed;z-index:9;background:#203740;color:#cce8df;border:1px solid #8caa9f;border-radius:5px;padding:6px 10px;font-size:13px}.map-inspector{position:fixed;z-index:15;box-sizing:border-box;width:320px;max-width:calc(100vw - 24px);overflow:auto;background:#17282ff5;color:#f3ead7;border:1px solid #a49067;border-radius:9px;padding:12px;box-shadow:0 8px 26px #0008;font-size:14px;line-height:1.5}.map-inspector[hidden]{display:none}.map-inspector header{display:flex;align-items:center;justify-content:space-between;gap:10px}.map-inspector h3{margin:0;font-size:18px;color:#ffe2a3}.map-inspector p{margin:8px 0}.map-inspector select{display:block;width:100%;background:#253c42;color:#f7efdc;border:1px solid #718b86;padding:6px;margin:10px 0}.map-inspector button{background:#2a464d;color:#d5f3e7;border:1px solid #7ba697;border-radius:4px;padding:5px 8px}.map-inspector .mi-tabs{display:flex;gap:6px;margin:8px 0}.map-inspector article{border-top:1px solid #60736c;margin-top:10px;padding-top:10px}.map-inspector pre{background:#0d1a21;border:1px solid #516b67;color:#d9f8e8;padding:9px;font-size:13px;white-space:pre-wrap;word-break:break-word;margin:7px 0}.map-inspector .mi-kind{font-weight:bold;color:#b8d8d9;font-size:12px}.map-inspector .mi-status{color:#ffe29b}.map-inspector .mi-note{color:#b1c5bd;font-size:12px}.map-inspector details{font-size:12px;color:#d1dace;margin:8px 0}.deepseek-guiding .map-inspector,.deepseek-guiding .map-inspector-toggle{display:none!important}'
      document.head.append(style)
    }
    this.toggle = document.createElement('button'); this.toggle.className = 'map-inspector-toggle'; this.toggle.textContent = '点地图看用法'; this.toggle.type = 'button'; this.toggle.setAttribute('aria-expanded', 'false')
    this.panel = document.createElement('section'); this.panel.className = 'map-inspector'; this.panel.hidden = true; this.panel.setAttribute('aria-label', '地图对象与命令'); this.panel.setAttribute('role', 'dialog')
    this.panel.innerHTML = '<header><h3>对象用法</h3><button type="button" class="mi-close" aria-label="关闭对象说明">关闭</button></header><div class="mi-tabs"><button type="button" data-target="environment">全局函数</button><button type="button" data-target="hero">英雄命令</button></div><select aria-label="选择地图对象"></select><div class="mi-content"></div><p class="mi-note">点击只查看帮助。距离按当前画面显示，程序运行到对应语句时检查位置。</p>'
    this.select = this.panel.querySelector('select'); this.content = this.panel.querySelector('.mi-content')
    this.toggle.onclick = () => this.panel.hidden ? this.open('environment') : this.close()
    this.panel.querySelector('.mi-close').onclick = () => this.close()
    this.panel.querySelectorAll('[data-target]').forEach(button => { button.onclick = () => this.open(button.dataset.target) })
    this.select.onchange = () => this.open(this.select.value)
    root.append(this.toggle, this.panel)
    this.onDown = e => { this.down = { x: e.clientX, y: e.clientY } }
    this.onClick = e => {
      if (!this.ready || document.body.classList.contains('deepseek-guiding') || e.target.tagName !== 'CANVAS') return
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return
      const rect = surface.normalCanvas?.[0]?.getBoundingClientRect()
      if (!rect?.width || e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return
      const x = (e.clientX - rect.left) * surface.camera.canvasWidth / rect.width; const y = (e.clientY - rect.top) * surface.camera.canvasHeight / rect.height
      const object = hitObject(this.objects || [], x, y, surface.camera)
      if (object) { e.preventDefault(); e.stopPropagation(); this.open(object.id) }
    }
    this.onKey = e => { if (e.key === 'Escape' && !this.panel.hidden) { this.close(); e.stopPropagation() } }
    root.addEventListener('pointerdown', this.onDown, true); root.addEventListener('click', this.onClick, true); this.panel.addEventListener('keydown', this.onKey)
    this.onRun = () => this.close(false)
    Backbone.Mediator.subscribe('tome:manual-cast', this.onRun, this)
  }

  open (id) { this.selected = id; this.panel.hidden = false; this.toggle.setAttribute('aria-expanded', 'true'); this.render(); this.select.focus({ preventScroll: true }) }
  close (focus = true) { this.panel.hidden = true; this.toggle.setAttribute('aria-expanded', 'false'); if (focus) this.toggle.focus({ preventScroll: true }) }

  update (hero, world, floor) {
    this.hero = hero; this.world = world; this.objects = mapObjects(this.design, hero, world)
    const rect = this.surface.normalCanvas?.[0]?.getBoundingClientRect(); if (!rect?.width) return
    const loader = document.getElementById('level-loading-view'); this.ready = !loader || (loader.classList.contains('unveiled') && !loader.classList.contains('preview-screen'))
    this.toggle.hidden = !this.ready
    this.toggle.style.left = `${Math.max(rect.left + 8, rect.right - 135)}px`; this.toggle.style.top = `${rect.top + 126}px`
    this.panel.style.left = `${Math.max(12, Math.min(rect.right - 332, window.innerWidth - 332))}px`; this.panel.style.top = `${Math.max(12, rect.top + 166)}px`; this.panel.style.maxHeight = `${Math.max(160, Math.min(rect.bottom - rect.top - 185, window.innerHeight - rect.top - 180))}px`
    if (this.panel.hidden) return
    this.render()
    const object = this.objects.find(o => o.id === this.selected)
    if (!object || object.kind === 'environment') return
    const { camera } = this.surface; const z = 10 * camera.zoom
    for (const [at, color] of [[object.at, '#f4d681'], ...(object.approach ? [[object.approach, '#9ce7e0']] : [])]) {
      const p = camera.worldToCanvas({ x: at[0], y: at[1] }); const r = 4.5 * z
      floor.setStrokeStyle(2).beginStroke(color).drawEllipse(p.x - r, p.y - r * camera.y2x, r * 2, r * 2 * camera.y2x).endStroke()
    }
  }

  render () {
    if (!this.objects || this.panel.hidden) return
    const listKey = JSON.stringify(this.objects.map(o => [o.id, o.name]))
    if (listKey !== this.listKey) {
      this.listKey = listKey; this.select.replaceChildren()
      for (const o of this.objects) { const option = document.createElement('option'); option.value = o.id; option.textContent = o.name; this.select.append(option) }
    }
    const object = this.objects.find(o => o.id === this.selected)
    if (!object) { this.selected = 'environment'; return this.render() }
    this.select.value = this.selected
    const info = describeObject(object, this.design, this.hero, this.world); const key = JSON.stringify(info)
    if (key === this.infoKey) return
    this.infoKey = key; this.content.replaceChildren(); this.panel.querySelector('h3').textContent = info.name
    const text = document.createElement('p'); text.textContent = info.text; this.content.append(text)
    for (const card of info.cards) {
      const article = document.createElement('article'); const kind = document.createElement('span'); kind.className = 'mi-kind'
      kind.textContent = { global: '全局函数', hero: '英雄动作 / 感知', nearby: '近距离交互', target: '指定目标交互' }[card.scope]
      const code = document.createElement('pre'); code.textContent = card.code
      const condition = document.createElement('p'); condition.textContent = card.condition
      const status = document.createElement('p'); status.className = 'mi-status'; status.textContent = card.status
      const insert = document.createElement('button'); insert.type = 'button'; insert.textContent = '插入代码'; insert.onclick = () => this.insertCode(card.code)
      const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '完整说明'; const body = document.createElement('p'); body.textContent = card.description.replace(/[*`]/g, '') + (card.returns ? '\n返回值：' + card.returns : ''); details.append(summary, body)
      article.append(kind, code, condition, status, insert, details); this.content.append(article)
    }
  }

  insertCode (code) {
    const editor = this.root.querySelector('.ace.coco-view')?.env?.editor
    if (!editor) return
    const cursor = editor.getCursorPosition(); const line = editor.session.getLine(cursor.row); const indent = line.match(/^\s*/)[0]
    if (line.trim()) { editor.moveCursorTo(cursor.row, line.length); editor.insert('\n' + indent + code) } else { editor.moveCursorTo(cursor.row, line.length); editor.insert(code) }
    this.close(false); editor.focus()
  }

  destroy () {
    this.root.removeEventListener('pointerdown', this.onDown, true); this.root.removeEventListener('click', this.onClick, true); this.panel.removeEventListener('keydown', this.onKey)
    Backbone.Mediator.unsubscribe('tome:manual-cast', this.onRun, this)
    this.panel.remove(); this.toggle.remove()
  }
}
