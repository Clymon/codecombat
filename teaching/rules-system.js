/* global System, TeachingAdventure, TeachingLearning */
// Original local map rules. Rendered walls and these bounds share one source.
class TeachingRules extends System {
  start () {
    const hero = this.world.getThangByID('Hero Placeholder')
    this.installSpeech(hero)
    this.installSensors(hero)
    if (hero && this.learningContract && !this.learning) this.learning = new TeachingLearning(this, hero, this.learningContract)
    if (hero && this.adventureConfig) this.adventure = new TeachingAdventure(this, hero)
    // Native idle/move completion may call unblock while our custom attack/wait
    // is still running. Keep its Future alive until the custom action finishes.
    if (hero?.unblock) {
      const nativeUnblock = hero.unblock; const rules = this
      hero.unblock = function (...args) {
        if ((this.currentPlan?.methodName === 'attack' && rules.adventure?.swing) || (this.currentPlan?.methodName === 'wait' && this.teachingWaitUntil != null)) return
        return nativeUnblock.apply(this, args)
      }
    }
  }

  fail (hero, message) {
    if (this.failed) return
    this.failed = true
    hero.teachingFailure = message
    this.world.goalManager.setGoalState('stay-safe', 'failure')
    hero.plansDisabled = true
    hero.setAction?.('idle')
    this.world.endWorld?.(false, 0.8, true)
  }

  guardPosition (time) {
    const g = this.guard
    if (!g) return null
    const offset = g.amplitude * Math.sin(time * g.speed + (g.phase || 0))
    return { x: g.x + (g.axis === 'y' ? 0 : offset), y: g.y + (g.axis === 'y' ? offset : 0) }
  }

