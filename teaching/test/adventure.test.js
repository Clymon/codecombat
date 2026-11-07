const test = require('node:test'); const assert = require('node:assert/strict')
const Adventure = require('../adventure-runtime'); const compiled = require('../tools/build-levels').compileLevels()
function setup (index, scene = 0) {
  const level = compiled.find(l => l.teachingMap.index === index && l.teachingMap.scenarioIndex === scene)
  const d = level.teachingMap; const config = structuredClone(d.adventure)
  const make = (id, at) => ({ id, pos: { x: at[0], y: at[1] }, health: 100, velocity: { x: 0, y: 0 }, setAction (v) { this.action = v }, setTargetPos () {} })
  const hero = make('Hero Placeholder', d.start); const actors = config.actors.map(a => make(a.id, a.at)); const goals = {}
  const world = { age: 0, dt: 0.05, getThangByID: id => [hero, ...actors].find(t => t.id === id), goalManager: { setGoalState: (id, state) => { goals[id] = state } }, endWorld (won) { this.ended = won } }
  const geometry = level.systems.find(s => s.original === 'facadecccc00000000000001').config
  const rules = { ...geometry, adventureConfig: { ...config, guided: !!d.tutorial }, world, faceToward () {}, fail (h, message) { this.failed = true; h.teachingFailure = message; goals['stay-safe'] = 'failure' } }
  const a = new Adventure(rules, hero)
  const tick = (seconds, action) => { for (let n = 0; n < seconds / world.dt && !rules.failed && !a.complete; n++) { action?.(); a.update(); world.age += world.dt } }
  const attack = target => { for (let n = 0; n < 500 && !rules.failed; n++) { const done = hero.attack(target) === 'done'; a.update(); world.age += world.dt; if (done) return } throw new Error('attack never finishes') }
  return { a, rules, hero, world, goals, tick, attack }
}
test('walls block sight; exposing hero starts a persistent chase into real spikes', () => {
  const s = setup(22); s.tick(1); assert.equal(s.a.actors[0].alerted, false)
  s.hero.pos.y = 36; s.tick(0.1); assert.equal(s.a.actors[0].alerted, true)
  s.hero.pos.y = 12; s.tick(5); assert.equal(s.a.actors[0].alive, false); assert.equal(s.a.actors[0].killedBy, 'trap'); assert.equal(s.goals['lure-trap'], 'success'); assert.equal(s.hero.health, 100)
})
test('spikes kill the hero; wall pressure drains health rather than freezing safely', () => {
  const s = setup(22); s.hero.pos = { x: 36, y: 36 }; s.tick(0.1); assert.equal(s.hero.health, 0); assert.match(s.hero.teachingFailure, /尖刺/)
  const w = setup(22); w.tick(0.1); w.tick(4, () => { w.hero.pos.y = 22; w.hero.pos.x = 36 }); assert.equal(w.hero.health, 0); assert.equal(w.rules.failed, true)
})
test('door takes two hits, physically blocks passage, then frees a following archer', () => {
  const s = setup(23); s.hero.pos = { x: 24, y: 36 }; assert.equal(s.a.walkable({ x: 24, y: 42 }), false)
  s.attack('牢门'); assert.equal(s.a.actors[0].hp, 20); assert.equal(s.a.actors[1].released, undefined)
  s.attack('牢门'); assert.equal(s.a.actors[0].alive, false); assert.equal(s.a.walkable({ x: 24, y: 42 }), true); assert.equal(s.a.actors[1].released, true)
  s.hero.pos = { x: 24, y: 24 }; s.tick(3); assert.ok(s.a.actors[1].thang.pos.y < 36)
})
test('released archer shoots actual damage and helps defeat the stronger guard', () => {
  const s = setup(23); s.hero.pos = { x: 24, y: 36 }; s.attack('牢门'); s.attack('牢门'); s.hero.pos = { x: 24, y: 24 }; s.tick(2)
  s.hero.pos = { x: 48, y: 24 }
  for (let i = 0; i < 4 && s.a.actors[2].alive; i++) s.attack('重甲守卫')
  s.tick(1); assert.equal(s.a.actors[2].alive, false); assert.ok(s.hero.health > 0); assert.equal(s.a.ready(), true)
})
test('invalid, empty, friendly and stale targets each give a useful failure', () => {
  for (const [target, message] of [[null, /没有攻击目标/], ['不存在', /找不到/], ['弓箭手', /友方/]]) { const s = setup(23); s.attack(target); assert.match(s.hero.teachingFailure, message) }
  const s = setup(23); s.a.actors[2].alive = false; s.attack('重甲守卫'); assert.match(s.hero.teachingFailure, /重新寻找/)
})
test('remote and wrong speech do not ignite; each distinct signal persists exactly once', () => {
  const s = setup(24); s.a.hear({ x: 12, y: 12, text: '点火' }); assert.equal(s.a.ready(), false)
  s.a.hear({ x: 24, y: 36, text: '出发' }); assert.equal(s.a.actors[0].lit, false)
  for (const x of [24, 24, 48, 72]) s.a.hear({ x, y: 36, text: '点火' })
  assert.equal(s.a.ready(), true); assert.equal(Object.keys(s.goals).length, 3)
})
for (const scene of [0, 1]) {
  test(`dynamic target loop wins reinforcement scene ${scene + 1}`, () => {
    const s = setup(25, scene)
    while (s.world.age < 35 && !s.a.complete && !s.rules.failed) { const enemy = s.hero.findNearestEnemy(); if (enemy) s.attack(enemy); else s.tick(0.5) }
    assert.equal(s.a.complete, true, s.hero.teachingFailure); assert.ok(s.hero.health > 0); assert.equal(s.world.ended, true); assert.equal(s.goals['defend-camp'], 'success')
  })
}
test('ignoring reinforcements destroys camp and cannot complete; a fresh run restores everything', () => {
  const s = setup(25); s.hero.pos = { x: 36, y: 54 }; s.tick(35); assert.equal(s.rules.failed, true); assert.equal(s.a.complete, undefined)
  const fresh = setup(25); assert.equal(fresh.hero.health, 100); assert.equal(fresh.a.camp.hp, 100); assert.equal(fresh.a.actors.filter(a => a.active).length, 0); assert.equal(fresh.hero.findNearestEnemy(), null)
})

