// Self-contained so the same class runs in the simulation worker and Node tests.
module.exports = class TeachingAdventure {
  constructor (rules, hero) {
    this.rules = rules
    this.world = rules.world
    this.hero = hero
    this.config = rules.adventureConfig
    this.events = []
    this.projectiles = []
    const adventure = this; const nativeLocomote = hero.locomote
    if (nativeLocomote) hero.locomote = function (...args) { return adventure.swing ? this.velocity.copy().multiply(0) : nativeLocomote.apply(this, args) }
    this.actors = this.config.actors.map(spec => ({ ...spec, hp: spec.health, active: !spec.spawnAt, alive: true, alerted: false, lit: false, thang: this.world.getThangByID(spec.id) }))
    this.camp = this.config.camp ? { ...this.config.camp, hp: this.config.camp.health } : null
    hero.maxHealth = hero.health = 100
    hero.addActions?.({ name: 'attack', cooldown: 0.65 })
    hero.addTrackedProperties?.(['teachingAdventure', 'string'])
    hero.keepTrackedProperty?.('teachingAdventure')
    for (const actor of this.actors) {
      const t = actor.thang
      if (!t) throw new Error(`Missing adventure actor: ${actor.id}`)
      t.health = t.maxHealth = actor.health
      t.apiProperties = Array.from(new Set([...(t.apiProperties || []), 'id', 'health', 'maxHealth', 'pos']))
      t.addTrackedProperties?.(['alpha', 'number'])
      for (const key of ['pos', 'health', 'rotation', 'action', 'alpha']) t.keepTrackedProperty?.(key)
      if (actor.kind === 'signal') t.alpha = 0
      else t.alpha = actor.active ? 1 : 0
    }
    const expose = (name, fn, blocking = false) => {
      hero[name] = fn
      hero.apiProperties = (hero.apiProperties || []).filter(p => p !== name)
      hero.apiOwnMethods = Array.from(new Set([...(hero.apiOwnMethods || []), name]))
      if (blocking) hero.plannifyMethod?.(name)
    }
    if (['rescue', 'defend'].includes(this.config.mode)) {
      expose('findNearestEnemy', () => this.nearest(hero.pos)?.thang || null)
      expose('attack', target => this.attack(target), true)
    }
    if (this.config.mode === 'defend') expose('isVictory', () => this.complete === true)
    this.snapshot()
  }

  distance (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }
  point (at) { return { x: at[0], y: at[1] } }
  aliveEnemies () { return this.actors.filter(a => a.kind === 'enemy' && a.active && a.alive) }
  nearest (pos, range = 60) {
    return this.aliveEnemies().filter(a => this.distance(pos, a.thang.pos) <= range && this.clear(pos, a.thang.pos))
      .sort((a, b) => this.distance(pos, a.thang.pos) - this.distance(pos, b.thang.pos))[0]
  }

  walkable (p, ignoreDoor = false) {
    const b = this.rules.bounds
    if (p.x < b.x1 + 1 || p.x > b.x2 - 1 || p.y < b.y1 + 1 || p.y > b.y2 - 1) return false
    if (this.rules.walls.some(w => Math.abs(p.x - w.x) < w.halfWidth + 0.8 && Math.abs(p.y - w.y) < w.halfHeight + 0.8)) return false
    return ignoreDoor || !this.actors.some(a => a.kind === 'door' && a.alive && this.distance(p, a.thang.pos) < 3)
  }

  clear (from, to, ignoreDoor = false) {
    const n = Math.max(1, Math.ceil(this.distance(from, to)))
    for (let i = 1; i < n; i++) {
      if (!this.walkable({ x: from.x + (to.x - from.x) * i / n, y: from.y + (to.y - from.y) * i / n }, ignoreDoor)) return false
    }
    return true
  }

  route (from, to) {
    const snap = p => [Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3]
    const start = snap(from); const goal = snap(to); const key = p => p.join(',')
    const queue = [start]; const parents = new Map([[key(start), null]])
    let found
    for (let cursor = 0; cursor < queue.length && cursor < 2000; cursor++) {
      const p = queue[cursor]
      if (Math.hypot(p[0] - goal[0], p[1] - goal[1]) < 3.1) { found = p; break }
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
        const next = [p[0] + dx, p[1] + dy]
        if (parents.has(key(next)) || !this.walkable(this.point(next))) continue
        parents.set(key(next), p); queue.push(next)
      }
    }
    if (!found) return []
    const result = []
    for (let p = found; parents.get(key(p)); p = parents.get(key(p))) result.unshift(this.point(p))
    if (this.distance(from, this.point(start)) > 0.06 && this.walkable(this.point(start))) result.unshift(this.point(start))
    return result
  }

  move (t, destination, speed, stop = 0) {
    const remaining = this.distance(t.pos, destination)
    if (remaining <= stop + 0.05 || !speed) { this.action(t, 'idle'); return }
    let target = destination
    if (!this.clear(t.pos, destination)) {
      const key = `${t.id}:${Math.round(destination.x / 3)},${Math.round(destination.y / 3)}`
      this.paths ||= new Map()
      let cached = this.paths.get(key)
      if (!cached || this.world.age - cached.at > 0.4) { cached = { at: this.world.age, points: this.route(t.pos, destination) }; this.paths.set(key, cached) }
      while (cached.points.length && this.distance(t.pos, cached.points[0]) < 0.06) cached.points.shift()
      target = cached.points[0]
      if (!target) { this.action(t, 'idle'); return }
    }
    const length = this.distance(t.pos, target)
    const step = Math.min(speed * (this.world.dt || 0.05), length, Math.max(0, remaining - stop))
    const next = { x: t.pos.x + (target.x - t.pos.x) / (length || 1) * step, y: t.pos.y + (target.y - t.pos.y) / (length || 1) * step }
    if (!this.walkable(next)) return
    this.rules.faceToward(t, target)
    t.pos.x = next.x; t.pos.y = next.y
    t.hasMoved = true
    if (t.velocity) { t.velocity.x = 0; t.velocity.y = 0 }
    this.action(t, 'move')
  }

  action (t, action) {
    t.action = action
    t.keepTrackedProperty?.('action')
  }

  event (kind, from, to, amount = 0) {
    this.events.push({ kind, at: this.world.age, from: [from.x, from.y], to: [to.x, to.y], amount })
  }

  hurt (target, amount, source, cause = 'hit') {
    if (this.rules.failed || this.complete) return
    const t = target === this.hero ? target : target.thang
    const pos = t?.pos || this.point(target.at)
    if (target === this.hero) target.health = Math.max(0, target.health - amount)
    else target.hp = Math.max(0, target.hp - amount)
    if (target !== this.hero && t) t.health = target.hp
    this.event(cause, source, pos, amount)
    const health = target === this.hero ? target.health : target.hp
    if (health > 0) return
    if (target === this.hero) {
      this.rules.fail(this.hero, cause === 'trap' ? '英雄踩中了尖刺，重新选择安全路线。' : '英雄倒下了。观察是谁造成伤害，调整路线或攻击顺序后重试。')
      this.action(this.hero, 'die')
    } else if (target === this.camp) this.rules.fail(this.hero, '营火被敌人摧毁了。要反复寻找并处理新出现的敌人。')
    else {
      target.alive = false; target.diedAt = this.world.age; target.killedBy = cause
      this.action(t, 'die'); t.target = null
      this.event(target.kind === 'door' ? 'break' : 'fall', pos, pos)
      if (target.kind === 'ally') this.rules.fail(this.hero, '弓箭手倒下了。先清除威胁，再带她离开。')
    }
  }

  attack (input) {
    const h = this.hero
    if (this.rules.failed || this.complete) return 'done'
    if (!this.swing) {
      const id = typeof input === 'string' ? input : input?.id
      const target = this.actors.find(a => a.id === id)
      if (!id) { this.rules.fail(h, '没有攻击目标。先寻找敌人，用 if 确认有目标，再 attack(enemy)。'); return 'done' }
      if (!target) { this.rules.fail(h, `找不到“${id}”。检查对象名字、引号和大小写。`); return 'done' }
      if (!['enemy', 'door'].includes(target.kind)) { this.rules.fail(h, '这是友方或信号台，不能攻击。'); return 'done' }
      if (!target.active || !target.alive) { this.rules.fail(h, '这个目标已经不在战场上了。把寻找敌人的语句放进循环，每轮重新寻找。'); return 'done' }
      this.rules.actionCount = (this.rules.actionCount || 0) + 1
      if (this.rules.actionCount > this.rules.maxActions) { this.rules.fail(h, '攻击次数超过安全上限。检查循环中的目标和停止条件。'); return 'done' }
      this.swing = { target, moveSpeed: h.maxSpeed }
      h.maxSpeed = 0
      h.setTargetPos?.(null); h.intent = undefined
      if (h.velocity) { h.velocity.x = 0; h.velocity.y = 0 }
    }
    const s = this.swing; const target = s.target
    if (h.velocity) { h.velocity.x = 0; h.velocity.y = 0 }
    if (s.started == null) {
      if (!target.alive) { h.maxSpeed = s.moveSpeed; this.swing = null; return 'done' }
      if (this.distance(h.pos, target.thang.pos) > 6.5) { this.move(h, target.thang.pos, 12, 6); return }
      s.started = this.world.age
      this.rules.faceToward(h, target.thang.pos)
      this.event('swing', h.pos, target.thang.pos)
    }
    this.action(h, 'attack')
    if (!s.hit && this.world.age >= s.started + 0.25) {
      s.hit = true
      if (target.alive && this.distance(h.pos, target.thang.pos) <= 8) this.hurt(target, 20, h.pos)
    }
    if (this.world.age >= s.started + 0.65) { h.maxSpeed = s.moveSpeed; this.swing = null; this.action(h, 'idle'); return 'done' }
  }

  strike (actor, target, ranged = false) {
    const t = actor.thang; const point = target.thang?.pos || (target === this.hero ? target.pos : this.point(target.at))
    this.rules.faceToward(t, point)
    if (this.world.age < (actor.nextAttack || 0)) { this.action(t, 'idle'); return }
    if (!actor.strikeAt) { actor.strikeAt = this.world.age + 0.3; this.event('warning', t.pos, point) }
    this.action(t, 'attack')
    if (this.world.age >= actor.strikeAt) {
      actor.strikeAt = null; actor.nextAttack = this.world.age + (ranged ? 0.85 : 0.65)
      if (ranged) {
        this.event('arrow', t.pos, point)
        this.projectiles.push({ target, damage: actor.damage || 15, source: { x: t.pos.x, y: t.pos.y }, arrives: this.world.age + 0.25 })
      } else this.hurt(target, actor.damage || 15, t.pos)
    }
  }

  hear (event) {
    if (this.config.mode !== 'signals' || this.rules.failed) return
    const signal = this.actors.find(a => a.kind === 'signal' && Math.hypot(event.x - a.at[0], event.y - a.at[1]) <= 4)
    if (!signal) { this.hero.teachingFailure = '这里离信号台太远。走到台前再说“点火”。'; return }
    if (event.text !== '点火') { this.hero.teachingFailure = '信号台没有回应。石台上的口令是“点火”。'; return }
    this.hero.teachingFailure = ''
    if (!signal.lit) {
      signal.lit = true; signal.litAt = this.world.age; signal.thang.alpha = 1
      this.event('ignite', signal.thang.pos, signal.thang.pos)
      this.world.goalManager.setGoalState(`signal-${this.actors.indexOf(signal) + 1}`, 'success')
    }
  }

  ready () {
    const enemies = this.actors.filter(a => a.kind === 'enemy')
    if (this.config.mode === 'lure') return enemies.every(a => !a.alive && a.killedBy === 'trap')
    if (this.config.mode === 'rescue') return enemies.every(a => !a.alive) && this.actors.filter(a => a.kind === 'door').every(a => !a.alive) && this.actors.filter(a => a.kind === 'ally').every(a => a.alive && a.released)
    if (this.config.mode === 'signals') return this.actors.every(a => a.lit)
    return enemies.every(a => a.active && !a.alive) && this.camp.hp > 0
  }

  snapshot () {
    this.events = this.events.filter(e => this.world.age - e.at <= 1.4)
    this.hero.teachingAdventure = JSON.stringify({ mode: this.config.mode, complete: !!this.complete, camp: this.camp, events: this.events, actors: this.actors.map(a => ({ id: a.id, kind: a.kind, hp: a.hp, maxHealth: a.health, active: a.active, alive: a.alive, alerted: a.alerted, released: !!a.released, lit: a.lit, litAt: a.litAt, diedAt: a.diedAt, spawnAt: a.spawnAt || 0, at: [a.thang.pos.x, a.thang.pos.y] })) })
  }

  update () {
    const h = this.hero; const now = this.world.age
    if (this.rules.failed || this.complete) { this.snapshot(); return }
    if (now > 36) { this.rules.fail(h, '守卫时间已用完。检查循环是否持续寻找敌人、有没有正确攻击目标。'); this.snapshot(); return }
    const distanceLeft = h.targetPos ? this.distance(h.pos, h.targetPos) : 0
    const moved = this.previous ? this.distance(h.pos, this.previous) : Infinity
    this.stuckFor = distanceLeft > 2 && moved < 0.002 ? (this.stuckFor || 0) + (this.world.dt || 0.05) : 0
    for (const shot of this.projectiles.filter(p => p.arrives <= now)) { if (shot.target.alive) this.hurt(shot.target, shot.damage, shot.source) }
    this.projectiles = this.projectiles.filter(p => p.arrives > now)
    // Physical contact stops traversal; continued pushing causes visible damage.
    const blocking = this.actors.find(a => a.active && a.alive && ['door', 'enemy'].includes(a.kind) && this.distance(h.pos, a.thang.pos) < 2.8)
    if ((!this.walkable(h.pos) || blocking || this.stuckFor > 0.3) && this.previous) {
      const impact = { ...h.pos }; h.pos.x = this.previous.x; h.pos.y = this.previous.y
      if (now >= (this.bumpAt || 0)) { this.bumpAt = now + 0.4; this.hurt(h, 15, impact); if (!this.rules.failed) h.teachingFailure = blocking?.kind === 'door' ? '牢门还没破，继续硬闯会撞伤。先攻击牢门。' : '前面被挡住了，继续硬闯会受伤。' }
    }
    this.previous = { x: h.pos.x, y: h.pos.y }
    for (const at of this.rules.hazards || []) {
      const p = this.point(at)
      if (this.distance(h.pos, p) < 3) this.hurt(h, 120, p, 'trap')
      for (const a of this.aliveEnemies()) if (this.distance(a.thang.pos, p) < 3) this.hurt(a, 120, p, 'trap')
    }
    for (const a of this.actors) {
      const t = a.thang
      if (!a.active && now >= a.spawnAt) { a.active = true; t.alpha = 1; this.event('spawn', t.pos, t.pos) }
      if (!a.active || !a.alive || a.kind === 'door' || a.kind === 'signal') continue
      if (a.kind === 'ally') {
        const door = this.actors.find(x => x.id === a.releaseBy)
        if (door?.alive) { this.action(t, 'idle'); continue }
        if (!a.released) { a.released = true; this.event('rescue', t.pos, t.pos); this.world.goalManager.setGoalState('rescue-ally', 'success') }
        const enemy = this.nearest(t.pos, 28)
        if (enemy) this.strike(a, enemy, true)
        else this.move(t, h.pos, a.speed, 7)
        continue
      }
      if (!a.alerted && this.distance(t.pos, h.pos) <= a.aggro && this.clear(t.pos, h.pos)) { a.alerted = true; this.event('alert', t.pos, t.pos) }
      if (!a.alerted && this.config.mode !== 'defend') { this.action(t, 'idle'); continue }
      let target = this.config.mode === 'defend' && (this.distance(t.pos, h.pos) > 13 || !this.clear(t.pos, h.pos)) ? this.camp : h
      if (this.config.mode === 'rescue') {
        const ally = this.actors.find(x => x.kind === 'ally' && x.alive && x.released && this.clear(t.pos, x.thang.pos) && this.distance(t.pos, x.thang.pos) < this.distance(t.pos, h.pos))
        if (ally) target = ally
      }
      const p = target === h ? h.pos : target.thang?.pos || this.point(target.at)
      if (this.distance(t.pos, p) <= 6.5 && this.clear(t.pos, p)) this.strike(a, target)
      else { a.strikeAt = null; this.move(t, p, a.speed, 5.5) }
    }
    if (this.rules.failed) { this.snapshot(); return }
    const ready = this.ready()
    if (this.config.mode === 'lure' && ready) this.world.goalManager.setGoalState('lure-trap', 'success')
    if (this.config.mode === 'rescue' && this.actors.filter(a => a.kind === 'enemy').every(a => !a.alive)) this.world.goalManager.setGoalState('defeat-guard', 'success')
    if (this.actors.some(a => a.kind === 'door') && this.actors.filter(a => a.kind === 'door').every(a => !a.alive)) this.world.goalManager.setGoalState('break-door', 'success')
    if (this.config.mode === 'defend' && ready) {
      if (this.rules.learning && !this.rules.learning.accept()) { this.snapshot(); return }
      this.complete = true; h.teachingExitReady = true; h.plansDisabled = true; h.plansAreFinished = true
      h.setTargetPos?.(null); this.action(h, 'idle'); this.event('victory', h.pos, h.pos)
      for (const goal of ['defend-camp', 'reach-exit', 'stay-safe']) this.world.goalManager.setGoalState(goal, 'success')
      this.world.endWorld?.(true, 1.3, true)
    }
    if (h.plansAreFinished && this.config.mode !== 'defend' && (!ready || this.distance(h.pos, this.point(this.rules.exit)) > 2)) {
      this.endedAt ??= now
      if (now - this.endedAt > 3 && this.config.guided) {
        h.teachingFailure = '这段程序已运行完。对照引导观察结果，补上后续语句，再从头运行。'
        this.world.endWorld?.(false, 0.5, true)
      } else if (now - this.endedAt > 3) this.rules.fail(h, ready ? '任务已完成，还要走到楼梯离开。补上最后的移动命令再运行。' : '程序已经结束，但任务还没完成。检查未完成的目标，补充动作后重新运行。')
    }
    this.snapshot()
  }
}