  nextSafe (hero) {
    // Use the same patrol function and radius as collision and replay rendering.
    // Conservatively require the whole next square to remain clear for 1.8 s.
    for (let t = 0; t <= 1.8; t += 0.025) {
      const guard = this.guardPosition(this.world.age + t)
      for (let d = 0; d <= 12; d += 0.5) {
        const x = hero.pos.x + d; const y = hero.pos.y
        if (guard && Math.hypot(x - guard.x, y - guard.y) < this.guard.radius + 1) return false
        if ((this.hazards || []).some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 3)) return false
      }
    }
    return true
  }

  installSensors (hero) {
    if (!hero || hero.teachingSensorsInstalled) return
    hero.teachingSensorsInstalled = true
    if (hero.snapPoints?.length) hero.stopOnSnapArrival = true
    const rules = this
    const expose = (name, fn) => {
      hero[name] = fn
      hero.apiProperties = (hero.apiProperties || []).filter(p => p !== name)
      hero.apiOwnMethods = Array.from(new Set([...(hero.apiOwnMethods || []), name]))
    }
    expose('pathOpen', direction => {
      if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('方向请用带引号的 "left"、"right"、"up" 或 "down"。')
      return rules.sensor?.open?.[direction] === true
    })
    expose('pathLength', () => rules.sensor?.length || 0)
    expose('readSignal', () => rules.sensor?.signal || 0)
    expose('atBeacon', () => Math.hypot(hero.pos.x - rules.exit[0], hero.pos.y - rules.exit[1]) < 1)
    expose('nextTileSafe', () => rules.nextSafe(hero))
    expose('press', number => {
      const next = (rules.switches || [])[rules.pressedCount || 0]
      if (!next || number !== next.number || Math.hypot(hero.pos.x - next.at[0], hero.pos.y - next.at[1]) > 1) {
        rules.fail(hero, '开关没按对：石板没有回应。站到对应编号上，按顺序再试。')
        return false
      }
      rules.pressedCount = (rules.pressedCount || 0) + 1
      hero.teachingPressedCount = rules.pressedCount
      if (rules.pressedCount === rules.switches.length) rules.world.goalManager.setGoalState('press-switches', 'success')
      return true
    })
    expose('wait', function () {
      if (this.teachingWaitUntil == null) this.teachingWaitUntil = this.world.age + 0.5
      this.setAction?.('idle')
      if (this.world.age >= this.teachingWaitUntil) { this.teachingWaitUntil = null; return 'done' }
    })
    hero.plannifyMethod?.('wait')
    for (const name of ['moveRight', 'moveLeft', 'moveUp', 'moveDown', 'wait']) {
      const original = hero[name]
      if (typeof original !== 'function') continue
      hero[name] = function (...args) {
        if (!this.currentPlan) {
          rules.actionCount = (rules.actionCount || 0) + 1
          if (rules.actionCount > (rules.maxActions || 30)) {
            rules.fail(this, '循环超过安全次数：检查 while 的条件是否会变成 False，以及循环内是否更新了变量。')
            return 'done'
          }
          if (rules.singleStep && name !== 'wait' && args[0] != null && args[0] !== 1) {
            rules.fail(this, '本关每次只能走一格。把重复移动写进循环，不要用步数参数代替循环。')
            return 'done'
          }
        }
        if (!this.currentPlan) {
          const interception = rules.interceptGate(this, name, args)
          if (interception?.stop) return 'done'
          if (interception?.args) args = interception.args
        }
        return original.apply(this, args)
      }
    }
    hero.addTrackedProperties?.(['teachingPressedCount', 'number'])
    hero.teachingPressedCount = 0
    hero.keepTrackedProperty?.('teachingPressedCount')
  }

  gateReply (gate, message, status) {
    const guard = this.world.getThangByID(gate.id)
    if (!guard) return
    if (!guard.teachingGateTracked) {
      guard.teachingGateTracked = true
      guard.addTrackedProperties?.(['teachingGateMessage', 'string'], ['teachingGateStatus', 'string'], ['teachingGateMessageAt', 'number'])
      for (const property of ['teachingGateMessage', 'teachingGateStatus', 'teachingGateMessageAt']) guard.keepTrackedProperty?.(property)
    }
    guard.teachingGateMessage = message
    guard.teachingGateMessageAt = this.world.age
    guard.teachingGateStatus = status
  }

  stopAtPost (hero, gate) {
    const message = gate.locked ? '此路关闭，请走开放的路线。' : '站住！没有口令，不能过去。'
    this.gateReply(gate, message, 'blocked')
    hero.setTargetPos?.(null)
    hero.intent = undefined
    if (hero.velocity) { hero.velocity.x = 0; hero.velocity.y = 0 }
    this.fail(hero, gate.locked ? '守卫拦住了这条路：检查条件和移动方向。' : '守卫挡住了去路。走到他面前交谈，再修改程序试一次。')
  }

  interceptGate (hero, name, args) {
    if (name === 'wait') return null
    const vectors = { moveRight: [1, 0], moveLeft: [-1, 0], moveUp: [0, 1], moveDown: [0, -1] }
    const v = vectors[name]; const steps = args[0] ?? 1
    if (!v || typeof steps !== 'number') return null
    const dx = v[0] * steps * 12; const dy = v[1] * steps * 12; const length2 = dx * dx + dy * dy
    if (!length2) return null
    for (const gate of this.gates || []) {
      if (gate.openedAt != null) continue
      const gx = gate.at[0] - hero.pos.x; const gy = gate.at[1] - hero.pos.y; const t = (gx * dx + gy * dy) / length2
      if (t <= 0 || t > 1.01 || Math.hypot(gx - dx * t, gy - dy * t) > 3) continue
      const distance = Math.hypot(hero.pos.x - gate.approach[0], hero.pos.y - gate.approach[1])
      if (distance < 2) { this.stopAtPost(hero, gate); return { stop: true } }
      const ax = gate.approach[0] - hero.pos.x; const ay = gate.approach[1] - hero.pos.y
      const along = (ax * v[0] + ay * v[1]) / 12
      if (along > 0 && Math.abs(ax * v[1] - ay * v[0]) < 2) {
        hero.teachingPendingPost = gate
        return { args: [along] }
      }
    }
    return null
  }

  installSpeech (hero) {
    if (!hero || hero.teachingSpeechInstalled || typeof hero.say !== 'function') return
    hero.teachingSpeechInstalled = true
    hero.addTrackedProperties?.(['teachingSpeechLog', 'string'])
    hero.teachingSpeechLog = '[]'
    hero.keepTrackedProperty?.('teachingSpeechLog')
    const rules = this
    const originalSay = hero.say
    hero.say = function (...args) {
      if (typeof args[0] === 'boolean') args[0] = args[0] ? 'True' : 'False'
      const newMessage = !this.currentPlan && args[0] != null
      const result = originalSay.apply(this, args)
      if (newMessage) {
        const messages = JSON.parse(this.teachingSpeechLog || '[]')
        const event = { time: this.world.age, text: String(this.sayMessage ?? args[0]), x: this.pos.x, y: this.pos.y }
        messages.push(event)
        rules.receiveSpeech(event, this)
        this.teachingSpeechLog = JSON.stringify(messages.slice(-4))
      }
      return result
    }
  }

  receiveSpeech (event, hero) {
    this.adventure?.hear(event)
    this.spoken = (this.spoken || []).concat(event.text)
    const gates = this.gates || []
    const nearby = gates.find(g => Math.hypot(event.x - g.approach[0], event.y - g.approach[1]) < 2)
    if (!nearby) {
      if (gates.some(g => !g.locked)) hero.teachingFailure = '离守卫太远了，他没有听见。'
      return
    }
    if (nearby.locked || nearby.openedAt != null) return
    if (['你好', '口令', '口令是什么', '请问口令'].includes(event.text)) {
      this.gateReply(nearby, `你是来送信的吧？\n暗号是“${nearby.password}”。`, 'waiting')
      hero.teachingFailure = ''
      return
    }
    if (event.text !== nearby.password) {
      this.gateReply(nearby, '口令不对，不能通行。', 'rejected')
      hero.teachingFailure = '守卫摇了摇头。可以先打个招呼，或查看任务日志中的信件。'
      return
    }
    this.gateReply(nearby, '口令正确，请通行。', 'opening')
    nearby.openedAt = event.time
    hero.teachingFailure = ''
  }

  faceToward (guard, target) {
    const dx = target.x - guard.pos.x; const dy = target.y - guard.pos.y
    if (Math.hypot(dx, dy) < 0.1) return
    const desired = Math.atan2(dy, dx)
    const current = Number.isFinite(guard.rotation) ? guard.rotation : desired
    const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current))
    const step = 8 * (this.world.dt || 0.05)
    guard.rotation = current + Math.max(-step, Math.min(step, delta))
    guard.keepTrackedProperty?.('rotation')
  }

  updateGates (hero) {
    for (const gate of this.gates || []) {
      const guard = this.world.getThangByID(gate.id)
      if (!guard) continue
      if (!guard.teachingGateStatus) this.gateReply(gate, '', 'waiting')
      if ((!gate.locked || gate.greeting) && !gate.greeted && gate.openedAt == null && guard.teachingGateStatus === 'waiting' && Math.hypot(hero.pos.x - gate.approach[0], hero.pos.y - gate.approach[1]) < 2) {
        gate.greeted = true
        this.gateReply(gate, gate.greeting || '站住，来者何人？请报口令。', 'waiting')
      }
      const amount = gate.openedAt == null ? 0 : Math.min(1, Math.max(0, (this.world.age - gate.openedAt) / 1.0))
      guard.pos.x = gate.at[0] + (gate.aside[0] - gate.at[0]) * amount
      guard.pos.y = gate.at[1] + (gate.aside[1] - gate.at[1]) * amount
      guard.action = amount > 0 && amount < 1 ? 'move' : 'idle'
      // Face visitors while talking and step aside without turning our back on them.
      const nearby = Math.hypot(hero.pos.x - guard.pos.x, hero.pos.y - guard.pos.y) <= 26
      this.faceToward(guard, nearby ? hero.pos : { x: gate.approach[0], y: gate.approach[1] })
      guard.keepTrackedProperty?.('action')
      guard.hasMoved = true
      if (amount === 1) guard.teachingGateStatus = 'open'
      if (amount === 1 && !gate.locked) this.world.goalManager.setGoalState(`gate-${gate.id}`, 'success')
      if (amount < 1 && Math.hypot(hero.pos.x - guard.pos.x, hero.pos.y - guard.pos.y) < 4) {
        hero.pos.x = gate.approach[0]; hero.pos.y = gate.approach[1]
        this.stopAtPost(hero, gate)
      }
    }
  }

  updateDeparture (hero) {
    const elapsed = this.world.age - hero.teachingExitStartedAt
    const walking = this.exitStyle === 'stairs' && elapsed >= 0 && elapsed < this.exitDuration
    hero.setAction?.(walking ? 'move' : 'idle')
    if (walking) {
      const direction = this.exitDirection || [1, 0]
      hero.rotation = Math.atan2(direction[1], direction[0])
      hero.keepTrackedProperty?.('rotation')
    }
    hero.keepTrackedProperty?.('action')
    if (elapsed >= this.exitDuration && !this.safetyDone) {
      this.safetyDone = true
      this.world.goalManager.setGoalState('reach-exit', 'success')
      this.world.goalManager.setGoalState('stay-safe', 'success')
    }
    return hero.pos.x + hero.pos.y
  }

  recordHeroVisual (hero) {
    if (!hero) return
    if (!hero.teachingVisualInstalled) {
      hero.teachingVisualInstalled = true
      hero.addTrackedProperties?.(['teachingVisual', 'string'])
      hero.keepTrackedProperty?.('teachingVisual')
    }
    const now = this.world.age
    const previous = this.heroVisual || {}
    const moving = previous.pos && Math.hypot(hero.pos.x - previous.pos.x, hero.pos.y - previous.pos.y) > 0.001
    const departing = hero.teachingExitStartedAt >= 0 && now >= hero.teachingExitStartedAt
    const action = hero.health <= 0 ? 'die' : this.adventure?.swing?.started != null ? 'attack' : moving || (departing && hero.action === 'move') ? 'move' : 'idle'
    const swingAt = action === 'attack' ? this.adventure.swing.started : null
    const state = {
      action,
      since: action === 'attack' ? swingAt : action === previous.action ? previous.since : now,
      hurtAt: previous.health != null && hero.health < previous.health ? now : previous.hurtAt,
      diedAt: hero.health <= 0 ? (previous.diedAt ?? now) : null,
    }
    this.heroVisual = { ...state, health: hero.health, pos: { x: hero.pos.x, y: hero.pos.y } }
    hero.teachingVisual = JSON.stringify(state)
  }

  update () {
    try { return this.updateRules() } finally { this.recordHeroVisual(this.world.getThangByID('Hero Placeholder')) }
  }

  updateRules () {
    const hero = this.world.getThangByID('Hero Placeholder')
    if (!hero || !this.world.goalManager) return 0
    this.installSpeech(hero)
    this.installSensors(hero)
    if (hero && this.learningContract && !this.learning) this.learning = new TeachingLearning(this, hero, this.learningContract)
    if (!this.initialized) {
      this.initialized = true
      this.checkpointCount = 0
      for (let i = 0; i < (this.checkpoints || []).length; i++) this.world.goalManager.setGoalState(`checkpoint-${i + 1}`, 'incomplete')
      if (this.exit) this.world.goalManager.setGoalState('reach-exit', 'incomplete')
      hero.addTrackedProperties?.(['teachingCheckpointCount', 'number'], ['teachingExitReady', 'boolean'], ['teachingFailure', 'string'], ['teachingExitOpenedAt', 'number'], ['teachingExitStartedAt', 'number'])
      hero.teachingCheckpointCount = 0
      hero.teachingExitReady = false
      hero.teachingExitOpenedAt = -1
      hero.teachingExitStartedAt = -1
      hero.teachingFailure = hero.teachingFailure || ''
      for (const key of ['teachingCheckpointCount', 'teachingExitReady', 'teachingFailure', 'teachingExitOpenedAt', 'teachingExitStartedAt']) hero.keepTrackedProperty?.(key)
    }
    if (hero.teachingExitStartedAt >= 0) return this.updateDeparture(hero)
    this.adventure?.update()
    if (this.adventure && (this.failed || this.adventureConfig.mode === 'defend')) return hero.pos.x + hero.pos.y
    this.updateGates(hero)
    if (hero.teachingPendingPost && Math.hypot(hero.pos.x - hero.teachingPendingPost.approach[0], hero.pos.y - hero.teachingPendingPost.approach[1]) < 1.8) {
      const post = hero.teachingPendingPost
      hero.teachingPendingPost = null
      this.stopAtPost(hero, post)
    }
    const patrol = this.guard
    const guard = patrol && this.world.getThangByID(patrol.id)
    if (guard) {
      const position = this.guardPosition(this.world.age)
      guard.pos.x = position.x
      guard.pos.y = position.y
      guard.action = 'move'
      const forward = Math.cos(this.world.age * patrol.speed + (patrol.phase || 0)) >= 0
      const direction = forward ? 1 : -1
      this.faceToward(guard, { x: position.x + (patrol.axis === 'y' ? 0 : direction), y: position.y + (patrol.axis === 'y' ? direction : 0) })
      guard.keepTrackedProperty?.('action')
      guard.hasMoved = true
    }
    if (this.world.age > 36 && !hero.plansAreFinished) this.fail(hero, '运行时间超过36秒：检查停止条件；等待后要重新检测。')
    if (this.expectedSpeech && JSON.stringify(this.spoken || []) === JSON.stringify(this.expectedSpeech)) this.world.goalManager.setGoalState('show-values', 'success')
    const target = hero.targetPos
    const remaining = target ? Math.hypot(target.x - hero.pos.x, target.y - hero.pos.y) : 0
    const travelled = this.previousPos ? Math.hypot(hero.pos.x - this.previousPos.x, hero.pos.y - this.previousPos.y) : Infinity
    this.blockedFor = remaining > 2 && travelled < 0.002 ? (this.blockedFor || 0) + (this.world.dt || 0.05) : 0
    this.previousPos = { x: hero.pos.x, y: hero.pos.y }
    if (!this.failed) {
      const b = this.bounds || { x1: 0, y1: 0, x2: 72, y2: 56 }
      const outside = hero.pos.x < b.x1 || hero.pos.x > b.x2 || hero.pos.y < b.y1 || hero.pos.y > b.y2
      // A small body radius detects wall contact, rather than an invisible trap.
      const touchesWall = (this.walls || []).some(w => Math.abs(hero.pos.x - w.x) < w.halfWidth + 0.9 && Math.abs(hero.pos.y - w.y) < w.halfHeight + 0.9)
      const spotted = guard && Math.hypot(hero.pos.x - guard.pos.x, hero.pos.y - guard.pos.y) < patrol.radius
      const spikes = (this.hazards || []).some(([x, y]) => Math.hypot(hero.pos.x - x, hero.pos.y - y) < 3)
      if (!this.adventure && (outside || touchesWall || spotted || spikes || this.blockedFor > 0.5)) {
        if (spikes) hero.health = 0
        hero.teachingFailure = spikes ? '碰到尖刺了：换一条路线，再运行。' : spotted ? '进入守卫红圈了：从安全走廊绕行。' : (this.singleStep ? '已经走到墙边：检查循环次数或 while 中减少变量的那一行。' : '前面是石墙：修改移动方向，再运行。')
        this.failed = true
        this.world.goalManager.setGoalState('stay-safe', 'failure')
        hero.plansDisabled = true
        hero.setAction?.('idle')
        this.world.endWorld?.(false, 0.8, true)
      } else {
        const checkpoints = this.checkpoints || []
        const point = checkpoints[this.checkpointCount]
        if (point && Math.hypot(hero.pos.x - point[0], hero.pos.y - point[1]) < 2) {
          this.world.goalManager.setGoalState(`checkpoint-${++this.checkpointCount}`, 'success')
          hero.teachingCheckpointCount = this.checkpointCount
        }
        const extraReady = (!(this.switches || []).length || this.world.goalManager.getGoalState('press-switches') === 'success') && (!this.expectedSpeech || JSON.stringify(this.spoken || []) === JSON.stringify(this.expectedSpeech))
        const ready = (!this.adventure || this.adventure.ready()) && extraReady && this.checkpointCount === checkpoints.length && (this.noGems || this.world.goalManager.getGoalState('collect-parcels') === 'success') && (this.gates || []).every(g => g.locked || this.world.goalManager.getGoalState(`gate-${g.id}`) === 'success')
        if (ready && !hero.teachingExitReady) hero.teachingExitOpenedAt = this.world.age
        if (!ready) hero.teachingExitOpenedAt = -1
        hero.teachingExitReady = ready
        const atExit = this.exit && Math.hypot(hero.pos.x - this.exit[0], hero.pos.y - this.exit[1]) < 2 && remaining < 1
        if (atExit && !ready && !hero.teachingFailure) hero.teachingFailure = this.adventure ? '出口的封印还没有解除。查看左上角尚未完成的目标。' : '出口的封印还没有解除。看看有没有没亮的石板或遗落的宝石。'
        if (ready && hero.teachingFailure?.startsWith('出口的封印')) hero.teachingFailure = ''
        if (ready && atExit && (!this.requireFinished || hero.plansAreFinished)) {
          if (this.learning && !this.learning.accept()) return
          if (this.exitDuration > 0) {
            // Let the grille finish opening, then play the departure before awarding success.
            hero.teachingExitStartedAt = Math.max(this.world.age, hero.teachingExitOpenedAt + 0.7)
            return this.updateDeparture(hero)
          }
          this.world.goalManager.setGoalState('reach-exit', 'success')
        }
        if (!this.safetyDone && ready && (!this.exit || this.world.goalManager.getGoalState('reach-exit') === 'success')) {
          this.safetyDone = true
          this.world.goalManager.setGoalState('stay-safe', 'success')
        }
      }
    }
    return hero.pos.x + hero.pos.y + (guard ? guard.pos.x : 0)
  }
}
// The engine evaluates this script and uses its final expression as the system class.
// eslint-disable-next-line no-unused-expressions
TeachingRules
