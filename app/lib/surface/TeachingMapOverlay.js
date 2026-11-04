// Read-only map annotations for our original local teaching levels.
// All positions use the native CodeCombat camera and replay world state.
const createjs = require('lib/createjs-parts')
const { visibleSpeech, MAX_VISIBLE } = require('teaching/speech-stack')
const { drawDungeonDevices } = require('teaching/dungeon-devices')
const { drawAdventure } = require('teaching/adventure-view')
const { exitPose } = require('teaching/exit-effects')
const { attachGuide } = require('teaching/tutorial-guide')
const { applyHeroFrame } = require('teaching/hero-animation')
const WhaleCompanion = require('./WhaleCompanion')
module.exports = class TeachingMapOverlay {
  constructor (surface, design) {
    this.surface = surface
    surface.zoomToHero = false
    this.design = design
    this.companion = design.world?.chapterId === 'starter-village' ? new WhaleCompanion(surface, design) : null
    const root = document.getElementById('level-view')
    root?.classList.add('local-teaching-level')
    if (!document.getElementById('teaching-layout-style')) {
      const style = document.createElement('style')
      style.id = 'teaching-layout-style'
      style.textContent = '.teaching-mentor{display:flex;gap:10px;align-items:center;border-bottom:1px solid #65737b;padding:8px 0}.teaching-mentor img{width:64px;height:80px;object-fit:contain}.teaching-mentor strong{font-size:13px;color:#e8cd96}.teaching-mentor p{font-size:14px} #level-view.local-teaching-level{overflow:clip!important} #level-view.local-teaching-level #goals-view{top:52px!important;left:8px!important;transform:none!important;max-width:300px;font-size:14px} #teaching-task[open]{max-height:calc(100vh - 280px);overflow-y:auto} #teaching-task pre{font-size:13px;line-height:1.5;background:#101d25;color:#fff1c7;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #596668} #teaching-task h4{color:#ffe2a3} #teaching-task .guide-observe{color:#b9dacd;font-size:13px} #teaching-task .teaching-code-rule{color:#ffe2a3;font-weight:bold} #teaching-task{position:absolute;left:12px;top:218px;z-index:8;max-width:310px;background:#182730ed;color:#f8edda;border:1px solid #ad9870;border-radius:8px;padding:10px 14px;font-size:15px;line-height:1.65} #teaching-task summary{cursor:pointer;font-weight:bold} #teaching-task p{margin:8px 0} #teaching-task details{border-top:1px solid #65737b;padding-top:6px} #teaching-task a{color:#a4e8d4}'
      document.head.appendChild(style)
    }
    root?.querySelector('#teaching-task')?.remove()
    const task = document.createElement('details')
    task.id = 'teaching-task'
    const title = document.createElement('summary'); title.textContent = '任务日志 · 提示'
    task.appendChild(title)
    const scene = document.createElement('p'); scene.textContent = `${design.prototype ? '互动样关' : `${design.world?.chapterName || '新手村'} · ${design.world?.area || `第 ${design.section || 1} 小节`}`} · ${design.knowledge || '顺序与移动'} · ${design.scenarioTitles?.[design.scenarioIndex || 0] || '主场景'}`; task.appendChild(scene)
    const quest = document.createElement('p'); quest.textContent = design.quest || design.description; task.appendChild(quest)
    const instructions = document.createElement('details'); const heading = document.createElement('summary'); const description = document.createElement('p')
    heading.textContent = '编程要求与验收'; description.textContent = design.description; instructions.append(heading, description); task.appendChild(instructions)
    for (const [index, hint] of (design.hints || [design.tip]).entries()) {
      const detail = document.createElement('details'); const summary = document.createElement('summary'); const text = document.createElement('p')
      summary.textContent = `提示 ${index + 1}`; text.textContent = hint; detail.append(summary, text); task.appendChild(detail)
    }
    const back = document.createElement('a'); back.href = `/teaching#${design.slug || ''}`; back.textContent = '选择其他关卡或场景'; task.appendChild(back)
    this.updateGuide = attachGuide(task, design)
    root?.appendChild(task)

    this.container = new createjs.Container()
    this.container.mouseEnabled = false
    this.container.mouseChildren = false
    // A cached canvas is supported by StageGL and sits between floor and walls/actors.
    // The normal canvas is always above the hero, so ground props must not live there.
    this.floorInk = new createjs.Shape()
    this.floorInk.mouseEnabled = false
    this.ink = new createjs.Shape()
    this.container.addChild(this.ink)
    // Only inscriptions carrying game data remain in the world; instructions live in the journal.
    this.labels = (design.inscriptions || []).map(label => {
      const box = new createjs.Shape()
      const text = new createjs.Text(label.text, 'bold 14px Georgia', '#e2cca0')
      text.textAlign = 'center'; text.textBaseline = 'middle'
      this.container.addChild(box, text)
      return { ...label, box, text }
    })
    this.switchNumbers = (design.switches || []).map(sw => {
      const text = new createjs.Text(String(sw.number), 'bold 15px Georgia', '#d7c79f')
      text.textAlign = 'center'; text.textBaseline = 'middle'; this.container.addChild(text)
      return { sw, text }
    })
    this.gateReplies = (design.gates || []).map(gate => {
      const box = new createjs.Shape()
      const text = new createjs.Text('', 'bold 16px Arial', '#fff7df')
      text.textAlign = 'center'; text.textBaseline = 'middle'; text.lineWidth = 220; text.lineHeight = 22
      this.container.addChild(box, text)
      return { gate, box, text }
    })
    this.message = new createjs.Text('', 'bold 16px Arial', '#ffe2d1')
    this.message.textAlign = 'center'
    this.container.addChild(this.message)
    this.speech = Array.from({ length: MAX_VISIBLE }, () => {
      const holder = new createjs.Container()
      const box = new createjs.Shape()
      const line = new createjs.Text('', 'bold 15px Arial', '#fff9e9')
      line.textAlign = 'center'
      line.textBaseline = 'middle'
      line.lineWidth = 220
      line.lineHeight = 19
      holder.addChild(box, line)
      holder.visible = false
      this.container.addChild(holder)
      return { holder, box, line }
    })
    this.adventureLabels = Array.from({ length: 24 }, () => {
      const text = new createjs.Text('', 'bold 14px Arial', '#fff0cf')
      text.textAlign = 'center'; text.visible = false; this.container.addChild(text); return text
    })
    surface.webGLStage.setClearColor('#181613')
    surface.normalStage.addChild(this.container)
  }

  update () {
    const { camera, world } = this.surface
    this.surface.zoomToHero = false
    if (this.lastWorld !== world) {
      this.lastWorld = world
      let width = (this.design.size[0] + 12) * (this.design.tutorial ? 1.32 : 1)
      let height = this.design.size[1] + 12
      const aspect = camera.canvasWidth * camera.y2x / camera.canvasHeight
      if (width / height > aspect) height = width / aspect
      else width = height * aspect
      const cx = this.design.size[0] / 2 - (this.design.tutorial ? width * 0.12 : 0); const cy = this.design.size[1] / 2
      camera.setBounds([{ x: cx - width / 2, y: cy - height / 2 }, { x: cx + width / 2, y: cy + height / 2 }])
      camera.zoomTo(camera.worldToSurface({ x: cx, y: cy }), camera.canvasWidth / (width * 10), 0)
    }
    const g = this.ink.graphics.clear()
    const hero = world.getThangByID('Hero Placeholder')
    this.updateGuide?.(hero)
    this.message.text = hero?.teachingFailure || ''
    this.message.x = camera.canvasWidth / 2
    const normalCanvas = this.surface.normalCanvas?.[0]
    const canvasTop = normalCanvas?.getBoundingClientRect().top || 0
    const taskPanel = document.getElementById('teaching-task')
    const messageLeft = taskPanel?.open ? Math.max(0, taskPanel.getBoundingClientRect().right - (normalCanvas?.getBoundingClientRect().left || 0)) + 18 : 0
    this.message.x = messageLeft + (camera.canvasWidth - messageLeft) / 2
    this.message.lineWidth = Math.max(180, Math.min(1000, camera.canvasWidth - messageLeft - 70))
    this.message.lineHeight = 22
    this.message.y = Math.min(camera.canvasHeight, window.innerHeight - canvasTop) - 56
    this.updateSpeech(hero, world.age, camera)
    this.updateGateReplies(world, camera)
    for (const label of this.labels) {
      const p = camera.worldToCanvas(label); const w = label.text.getMeasuredWidth() + 18
      label.text.x = p.x; label.text.y = p.y
      label.box.graphics.clear().setStrokeStyle(2).beginStroke('#756953').beginFill('#39382f')
        .drawRect(p.x - w / 2, p.y - 12, w, 24).endFill().endStroke()
    }
    if (this.design.world?.heroId === 'deepseek') applyHeroFrame(this.surface.lankBoss.lanks['Hero Placeholder'], hero, world.age)
    this.updateDeparture(hero, world, camera)
    this.companion?.update(hero, world, camera)
    const floorGraphics = this.floorInk.graphics.clear()
    if (this.design.adventure?.mode !== 'defend') drawDungeonDevices(floorGraphics, this.design, hero, world, camera, g)
    const labels = drawAdventure(g, floorGraphics, this.design, hero, world, camera, this.surface)
    this.adventureLabels.forEach((text, i) => { text.visible = !!labels[i]; if (labels[i]) Object.assign(text, labels[i]) })
    const stage = this.surface.webGLStage; const obstacles = this.surface.lankBoss.layerAdapters.Obstacle.container
    if (this.floorInk.parent !== stage) stage.addChildAt(this.floorInk, stage.getChildIndex(obstacles))
    this.floorInk.scaleX = camera.canvasScaleFactorX
    this.floorInk.scaleY = camera.canvasScaleFactorY
    const width = Math.ceil(camera.canvasWidth); const height = Math.ceil(camera.canvasHeight)
    if (this.floorWidth !== width || this.floorHeight !== height) {
      this.floorInk.cache(0, 0, width, height)
      this.floorWidth = width; this.floorHeight = height
    } else this.floorInk.updateCache()
    for (const { sw, text } of this.switchNumbers) {
      const p = camera.worldToCanvas({ x: sw.at[0], y: sw.at[1] })
      text.x = p.x; text.y = p.y + 3
    }
    const patrol = this.design.guard
    const guard = patrol && world.getThangByID(patrol.id)
    if (!guard || !guard.pos) return
    const p = camera.worldToCanvas(guard.pos)
    const ground = camera.worldToCanvas({ x: guard.pos.x, y: guard.pos.y })
    const rx = patrol.radius * 10 * camera.zoom
    const ry = rx * camera.y2x
    g.setStrokeStyle(2).beginStroke('#ff786a').beginFill('rgba(242,77,59,0.15)')
      .drawEllipse(ground.x - rx, ground.y - ry, rx * 2, ry * 2).endFill().endStroke()
    // The patrol is visible through its movement and danger radius, not a drawn solution path.
    g.beginFill('#ff786a').drawCircle(p.x, p.y - 32, 4)
  }

  updateDeparture (hero, world, camera) {
    const lank = this.surface.lankBoss.lanks['Hero Placeholder']
    if (!lank?.sprite || !hero?.pos) return
    const pose = exitPose(this.design, hero.teachingExitStartedAt, world.age)
    if (!pose.active && !this.departureWasActive) return
    // Reset from the replay frame each tick; replaying backwards restores the whole hero.
    lank.lastPos = null
    lank.updatePosition(); lank.updateScale(true); lank.updateAlpha()
    const anchor = lank.getWorldPosition(); const from = camera.worldToSurface(anchor)
    const to = camera.worldToSurface({ x: anchor.x + pose.dx, y: anchor.y + pose.dy, z: anchor.z - pose.sink })
    lank.sprite.x += to.x - from.x; lank.sprite.y += to.y - from.y
    lank.sprite.scaleX *= pose.scale; lank.sprite.scaleY *= pose.scale; lank.sprite.alpha *= pose.alpha
    for (const mark of Object.values(lank.marks || {})) mark.updateAlpha((hero.alpha ?? 1) * pose.alpha)
    for (const mark of [this.surface.lankBoss.selectionMark, this.surface.lankBoss.targetMark]) if (mark?.lank === lank) mark.updateAlpha(pose.active ? 0 : 1)
    if (lank.healthBar) lank.healthBar.alpha = pose.active ? 0 : (hero.alpha ?? 1)
    this.departureWasActive = pose.active
  }

  updateGateReplies (world, camera) {
    for (const reply of this.gateReplies) {
      const guard = world.getThangByID(reply.gate.id)
      const state = guard?.teachingGateStatus || 'waiting'
      const open = state === 'open'
      const message = guard?.teachingGateMessage || ''
      reply.text.visible = reply.box.visible = !!message
      if (!message || !guard?.pos) continue
      const p = camera.worldToCanvas(guard.pos)
      const width = 238; const height = 58; const left = Math.max(8, Math.min(p.x + 18, camera.canvasWidth - width - 12)); const top = Math.max(12, p.y - 132)
      const lines = message.split('\n').flatMap(part => Array.from(part).reduce((rows, char, i) => { if (!rows.length || (rows[rows.length - 1].length >= 13 && !/[，。！？、；：）]/.test(char))) rows.push(''); rows[rows.length - 1] += char; return rows }, []))
      reply.text.text = lines.join('\n'); reply.text.x = left + width / 2; reply.text.y = top + (height - (lines.length - 1) * 22) / 2
      const color = open || state === 'opening' ? '#a2edbb' : state === 'waiting' ? '#efd296' : '#ffae9d'
      reply.box.graphics.clear().setStrokeStyle(2).beginStroke(color).beginFill('rgba(25,40,48,0.96)')
        .moveTo(left + 9, top).lineTo(left + width - 9, top).quadraticCurveTo(left + width, top, left + width, top + 9)
        .lineTo(left + width, top + height - 9).quadraticCurveTo(left + width, top + height, left + width - 9, top + height)
        .lineTo(left + 34, top + height).lineTo(left + 15, top + height + 11).lineTo(left + 18, top + height)
        .lineTo(left + 9, top + height).quadraticCurveTo(left, top + height, left, top + height - 9)
        .lineTo(left, top + 9).quadraticCurveTo(left, top, left + 9, top).closePath()
    }
  }

  updateSpeech (hero, age, camera) {
    const { world, currentFrame } = this.surface
    const atEnd = currentFrame >= (world?.frames?.length || 1) - 1
    if (atEnd) {
      if (this.endWorld !== world || this.endFrame !== currentFrame || !this.endAt) {
        this.endWorld = world
        this.endFrame = currentFrame
        this.endAt = Date.now()
      }
      age += (Date.now() - this.endAt) / 1000
    } else {
      this.endAt = null
    }
    const messages = visibleSpeech(hero?.teachingSpeechLog, age)
    for (const speech of this.speech) speech.holder.visible = false
    if (!messages.length || !hero?.pos) return
    const p = camera.worldToCanvas(hero.pos)
    const canvas = this.surface.normalCanvas?.[0]
    const rect = canvas?.getBoundingClientRect()
    const visibleBottom = rect ? Math.min(camera.canvasHeight, window.innerHeight - rect.top) : camera.canvasHeight
    const heights = messages.map(item => {
      const codePoints = Array.from(item.text)
      return codePoints.length > 48 ? `${codePoints.slice(0, 47).join('')}…` : item.text
    })
    const bubbleHeight = 47
    // The complete stack stays above the hero's head, including each short tip.
    const bottom = Math.min(p.y - 80, visibleBottom - 12)
    const left = p.x + 20
    messages.forEach((item, index) => {
      const speech = this.speech[index]
      const y = bottom - (messages.length - index - 0.5) * bubbleHeight
      speech.holder.visible = true
      speech.holder.alpha = item.alpha
      speech.holder.x = left
      speech.holder.y = y
      speech.line.text = heights[index]
      const width = Math.max(94, Math.min(252, speech.line.getMeasuredWidth() + 28))
      speech.line.x = width / 2
      speech.line.y = 0
      // One continuous outline leaves no seam across the base of the tip.
      speech.box.graphics.clear().setStrokeStyle(2)
        .beginStroke(index === messages.length - 1 ? '#ffe69b' : '#b9d7e7')
        .beginFill('rgba(23,35,45,0.94)')
        .moveTo(9, -21).lineTo(width - 9, -21)
        .quadraticCurveTo(width, -21, width, -12)
        .lineTo(width, 12).quadraticCurveTo(width, 21, width - 9, 21)
        .lineTo(34, 21).lineTo(15, 32).lineTo(18, 21)
        .lineTo(9, 21).quadraticCurveTo(0, 21, 0, 12)
        .lineTo(0, -12).quadraticCurveTo(0, -21, 9, -21)
        .closePath()
    })
  }
}