test('reinforcement crosses the corner before engaging a hero just beyond line of sight', () => {
  const s = setup(25); s.hero.pos = { x: 48, y: 24 }; s.a.actors.slice(0, 2).forEach(a => { a.alive = false; a.active = true }); s.world.age = 9
  s.tick(8); assert.ok(s.a.actors[2].thang.pos.y < 28); assert.ok(s.hero.findNearestEnemy())
})
test('physical collision can stop native movement before geometric overlap; pressure still damages', () => {
  const s = setup(22); s.hero.targetPos = { x: 12, y: 60 }; s.tick(4); assert.equal(s.hero.health, 0)
})

test('an exposed released archer can be attacked; losing her fails the rescue', () => {
  const s = setup(23); const ally = s.a.actors[1]; const guard = s.a.actors[2]
  s.a.actors[0].alive = false; ally.released = true; ally.thang.pos = { x: 49, y: 24 }; guard.alerted = true
  for (let i = 0; i < 3; i++) { s.a.strike(guard, ally); s.world.age += 0.35; s.a.strike(guard, ally); s.world.age += 0.8 }
  assert.equal(ally.alive, false); assert.match(s.hero.teachingFailure, /弓箭手倒下/)
})
test('camp damage reaches zero and fails independently of hero health', () => {
  const s = setup(25); s.a.hurt(s.a.camp, 100, { x: 36, y: 18 }); assert.equal(s.a.camp.hp, 0); assert.equal(s.hero.health, 100); assert.match(s.hero.teachingFailure, /营火被敌人摧毁/)
})

test('first-line API failures survive the rules first update', () => {
  const fs = require('fs'); const vm = require('vm'); const path = require('path')
  const s = setup(25)
  const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { TeachingInteractions: require('../interaction-rules'), System: class {}, TeachingAdventure: Adventure, TeachingLearning: require('../learning-runtime') })
  const rules = Object.assign(new Rules(), s.rules); delete rules.fail; delete rules.faceToward
  rules.start(); s.hero.attack(null); rules.update()
  assert.match(s.hero.teachingFailure, /没有攻击目标/); assert.equal(rules.failed, true)
})

test('one tutorial attack lowers the door HP and an unfinished demo is guidance, not a collision failure', () => {
  const s = setup(26); s.attack('牢门'); assert.equal(s.a.actors[0].hp, 20)
  s.hero.plansAreFinished = true; s.tick(4)
  assert.equal(s.rules.failed, undefined); assert.match(s.hero.teachingFailure, /对照引导/)
  assert.notEqual(s.goals['reach-exit'], 'success')
})
