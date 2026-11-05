const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const vm = require('vm'); const path = require('path')
const designs = require('../map-designs'); const { record } = require('../scenario-progress'); const { spawnSync } = require('child_process')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {constructor (world, config) { this.world = world; Object.assign(this, config) }} })
const setup = (config = {}) => { const hero = { pos: { x: 12, y: 12 }, plansAreFinished: false, setAction () {}, say (n) { this.sayMessage = String(n); return 'done' }, moveRight () { return 'done' } }; const goals = {}; const world = { hero, age: 0, dt: 0.05, getThangByID: id => id === 'Hero Placeholder' ? hero : null, goalManager: { getGoalState: id => goals[id], setGoalState: (id, state) => { goals[id] = state } } }; hero.world = world; const rules = new Rules(world, config); rules.start(); return { hero, world, goals, rules } }
test('all four sections have levels; public scene files omit every solution and retain stable IDs', () => {
  assert.deepEqual([...new Set(designs.map(d => d.section))], [1, 2, 3, 4, 5])
  for (const d of designs) {
    for (let i = 0; i < (d.scenarios?.length || 1); i++) {
      const file = path.join(__dirname, '../levels/scenarios', `local-python-${String(d.index).padStart(2, '0')}-${i}.json`)
      const level = JSON.parse(fs.readFileSync(file)); assert.equal(level._id.length, 24); assert.equal(level.teachingMap.solution, undefined); assert.equal(level.teachingMap.scenarios, undefined)
      const code = (d.scenarios?.[i] || d).solution
      if (code) { const checked = spawnSync('python3', [path.join(__dirname, '../tools/check-learning.py'), String(d.index)], { input: code, encoding: 'utf8' }); assert.equal(checked.status, 0, `${d.index}/${i}: ${checked.stdout}`) }
    }
  }
})
test('closed and open states read correctly; beacon detects initial zero steps', () => {
  for (const open of [true, false]) { const { hero } = setup({ sensor: { open: { right: open }, length: 4, signal: 80 }, exit: [12, 12] }); assert.equal(hero.pathOpen('right'), open); assert.equal(hero.pathLength(), 4); assert.equal(hero.readSignal(), 80); assert.equal(hero.atBeacon(), true); hero.pos.x = 24; assert.equal(hero.atBeacon(), false) }
})
test('switches require matching position, number and order; bad number fails persistently', () => {
  const switches = [{ number: 1, at: [24, 12] }, { number: 2, at: [36, 12] }]
  const a = setup({ switches }); a.hero.pos.x = 24; assert.equal(a.hero.press(1), true); a.hero.pos.x = 36; assert.equal(a.hero.press(2), true); assert.equal(a.goals['press-switches'], 'success')
  const b = setup({ switches }); b.hero.pos.x = 24; b.hero.press(2); assert.equal(b.goals['stay-safe'], 'failure'); assert.match(b.hero.teachingFailure, /开关没按对/)
})
test('loop guard rejects multi-step bypass and too many actions', () => {
  const a = setup({ singleStep: true }); a.hero.moveRight(3); assert.equal(a.goals['stay-safe'], 'failure')
  const b = setup({ maxActions: 3 }); for (let i = 0; i < 4; i++)b.hero.moveRight(); assert.equal(b.goals['stay-safe'], 'failure'); assert.match(b.hero.teachingFailure, /循环超过安全次数/)
})
test('patrol sensor uses the same swept warning circle and eventually allows both phases', () => {
  for (const phase of [0, Math.PI]) {
    const a = setup({ guard: { x: 36, y: 24, axis: 'y', amplitude: 12, radius: 5, speed: 0.7, phase }, exit: [60, 12] }); a.hero.pos.x = 24
    let safe = 0; let blocked = 0
    for (let age = 0; age < 9; age += 0.1) {
      a.world.age = age; if (a.hero.nextTileSafe()) {
        safe++
        for (let t = 0; t < 1.5; t += 0.05) { const g = a.rules.guardPosition(age + t); const x = 24 + Math.min(12, t * 12); assert.ok(Math.hypot(g.x - x, g.y - 12) >= 5) }
      } else blocked++
    }
    assert.ok(safe > 0 && blocked > 0)
  }
})
test('scene completion requires all scenarios with same source; edits invalidate previous passes', async () => {
  const level = { teachingMap: { index: 9, scenarioTitles: ['开', '关'] } }
  const session = { code: { 'hero-placeholder': { plan: 'if hero.pathOpen("right"):\n    hero.moveRight()\n' } }, state: { complete: true }, teachingScene: 0 }
  await record(session, level, { state: { complete: true, teachingVictoryCode: session.code['hero-placeholder'].plan } }); assert.equal(session.teachingComplete, false)
  session.teachingScene = 1; await record(session, level, { state: { complete: true, teachingVictoryCode: session.code['hero-placeholder'].plan } }); assert.equal(session.teachingComplete, true)
  session.code['hero-placeholder'].plan += '\n# 改了代码\n'; await record(session, level, {}); assert.equal(session.teachingComplete, false); assert.equal(Object.keys(session.scenePasses).length, 0)
  session.code['hero-placeholder'].plan = 'hero.moveRight()\n'; await record(session, level, { state: { complete: true, teachingVictoryCode: session.code['hero-placeholder'].plan } }); assert.match(session.learningFeedback, /if/); assert.equal(session.state.complete, false)
})
test('variable scenes may change values and preserve the exact source for each result', async () => {
  const level = { teachingMap: { index: 7, scenarioTitles: ['2', '4'], allowCodeChanges: true } }
  const s = { code: { 'hero-placeholder': { plan: 'steps = 2\nhero.moveRight(steps)\n' } }, state: {}, teachingScene: 0 }
  await record(s, level, { state: { complete: true, teachingVictoryCode: s.code['hero-placeholder'].plan } }); s.teachingScene = 1; s.code['hero-placeholder'].plan = 'steps = 4\nhero.moveRight(steps)\n'; await record(s, level, { state: { complete: true, teachingVictoryCode: s.code['hero-placeholder'].plan } }); assert.equal(s.teachingComplete, true); assert.match(s.scenePasses[0].code, /steps = 2/)
})

test('stale victory cannot credit edited code', async () => {
  const level = { teachingMap: { index: 13, scenarioTitles: ['主场景'] } }
  const s = { code: { 'hero-placeholder': { plan: 'for i in range(4):\n    hero.moveRight()\n' } }, state: { complete: true } }
  await record(s, level, { state: { complete: true, teachingVictoryCode: 'for i in range(3):\n    hero.moveRight()\n' } })
  assert.equal(s.teachingComplete, false); assert.equal(Object.keys(s.scenePasses).length, 0)
})
